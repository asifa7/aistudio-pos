import { invoiceRepository } from '../repository/invoice_repository';
import { invoiceItemsRepository } from '../repository/invoice_items_repository';
import { paymentsRepository } from '../repository/payments_repository';
import { configService } from '../../../../core/config/config_service';
import { db } from '../../../../core/backend/db';

function centerText(text: string, width: number): string {
  if (text.length <= width) {
    const leftPadding = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPadding) + text;
  }
  const lines: string[] = [];
  let currentStr = text;
  while (currentStr.length > 0) {
    let chunk = currentStr.slice(0, width);
    if (currentStr.length > width) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > 0) {
        chunk = chunk.slice(0, lastSpace);
      }
    }
    const leftPadding = Math.floor((width - chunk.length) / 2);
    lines.push(' '.repeat(leftPadding) + chunk);
    currentStr = currentStr.slice(chunk.length).trim();
  }
  return lines.join('\n');
}

function alignLeftRight(left: string, right: string, width = 40): string {
  const spaceNeeded = width - left.length - right.length;
  if (spaceNeeded <= 0) return `${left} ${right}`;
  return left + ' '.repeat(spaceNeeded) + right;
}

export const receiptService = {
  /**
   * Formats completed invoice details into plain-text thermal receipt matching exact receipt format.
   */
  generateReceiptText(invoiceId: number, customWidth?: number): string {
    const config = configService.get();
    const template = config.receiptTemplate || {
      paperWidth: '80mm',
      headerMessage: '',
      footerMessage: '',
      showGstBreakdown: true,
      autoPrintOnComplete: true,
    };

    const width = customWidth || (template.paperWidth === '58mm' ? 32 : 40);
    const invoice = invoiceRepository.findById(invoiceId);
    const items = invoiceItemsRepository.findByInvoiceId(invoiceId);
    const payments = paymentsRepository.findByInvoiceId(invoiceId);

    const divider = '-'.repeat(width);
    let lines: string[] = [];

    // 1. Shop Name
    const shopName = invoice.shop_name_snapshot || config.shopInfo?.name || 'MEAT SHOP POS';
    lines.push(centerText(shopName.toUpperCase(), width));

    // 2. Shop Address
    const shopAddress = invoice.shop_address_snapshot || config.shopInfo?.address || '';
    if (shopAddress) {
      const parts = shopAddress.split(',').map(p => p.trim()).filter(Boolean);
      parts.forEach(part => lines.push(centerText(part, width)));
    }

    // 3. Phone Number
    const shopPhone = config.shopInfo?.phone ? `Ph: ${config.shopInfo.phone}` : '';
    if (shopPhone) lines.push(centerText(shopPhone, width));

    // 4. Blank line
    lines.push('');

    // 5. Bill Title
    const primaryPayment = payments.length > 0 ? payments[0].method.toUpperCase() : 'CASH';
    lines.push(centerText(`${primaryPayment} BILL`, width));

    // 6. Blank line
    lines.push('');

    // 7 & 8. Invoice Metadata
    const invNo = invoice.invoice_number ? invoice.invoice_number.split('_')[0] : `${invoice.id}`;
    
    let cashierName = 'CASHIER1';
    if (invoice.created_by) {
      try {
        const u = db.prepare('SELECT username FROM users WHERE id = ?').get(invoice.created_by) as { username: string } | undefined;
        if (u && u.username) cashierName = u.username.toUpperCase();
      } catch (e) {}
    }

    const completedDate = invoice.completed_at ? new Date(invoice.completed_at) : new Date();
    const dd = String(completedDate.getDate()).padStart(2, '0');
    const mm = String(completedDate.getMonth() + 1).padStart(2, '0');
    const yyyy = completedDate.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    let hours = completedDate.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, '0');
    const min = String(completedDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${min}:${ampm}`;

    lines.push(alignLeftRight(`Bill No : ${invNo}`, `Date : ${dateStr}`, width));
    lines.push(alignLeftRight(`Cashier : ${cashierName}`, `Time : ${timeStr}`, width));

    // 9. Full-width dashed divider
    lines.push(divider);

    // 10. Table Header
    if (width === 32) {
      lines.push('Description'.padEnd(11) + 'Qty'.padStart(5) + 'Rate'.padStart(7) + 'Amount'.padStart(9));
    } else {
      lines.push('Description'.padEnd(16) + 'Qty'.padStart(6) + 'Rate'.padStart(8) + 'Amount'.padStart(10));
    }

    // 11. Full-width dashed divider
    lines.push(divider);

    // 12. Item Rows
    let totalQty = 0;
    for (const item of items) {
      const pName = `${item.product_name} ${item.variant_name && item.variant_name !== 'Default' ? item.variant_name : ''}`.trim().toUpperCase();
      
      let qtyVal = 0;
      let qtyStr = '';
      if (item.unit_type === 'weight' && item.quantity_grams !== null) {
        qtyVal = item.quantity_grams / 1000;
        qtyStr = qtyVal.toFixed(3);
      } else {
        qtyVal = item.quantity_units || 1;
        qtyStr = `${qtyVal}`;
      }
      totalQty += qtyVal;

      const rateStr = (item.rate_paise_snapshot / 100).toFixed(2);
      const amtStr = (item.line_total_paise / 100).toFixed(2);

      if (width === 32) {
        const truncName = pName.length > 11 ? pName.slice(0, 11) : pName.padEnd(11);
        const qPad = qtyStr.padStart(5);
        const rPad = rateStr.padStart(7);
        const aPad = amtStr.padStart(9);
        lines.push(`${truncName}${qPad}${rPad}${aPad}`);
      } else {
        if (pName.length <= 16) {
          const dPad = pName.padEnd(16);
          const qPad = qtyStr.padStart(6);
          const rPad = rateStr.padStart(8);
          const aPad = amtStr.padStart(10);
          lines.push(`${dPad}${qPad}${rPad}${aPad}`);
        } else {
          lines.push(pName);
          const qPad = qtyStr.padStart(6);
          const rPad = rateStr.padStart(8);
          const aPad = amtStr.padStart(10);
          lines.push(`${''.padEnd(16)}${qPad}${rPad}${aPad}`);
        }
      }
    }

    // 13. Blank line
    lines.push('');

    // 14 & 15. Optional Adjustments
    const subtotalStr = (invoice.subtotal_paise / 100).toFixed(2);
    const discountPercent = invoice.discount_percent || 0;
    const discountPaise = invoice.discount_paise || 0;
    const flatDeductionPaise = invoice.flat_deduction_paise || 0;
    const dressingChargePaise = invoice.dressing_charge_paise || 0;
    const roundOffPaise = invoice.round_off_paise || 0;

    const hasAdjustments = discountPaise > 0 || flatDeductionPaise > 0 || dressingChargePaise > 0 || roundOffPaise !== 0;

    if (hasAdjustments) {
      lines.push(alignLeftRight('Subtotal', subtotalStr, width));
      if (discountPaise > 0) {
        lines.push(alignLeftRight(`Discount (${discountPercent}%)`, `-${(discountPaise / 100).toFixed(2)}`, width));
      }
      if (flatDeductionPaise > 0) {
        lines.push(alignLeftRight('Deduction', `-${(flatDeductionPaise / 100).toFixed(2)}`, width));
      }
      if (dressingChargePaise > 0) {
        lines.push(alignLeftRight('Dressing Charge', `+${(dressingChargePaise / 100).toFixed(2)}`, width));
      }
      if (roundOffPaise !== 0) {
        const sign = roundOffPaise > 0 ? '+' : '';
        lines.push(alignLeftRight('Round Off', `${sign}${(roundOffPaise / 100).toFixed(2)}`, width));
      }
    }

    // 16. Full-width dashed divider
    lines.push(divider);

    // 17. Net Amount
    const grandTotalStr = (invoice.total_paise / 100).toFixed(2);
    lines.push(alignLeftRight('Net Amount :', `₹${grandTotalStr}`, width));

    // 18. Full-width dashed divider
    lines.push(divider);

    // 19. Final Row: Items & Total Qty
    const totalQtyStr = totalQty % 1 === 0 ? `${totalQty}` : `${totalQty.toFixed(3)}`;
    lines.push(alignLeftRight(`Items : ${items.length}`, `Total Qty : ${totalQtyStr}`, width));

    // 20. Full-width dashed divider
    lines.push(divider);

    // 21. Optional Narration
    if (invoice.narration) {
      lines.push(centerText(`Note: ${invoice.narration}`, width));
    }

    // 22. Optional Cash change
    let cashTenderedPaise = 0;
    let changeDuePaise = 0;
    const cashPayment = payments.find(p => p.method === 'cash');
    if (cashPayment) {
      if (cashPayment.reference_number && cashPayment.reference_number.startsWith('TENDERED:')) {
        cashTenderedPaise = parseInt(cashPayment.reference_number.replace('TENDERED:', ''), 10) || cashPayment.amount_paise;
      } else if (cashPayment.amount_paise > invoice.total_paise) {
        cashTenderedPaise = cashPayment.amount_paise;
      }
      if (cashTenderedPaise > invoice.total_paise) {
        changeDuePaise = cashTenderedPaise - invoice.total_paise;
      }
    }
    if (changeDuePaise > 0) {
      const cashStr = (cashTenderedPaise / 100).toFixed(2);
      const changeStr = (changeDuePaise / 100).toFixed(2);
      lines.push(centerText(`Cash: ₹${cashStr} | Change: ₹${changeStr}`, width));
    }

    return lines.join('\n');
  },

  /**
   * Formats completed invoice details into pixel-exact styled HTML thermal print layout.
   */
  generateReceiptHTML(invoiceId: number): string {
    const config = configService.get();
    const template = config.receiptTemplate || {
      paperWidth: '80mm',
      headerMessage: '',
      footerMessage: '',
      showGstBreakdown: true,
      autoPrintOnComplete: true,
    };

    const invoice = invoiceRepository.findById(invoiceId);
    const items = invoiceItemsRepository.findByInvoiceId(invoiceId);
    const payments = paymentsRepository.findByInvoiceId(invoiceId);

    const is58 = template.paperWidth === '58mm';
    const shopName = invoice.shop_name_snapshot || config.shopInfo?.name || 'MEAT SHOP POS';
    const shopAddress = invoice.shop_address_snapshot || config.shopInfo?.address || '';
    const shopPhone = config.shopInfo?.phone ? `Ph: ${config.shopInfo.phone}` : '';
    const primaryPayment = payments.length > 0 ? payments[0].method.toUpperCase() : 'CASH';
    const invNo = invoice.invoice_number ? invoice.invoice_number.split('_')[0] : `${invoice.id}`;

    let cashierName = 'CASHIER1';
    if (invoice.created_by) {
      try {
        const u = db.prepare('SELECT username FROM users WHERE id = ?').get(invoice.created_by) as { username: string } | undefined;
        if (u && u.username) cashierName = u.username.toUpperCase();
      } catch (e) {}
    }

    const completedDate = invoice.completed_at ? new Date(invoice.completed_at) : new Date();
    const dd = String(completedDate.getDate()).padStart(2, '0');
    const mm = String(completedDate.getMonth() + 1).padStart(2, '0');
    const yyyy = completedDate.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    let hours = completedDate.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hh = String(hours).padStart(2, '0');
    const min = String(completedDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${min}:${ampm}`;

    // Delivery Token Slip (Minimal slip for Swiggy/Zomato agents)
    if (invoice.print_delivery_token === 1) {
      let tokenQtySum = 0;
      const tokenTableRows = items.map(item => {
        const pName = `${item.product_name} ${item.variant_name && item.variant_name !== 'Default' ? item.variant_name : ''}`.trim().toUpperCase();
        let qtyVal = 0;
        let qtyStr = '';
        if (item.unit_type === 'weight' && item.quantity_grams !== null) {
          qtyVal = item.quantity_grams / 1000;
          qtyStr = `${qtyVal.toFixed(3)} kg`;
        } else {
          qtyVal = item.quantity_units || 1;
          qtyStr = `${qtyVal} pc`;
        }
        tokenQtySum += qtyVal;
        return `
          <tr>
            <td style="text-align: left; padding: 2px 0;">${pName}</td>
            <td style="text-align: right; padding: 2px 0; font-weight: 700;">${qtyStr}</td>
          </tr>
        `;
      }).join('');

      const tokenQtyStr = tokenQtySum % 1 === 0 ? `${tokenQtySum}` : `${tokenQtySum.toFixed(3)}`;

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 0; size: ${is58 ? '58mm' : '80mm'} auto; }
    @media print { html, body { width: 100%; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; margin: 0; padding: 0; background: #ffffff; color: #000000 !important;
      font-family: "Courier New", Courier, Consolas, monospace; font-size: ${is58 ? '10px' : '12px'};
      font-weight: 600; line-height: 1.25; -webkit-font-smoothing: none; text-rendering: pixelated;
    }
    .receipt-container { width: 100%; padding: ${is58 ? '1.5mm 1.5mm' : '2.5mm 2.5mm'}; margin: 0 auto; }
    .shop-name { font-size: ${is58 ? '15px' : '18px'}; font-weight: 900; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
    .token-label { font-size: ${is58 ? '13px' : '16px'}; font-weight: 900; text-align: center; margin: 4px 0; border: 1px dashed #000; padding: 3px 0; }
    .bill-meta { font-size: ${is58 ? '10px' : '11.5px'}; font-weight: 600; display: flex; justify-content: space-between; margin-bottom: 2px; }
    .divider { border-top: 1px dashed #000000; margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; font-size: ${is58 ? '10px' : '11.5px'}; margin: 2px 0; }
    th { font-weight: 900; border-bottom: 1px dashed #000000; padding: 2px 0; }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="shop-name">${shopName}</div>
    <div class="token-label">*** DELIVERY TOKEN ***</div>
    <div class="bill-meta"><span>Ref No: <strong>#${invNo}</strong></span><span>Date : ${dateStr}</span></div>
    <div class="bill-meta"><span>Cashier : ${cashierName}</span><span>Time : ${timeStr}</span></div>
    <div class="divider"></div>
    <table>
      <thead>
        <tr>
          <th style="text-align: left; width: 70%;">Item Description</th>
          <th style="text-align: right; width: 30%;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${tokenTableRows}
      </tbody>
    </table>
    <div class="divider"></div>
    <div style="display: flex; justify-content: space-between; font-size: ${is58 ? '10px' : '11.5px'}; font-weight: 700;">
      <span>Items : ${items.length}</span>
      <span>Total Qty : ${tokenQtyStr}</span>
    </div>
    <div class="divider"></div>
    <div style="text-align: center; font-size: 10px; font-weight: 700; margin-top: 4px;">-- PACKAGE VERIFICATION SLIP --</div>
  </div>
</body>
</html>`;
    }

    let totalQty = 0;
    const tableRows = items.map(item => {
      const pName = `${item.product_name} ${item.variant_name && item.variant_name !== 'Default' ? item.variant_name : ''}`.trim().toUpperCase();
      let qtyVal = 0;
      let qtyStr = '';
      if (item.unit_type === 'weight' && item.quantity_grams !== null) {
        qtyVal = item.quantity_grams / 1000;
        qtyStr = qtyVal.toFixed(3);
      } else {
        qtyVal = item.quantity_units || 1;
        qtyStr = `${qtyVal}`;
      }
      totalQty += qtyVal;

      const rateStr = (item.rate_paise_snapshot / 100).toFixed(2);
      const amtStr = (item.line_total_paise / 100).toFixed(2);

      return `
        <tr>
          <td class="col-desc">${pName}</td>
          <td class="col-qty">${qtyStr}</td>
          <td class="col-rate">${rateStr}</td>
          <td class="col-amt">${amtStr}</td>
        </tr>
      `;
    }).join('');

    const totalQtyStr = totalQty % 1 === 0 ? `${totalQty}` : `${totalQty.toFixed(3)}`;
    const grandTotalStr = (invoice.total_paise / 100).toFixed(2);
    const addressLines = shopAddress ? shopAddress.split(',').map(p => p.trim()).filter(Boolean) : [];

    // Optional Adjustments
    const subtotalStr = (invoice.subtotal_paise / 100).toFixed(2);
    const discountPercent = invoice.discount_percent || 0;
    const discountPaise = invoice.discount_paise || 0;
    const flatDeductionPaise = invoice.flat_deduction_paise || 0;
    const dressingChargePaise = invoice.dressing_charge_paise || 0;
    const roundOffPaise = invoice.round_off_paise || 0;
    const narration = invoice.narration;

    const hasAdjustments = discountPaise > 0 || flatDeductionPaise > 0 || dressingChargePaise > 0 || roundOffPaise !== 0;

    // Cash tendered & change
    let cashTenderedPaise = 0;
    let changeDuePaise = 0;
    const cashPayment = payments.find(p => p.method === 'cash');
    if (cashPayment) {
      if (cashPayment.reference_number && cashPayment.reference_number.startsWith('TENDERED:')) {
        cashTenderedPaise = parseInt(cashPayment.reference_number.replace('TENDERED:', ''), 10) || cashPayment.amount_paise;
      } else if (cashPayment.amount_paise > invoice.total_paise) {
        cashTenderedPaise = cashPayment.amount_paise;
      }
      if (cashTenderedPaise > invoice.total_paise) {
        changeDuePaise = cashTenderedPaise - invoice.total_paise;
      }
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      margin: 0;
      size: ${is58 ? '58mm' : '80mm'} auto;
    }
    @media print {
      html, body {
        width: 100%;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000 !important;
      font-family: "Courier New", Courier, Consolas, monospace;
      font-size: ${is58 ? '10px' : '12px'};
      font-weight: 600;
      line-height: 1.25;
      -webkit-font-smoothing: none;
      text-rendering: pixelated;
    }
    .receipt-container {
      width: 100%;
      padding: ${is58 ? '1.5mm 1.5mm' : '2.5mm 2.5mm'};
      box-sizing: border-box;
      margin: 0 auto;
    }
    .shop-name {
      font-size: ${is58 ? '16px' : '20px'};
      font-weight: 900;
      letter-spacing: 0.5px;
      text-align: center;
      text-transform: uppercase;
      line-height: 1.2;
      margin-bottom: 2px;
    }
    .shop-info {
      font-size: ${is58 ? '10px' : '11px'};
      font-weight: 600;
      text-align: center;
      line-height: 1.2;
    }
    .blank-line {
      height: 6px;
    }
    .bill-type {
      font-size: ${is58 ? '13px' : '15px'};
      font-weight: 900;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${is58 ? '10px' : '11.5px'};
      font-weight: 600;
      line-height: 1.3;
      width: 100%;
    }
    .divider {
      border-top: 1px dashed #000000;
      margin: 3px 0;
      width: 100%;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: ${is58 ? '10px' : '11.5px'};
      font-family: inherit;
    }
    table.items-table th {
      font-size: ${is58 ? '10px' : '11.5px'};
      font-weight: 900;
      padding: 2px 0;
    }
    table.items-table td {
      padding: 2px 0;
      vertical-align: top;
    }
    
    .col-desc { text-align: left; width: ${is58 ? '42%' : '44%'}; word-break: break-word; font-weight: 600; }
    .col-qty { text-align: right; width: 16%; font-weight: 700; white-space: nowrap; }
    .col-rate { text-align: right; width: 18%; font-weight: 600; white-space: nowrap; }
    .col-amt { text-align: right; width: ${is58 ? '24%' : '22%'}; font-weight: 700; white-space: nowrap; }

    .adj-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${is58 ? '10px' : '11.5px'};
      font-weight: 600;
      line-height: 1.3;
      width: 100%;
    }
    .net-amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin: 2px 0;
    }
    .net-label {
      font-size: ${is58 ? '13px' : '15px'};
      font-weight: 700;
    }
    .net-value {
      font-size: ${is58 ? '20px' : '25px'};
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .note-row {
      text-align: center;
      font-size: ${is58 ? '9.5px' : '10.5px'};
      font-weight: 600;
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- 1. Shop Name -->
    <div class="shop-name">${shopName}</div>
    <!-- 2. Address -->
    ${addressLines.map(line => `<div class="shop-info">${line}</div>`).join('')}
    <!-- 3. Phone -->
    ${shopPhone ? `<div class="shop-info">${shopPhone}</div>` : ''}
    <!-- 4. Blank line -->
    <div class="blank-line"></div>
    <!-- 5. CASH BILL -->
    <div class="bill-type">${primaryPayment} BILL</div>
    <!-- 6. Blank line -->
    <div class="blank-line"></div>

    <!-- 7. Meta Row 1: Bill No & Date -->
    <div class="meta-row">
      <span>Bill No : ${invNo}</span>
      <span>Date : ${dateStr}</span>
    </div>
    <!-- 8. Meta Row 2: Cashier & Time -->
    <div class="meta-row">
      <span>Cashier : ${cashierName}</span>
      <span>Time : ${timeStr}</span>
    </div>

    <!-- 9. Full-width dashed divider -->
    <div class="divider"></div>

    <!-- 10. Column Header Row -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qty</th>
          <th class="col-rate">Rate</th>
          <th class="col-amt">Amount</th>
        </tr>
      </thead>
    </table>
    <!-- 11. Full-width dashed divider -->
    <div class="divider"></div>

    <!-- 12. Item Rows -->
    <table class="items-table">
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- 13. Blank line -->
    <div class="blank-line"></div>

    <!-- 14 & 15. Optional Adjustments (Subtotal, Discount, Deduction, Dressing Charge, Round Off) -->
    ${hasAdjustments ? `
      <div class="adj-row">
        <span>Subtotal</span>
        <span>${subtotalStr}</span>
      </div>
      ${discountPaise > 0 ? `
        <div class="adj-row">
          <span>Discount (${discountPercent}%)</span>
          <span>-${(discountPaise / 100).toFixed(2)}</span>
        </div>
      ` : ''}
      ${flatDeductionPaise > 0 ? `
        <div class="adj-row">
          <span>Deduction</span>
          <span>-${(flatDeductionPaise / 100).toFixed(2)}</span>
        </div>
      ` : ''}
      ${dressingChargePaise > 0 ? `
        <div class="adj-row">
          <span>Dressing Charge</span>
          <span>+${(dressingChargePaise / 100).toFixed(2)}</span>
        </div>
      ` : ''}
      ${roundOffPaise !== 0 ? `
        <div class="adj-row">
          <span>Round Off</span>
          <span>${roundOffPaise > 0 ? '+' : ''}${(roundOffPaise / 100).toFixed(2)}</span>
        </div>
      ` : ''}
    ` : ''}

    <!-- 16. Full-width dashed divider -->
    <div class="divider"></div>

    <!-- 17. Net Amount Row -->
    <div class="net-amount-row">
      <span class="net-label">Net Amount :</span>
      <span class="net-value">₹${grandTotalStr}</span>
    </div>

    <!-- 18. Full-width dashed divider -->
    <div class="divider"></div>

    <!-- 19. Final Row: Items & Total Qty -->
    <div class="meta-row">
      <span>Items : ${items.length}</span>
      <span>Total Qty : ${totalQtyStr}</span>
    </div>

    <!-- 20. Closing Divider -->
    <div class="divider"></div>

    <!-- 21. Optional Narration -->
    ${narration ? `<div class="note-row">Note: ${narration}</div>` : ''}

    <!-- 22. Optional Cash Change -->
    ${changeDuePaise > 0 ? `
      <div class="note-row">Cash: ₹${(cashTenderedPaise / 100).toFixed(2)} | Change: ₹${(changeDuePaise / 100).toFixed(2)}</div>
    ` : ''}
  </div>
</body>
</html>`;
  },

  generatePurchaseThermalText(invoiceId: number): string {
    const config = configService.get();
    const template = config.receiptTemplate || { paperWidth: '80mm' };
    const width = template.paperWidth === '58mm' ? 32 : 40;

    const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return 'Purchase Invoice Not Found';

    const supplier = db.prepare('SELECT company_name FROM suppliers WHERE id = ?').get(invoice.supplier_id) as any;
    const items = db.prepare(`
      SELECT pi.quantity, pi.unit_price_paise, pi.total_amount_paise, pv.variant_name, p.name as product_name
      FROM purchase_invoice_items pi
      JOIN product_variants pv ON pv.id = pi.product_variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE pi.purchase_invoice_id = ?
    `).all(invoiceId) as any[];

    const shopName = config.shopInfo?.name || 'MEAT SHOP POS';
    const purRef = invoice.purchase_ref_number || `PUR-${invoice.id}`;
    const supplierName = supplier?.company_name || `Supplier #${invoice.supplier_id}`;
    const billNo = invoice.supplier_invoice_number || 'N/A';
    const dateStr = new Date(invoice.invoice_date).toLocaleDateString();
    const divider = '-'.repeat(width);

    let lines: string[] = [];
    lines.push(centerText(shopName.toUpperCase(), width));
    lines.push(centerText('PURCHASE STOCK RECEIPT', width));
    lines.push(divider);
    lines.push(alignLeftRight(`PUR Ref : ${purRef}`, `Date : ${dateStr}`, width));
    lines.push(alignLeftRight(`Supplier : ${supplierName}`, `Bill # : ${billNo}`, width));
    lines.push(divider);

    if (width === 32) {
      lines.push('Description'.padEnd(11) + 'Qty'.padStart(5) + 'Rate'.padStart(7) + 'Amount'.padStart(9));
    } else {
      lines.push('Description'.padEnd(16) + 'Qty'.padStart(6) + 'Rate'.padStart(8) + 'Amount'.padStart(10));
    }
    lines.push(divider);

    for (const item of items) {
      const pName = `${item.product_name} ${item.variant_name}`.trim().toUpperCase();
      const qtyStr = `${item.quantity}`;
      const rateStr = (item.unit_price_paise / 100).toFixed(2);
      const amtStr = (item.total_amount_paise / 100).toFixed(2);

      if (width === 32) {
        const truncName = pName.length > 11 ? pName.slice(0, 11) : pName.padEnd(11);
        lines.push(`${truncName}${qtyStr.padStart(5)}${rateStr.padStart(7)}${amtStr.padStart(9)}`);
      } else {
        if (pName.length <= 16) {
          lines.push(`${pName.padEnd(16)}${qtyStr.padStart(6)}${rateStr.padStart(8)}${amtStr.padStart(10)}`);
        } else {
          lines.push(pName);
          lines.push(`${''.padEnd(16)}${qtyStr.padStart(6)}${rateStr.padStart(8)}${amtStr.padStart(10)}`);
        }
      }
    }

    lines.push(divider);
    lines.push(alignLeftRight('Net Purchased :', `₹${(invoice.total_amount_paise / 100).toFixed(2)}`, width));
    lines.push(divider);
    lines.push(alignLeftRight(`Status : ${(invoice.status || 'APPROVED').toUpperCase()}`, `Items : ${items.length}`, width));
    lines.push(divider);
    lines.push(centerText('Physical Stock Receipt Voucher', width));

    return lines.join('\n');
  },

  generatePurchaseThermalHTML(invoiceId: number): string {
    const config = configService.get();
    const template = config.receiptTemplate || { paperWidth: '80mm' };

    const invoice = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(invoiceId) as any;
    if (!invoice) return '<html><body>Purchase Invoice Not Found</body></html>';

    const supplier = db.prepare('SELECT company_name FROM suppliers WHERE id = ?').get(invoice.supplier_id) as any;
    const items = db.prepare(`
      SELECT pi.quantity, pi.unit_price_paise, pi.total_amount_paise, pv.variant_name, p.name as product_name
      FROM purchase_invoice_items pi
      JOIN product_variants pv ON pv.id = pi.product_variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE pi.purchase_invoice_id = ?
    `).all(invoiceId) as any[];

    const shopName = config.shopInfo?.name || 'MEAT SHOP POS';
    const purRef = invoice.purchase_ref_number || `PUR-${invoice.id}`;
    const supplierName = supplier?.company_name || `Supplier #${invoice.supplier_id}`;
    const billNo = invoice.supplier_invoice_number || 'N/A';
    const dateStr = new Date(invoice.invoice_date).toLocaleDateString();
    const is58 = template.paperWidth === '58mm';

    const tableRows = items.map(item => {
      const pName = `${item.product_name} ${item.variant_name}`.trim().toUpperCase();
      const qtyStr = `${item.quantity}`;
      const rateStr = (item.unit_price_paise / 100).toFixed(2);
      const amtStr = (item.total_amount_paise / 100).toFixed(2);

      return `
        <tr>
          <td class="col-desc">${pName}</td>
          <td class="col-qty">${qtyStr}</td>
          <td class="col-rate">${rateStr}</td>
          <td class="col-amt">${amtStr}</td>
        </tr>
      `;
    }).join('');

    const totalAmountStr = (invoice.total_amount_paise / 100).toFixed(2);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 0; size: ${is58 ? '58mm' : '80mm'} auto; }
    @media print { html, body { width: 100%; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; margin: 0; padding: 0; background: #ffffff; color: #000000 !important;
      font-family: "Courier New", Courier, Consolas, monospace; font-size: ${is58 ? '10px' : '12px'};
      font-weight: 600; line-height: 1.25; -webkit-font-smoothing: none; text-rendering: pixelated;
    }
    .receipt-container { width: 100%; padding: ${is58 ? '1.5mm 1.5mm' : '2.5mm 2.5mm'}; margin: 0 auto; }
    .shop-name { font-size: ${is58 ? '16px' : '20px'}; font-weight: 900; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
    .bill-type { font-size: ${is58 ? '13px' : '15px'}; font-weight: 900; text-align: center; text-transform: uppercase; margin: 4px 0; }
    .meta-row { font-size: ${is58 ? '10px' : '11.5px'}; font-weight: 600; display: flex; justify-content: space-between; margin-bottom: 2px; }
    .divider { border-top: 1px dashed #000000; margin: 3px 0; }
    table.items-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${is58 ? '10px' : '11.5px'}; margin: 2px 0; }
    table.items-table th { font-size: ${is58 ? '10px' : '11.5px'}; font-weight: 900; padding: 2px 0; }
    table.items-table td { padding: 2px 0; vertical-align: top; }
    .col-desc { text-align: left; width: ${is58 ? '42%' : '44%'}; word-break: break-word; font-weight: 600; }
    .col-qty { text-align: right; width: 16%; font-weight: 700; white-space: nowrap; }
    .col-rate { text-align: right; width: 18%; font-weight: 600; white-space: nowrap; }
    .col-amt { text-align: right; width: ${is58 ? '24%' : '22%'}; font-weight: 700; white-space: nowrap; }
    .net-amount-row { display: flex; justify-content: space-between; align-items: center; width: 100%; margin: 2px 0; }
    .net-label { font-size: ${is58 ? '13px' : '15px'}; font-weight: 700; }
    .net-value { font-size: ${is58 ? '20px' : '25px'}; font-weight: 900; }
    .footer { font-size: ${is58 ? '10px' : '11px'}; font-weight: 500; text-align: center; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="shop-name">${shopName}</div>
    <div class="bill-type">PURCHASE STOCK RECEIPT</div>
    <div class="divider"></div>
    <div class="meta-row"><span>PUR Ref : <strong>${purRef}</strong></span><span>Date : ${dateStr}</span></div>
    <div class="meta-row"><span>Supplier : <strong>${supplierName}</strong></span><span>Bill # : ${billNo}</span></div>
    <div class="divider"></div>
    <table class="items-table">
      <thead>
        <tr>
          <th class="col-desc">Description</th>
          <th class="col-qty">Qty</th>
          <th class="col-rate">Rate</th>
          <th class="col-amt">Amount</th>
        </tr>
      </thead>
    </table>
    <div class="divider"></div>
    <table class="items-table">
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <div class="divider"></div>
    <div class="net-amount-row">
      <span class="net-label">Net Purchased :</span>
      <span class="net-value">₹${totalAmountStr}</span>
    </div>
    <div class="divider"></div>
    <div class="meta-row"><span>Status : ${(invoice.status || 'APPROVED').toUpperCase()}</span><span>Items : ${items.length}</span></div>
    <div class="divider"></div>
    <div class="footer">Physical Stock Receipt Voucher</div>
  </div>
</body>
</html>`;
  }
};
