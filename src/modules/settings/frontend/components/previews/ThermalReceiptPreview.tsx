import React from 'react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const ThermalReceiptPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const shop = draftConfig.shopInfo;
  const tmpl = draftConfig.receiptTemplate;
  const inv = draftConfig.invoice;

  const is58mm = tmpl?.paperWidth === '58mm';

  return (
    <div className="w-full flex flex-col items-center">
      {/* Paper Container Mockup */}
      <div
        className={`bg-white text-black p-4 rounded-lg shadow-2xl font-mono text-left leading-snug transition-all ${
          is58mm ? 'w-64 text-[10px]' : 'w-80 text-[11px]'
        }`}
        style={{ color: '#000', backgroundColor: '#fff' }}
      >
        {/* Shop Title */}
        <div className="text-center font-black text-sm uppercase tracking-wide mb-1">
          {shop.name || 'ISHANTH PROTEINS'}
        </div>

        {/* Address & Phone */}
        <div className="text-center text-[10px] text-gray-700 leading-tight mb-1">
          {shop.address || '123 Market Square, Bangalore'}
          {shop.phone && <div>Ph: {shop.phone}</div>}
          {tmpl?.showHsn && shop.gstin && <div>GSTIN: {shop.gstin}</div>}
        </div>

        {/* Header Message */}
        {tmpl?.headerMessage && (
          <div className="text-center text-[9px] italic text-gray-600 my-1">
            {tmpl.headerMessage}
          </div>
        )}

        <div className="text-center font-bold text-xs my-1 border-t border-b border-black py-0.5">
          CASH BILL
        </div>

        {/* Invoice Meta */}
        <div className="flex justify-between text-[10px] my-1">
          <div>
            <div><span className="font-bold">Bill:</span> {inv?.prefix || 'INV-'}0042</div>
            {tmpl?.showCashier && <div><span className="font-bold">Cashier:</span> ADMIN</div>}
          </div>
          <div className="text-right">
            <div>23/07/2026</div>
            <div>05:30 PM</div>
          </div>
        </div>

        {/* Customer if enabled */}
        {tmpl?.showCustomer && (
          <div className="text-[10px] border-t border-dashed border-gray-400 py-1">
            <span className="font-bold">Cust:</span> Walking Customer
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-dashed border-black my-1" />

        {/* Line Items Table */}
        <table className="w-full text-left my-1">
          <thead>
            <tr className="border-b border-black text-[9px] font-black uppercase">
              <th className="w-1/2">Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="py-1">Chicken Curry Cut</td>
              <td className="text-center font-bold">0.500</td>
              <td className="text-right">320.00</td>
              <td className="text-right font-bold">160.00</td>
            </tr>
            <tr>
              <td className="py-1">Chicken Boneless</td>
              <td className="text-center font-bold">0.350</td>
              <td className="text-right">400.00</td>
              <td className="text-right font-bold">140.00</td>
            </tr>
          </tbody>
        </table>

        {/* Divider Solid */}
        <div className="border-t-2 border-black my-1" />

        {/* Totals */}
        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>Subtotal (2 Items):</span>
            <span>₹300.00</span>
          </div>

          {tmpl?.showDiscount && (
            <div className="flex justify-between text-gray-700">
              <span>Discount (5%):</span>
              <span>-₹15.00</span>
            </div>
          )}

          {tmpl?.showGstBreakdown && (
            <div className="flex justify-between text-gray-700">
              <span>CGST (2.5%) + SGST (2.5%):</span>
              <span>₹14.25</span>
            </div>
          )}

          <div className="flex justify-between text-xs font-black border-t-2 border-black pt-1 mt-1">
            <span>NET AMOUNT:</span>
            <span>₹299.25</span>
          </div>
        </div>

        {/* Payment line */}
        <div className="border-t border-dashed border-black my-1.5 pt-1 text-[10px] flex justify-between">
          <span>PAID BY CASH:</span>
          <span className="font-bold">₹300.00</span>
        </div>

        {/* Footer Note */}
        <div className="text-center text-[9px] mt-2 pt-1 border-t border-dashed border-gray-400">
          {tmpl?.footerMessage || 'Thank you for your business! Visit again.'}
        </div>

        {/* Terms if configured */}
        {inv?.termsAndConditions && (
          <div className="text-center text-[8px] text-gray-500 mt-1">
            {inv.termsAndConditions}
          </div>
        )}
      </div>

      <p className="text-[10px] text-text-muted text-center mt-3">
        Paper width: <strong className="text-text-primary">{tmpl?.paperWidth || '80mm'}</strong> ·
        Copies: <strong className="text-text-primary">{inv?.copiesCount || 1}</strong>
      </p>
    </div>
  );
};
