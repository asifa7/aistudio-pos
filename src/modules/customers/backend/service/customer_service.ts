import { db } from '../../../../core/backend/db';
import { ValidationError, NotFoundError, ConflictError } from '../../../../core/backend/errors';
import { CreateCustomerSchema, UpdateCustomerSchema, CreateReminderSchema } from '../../../../core/validation/customer_schemas';
import { logger, auditLogger } from '../../../../core/backend/logger';
import { authService } from '../../../auth/backend/service/auth_service';

export interface CustomerReminderRow {
  id: number;
  customer_id: number;
  channel: string;
  template_type: string;
  message: string;
  outstanding_paise: number | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  failure_reason: string | null;
  created_at: string;
}

export interface CustomerPurchaseItem {
  id: number;
  product_variant_id: number;
  product_name: string;
  variant_name: string;
  unit_type: string;
  quantity: number;
  unit_label: string;
  rate_paise: number;
  line_total_paise: number;
}

export interface CustomerPurchaseInvoice {
  id: number;
  invoice_number: string;
  created_at: string;
  status: string;
  payment_status: string;
  is_gst_invoice: number;
  subtotal_paise: number;
  discount_paise: number;
  total_paise: number;
  payment_methods: string[];
  items_summary: string;
  items_count: number;
  items: CustomerPurchaseItem[];
}

export interface CustomerOverviewSummary {
  customer_id: number;
  total_purchases_paise: number;
  total_visits: number;
  total_payments_paise: number;
  last_purchase_date: string | null;
  last_purchase_amount_paise: number;
  last_purchase_items: string | null;
  last_payment_date: string | null;
  last_payment_amount_paise: number;
  outstanding_balance_paise: number;
  advance_balance_paise: number;
  credit_limit_paise: number;
  available_credit_paise: number;
}

export class CustomerService {
  private getCurrentUserId(): number {
    return authService.getCurrentUserId() || 1;
  }

  public getAllCustomers(includeInactive = false): any[] {
    const query = includeInactive
      ? `SELECT c.*, cg.name as group_name, cac.segment as customer_segment 
         FROM customers c 
         LEFT JOIN customer_groups cg ON c.group_id = cg.id 
         LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
         WHERE c.status != 'merged' OR c.status IS NULL
         ORDER BY c.name ASC`
      : `SELECT c.*, cg.name as group_name, cac.segment as customer_segment 
         FROM customers c 
         LEFT JOIN customer_groups cg ON c.group_id = cg.id 
         LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
         WHERE c.is_active = 1 AND (c.status = 'active' OR c.status IS NULL)
         ORDER BY c.name ASC`;
    return db.prepare(query).all();
  }

  public getCustomerById(id: number): any {
    const row = db.prepare(`
      SELECT c.*, cg.name as group_name, cac.segment as customer_segment 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
      WHERE c.id = ?
    `).get(id);
    if (!row) {
      throw new NotFoundError(`Customer with id ${id} not found`);
    }
    return row;
  }

  public searchCustomers(searchQuery: string, limit = 25): any[] {
    if (!searchQuery || !searchQuery.trim()) {
      return this.getAllCustomers(false).slice(0, limit);
    }

    const raw = searchQuery.trim();
    const likeQuery = `%${raw}%`;
    const digitsOnly = raw.replace(/\D/g, '');
    const phonePattern = digitsOnly.length >= 3 ? `%${digitsOnly}%` : likeQuery;

    return db.prepare(`
      SELECT c.*, cg.name as group_name, cac.segment as customer_segment 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
      WHERE c.is_active = 1 
        AND (c.status != 'merged' OR c.status IS NULL)
        AND (
          c.name LIKE ? 
          OR c.phone LIKE ? 
          OR c.whatsapp LIKE ?
          OR c.business_name LIKE ? 
          OR c.customer_code LIKE ?
          OR c.category LIKE ?
        )
      ORDER BY 
        CASE 
          WHEN c.phone = ? THEN 1
          WHEN c.customer_code = ? THEN 2
          WHEN c.name LIKE ? THEN 3
          ELSE 4
        END,
        c.name ASC
      LIMIT ?
    `).all(
      likeQuery, phonePattern, phonePattern, likeQuery, likeQuery, likeQuery,
      raw, raw, `${raw}%`,
      limit
    );
  }

  /**
   * Check for duplicate customers by phone, whatsapp, email, or close name before saving.
   */
  public checkDuplicateCustomers(criteria: {
    phone?: string | null;
    whatsapp?: string | null;
    name?: string | null;
    email?: string | null;
    excludeId?: number | null;
  }): { hasDuplicate: boolean; duplicates: any[] } {
    const duplicates: any[] = [];
    const excludeId = criteria.excludeId || 0;

    // 1. Phone match
    if (criteria.phone && criteria.phone.trim()) {
      const cleanPhone = criteria.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 6) {
        const rows = db.prepare(`
          SELECT id, customer_code, name, phone, whatsapp, category, outstanding_balance_paise, is_active, status
          FROM customers 
          WHERE (phone LIKE ? OR whatsapp LIKE ? OR phone = ?) AND id != ? AND (status != 'merged' OR status IS NULL)
        `).all(`%${cleanPhone}%`, `%${cleanPhone}%`, criteria.phone.trim(), excludeId) as any[];

        for (const r of rows) {
          if (!duplicates.some(d => d.id === r.id)) {
            duplicates.push({ ...r, matchReason: `Phone match (${r.phone || r.whatsapp})` });
          }
        }
      }
    }

    // 2. WhatsApp match (if distinct from phone)
    if (criteria.whatsapp && criteria.whatsapp.trim()) {
      const cleanWa = criteria.whatsapp.replace(/\D/g, '');
      if (cleanWa.length >= 6) {
        const rows = db.prepare(`
          SELECT id, customer_code, name, phone, whatsapp, category, outstanding_balance_paise, is_active, status
          FROM customers 
          WHERE (whatsapp LIKE ? OR phone LIKE ?) AND id != ? AND (status != 'merged' OR status IS NULL)
        `).all(`%${cleanWa}%`, `%${cleanWa}%`, excludeId) as any[];

        for (const r of rows) {
          if (!duplicates.some(d => d.id === r.id)) {
            duplicates.push({ ...r, matchReason: `WhatsApp match (${r.whatsapp})` });
          }
        }
      }
    }

    // 3. Name match (case-insensitive exact or high similarity)
    if (criteria.name && criteria.name.trim().length >= 3) {
      const rows = db.prepare(`
        SELECT id, customer_code, name, phone, whatsapp, category, outstanding_balance_paise, is_active, status
        FROM customers 
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ? AND (status != 'merged' OR status IS NULL)
      `).all(criteria.name.trim(), excludeId) as any[];

      for (const r of rows) {
        if (!duplicates.some(d => d.id === r.id)) {
          duplicates.push({ ...r, matchReason: `Exact Name match (${r.name})` });
        }
      }
    }

    return {
      hasDuplicate: duplicates.length > 0,
      duplicates,
    };
  }

  public createCustomer(rawInput: unknown) {
    const parsed = CreateCustomerSchema.safeParse(rawInput);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const fieldName = issue.path.length > 0 ? ` (${issue.path.join('.')})` : '';
      throw new ValidationError(`Validation failed: ${issue.message}${fieldName}`, parsed.error.flatten());
    }
    const data = parsed.data;
    
    // Check phone uniqueness
    if (data.phone) {
      const existing = db.prepare("SELECT id FROM customers WHERE phone = ? AND (status != 'merged' OR status IS NULL)").get(data.phone);
      if (existing) {
        throw new ConflictError(`Customer with phone number ${data.phone} already exists`);
      }
    }

    const userId = this.getCurrentUserId();

    const insertResult = db.transaction(() => {
      // 1. Get next ID to construct code
      const last = db.prepare('SELECT MAX(id) as maxId FROM customers').get() as { maxId: number | null };
      const nextId = (last?.maxId ?? 0) + 1;
      const code = `CUST-${String(nextId).padStart(5, '0')}`;

      // 2. Insert customer profile
      const stmt = db.prepare(`
        INSERT INTO customers (
          customer_code, name, business_name, gstin, pan, phone, phone2, whatsapp, email,
          billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode,
          shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode,
          delivery_notes, group_id, category, status, is_active, credit_allowed, credit_limit_paise,
          outstanding_balance_paise, advance_balance_paise, opening_balance_paise, opening_balance_date,
          preferred_payment_method, preferred_delivery_time, price_tier, discount_percent,
          preferred_cut, skin_preference, cutting_preference, typical_quantity,
          delivery_preference, packaging_preference, special_instructions,
          notes, created_by, updated_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, 1, ?, ?,
          ?, 0, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `);

      const creditAllowedVal = data.credit_allowed ? 1 : 0;
      const outstandingVal = data.opening_balance_paise ?? 0;
      const statusVal = data.status || 'active';
      
      const res = stmt.run(
        code, data.name, data.business_name ?? null, data.gstin ?? null, data.pan ?? null, data.phone ?? null, data.phone2 ?? null, data.whatsapp ?? null, data.email ?? null,
        data.billing_address_line1 ?? null, data.billing_address_line2 ?? null, data.billing_city ?? null, data.billing_state ?? null, data.billing_pincode ?? null,
        data.shipping_address_line1 ?? null, data.shipping_address_line2 ?? null, data.shipping_city ?? null, data.shipping_state ?? null, data.shipping_pincode ?? null,
        data.delivery_notes ?? null, data.group_id ?? null, data.category, statusVal, creditAllowedVal, data.credit_limit_paise,
        outstandingVal, data.opening_balance_paise ?? 0, data.opening_balance_date ?? null,
        data.preferred_payment_method, data.preferred_delivery_time ?? null, data.price_tier, data.discount_percent,
        data.preferred_cut ?? null, data.skin_preference ?? null, data.cutting_preference ?? null, data.typical_quantity ?? null,
        data.delivery_preference ?? null, data.packaging_preference ?? null, data.special_instructions ?? null,
        data.notes ?? null,
        userId, userId
      );

      const customerId = res.lastInsertRowid as number;

      // 3. Setup credit account defaults
      db.prepare(`
        INSERT INTO customer_credit_accounts (
          customer_id, credit_limit_paise, soft_limit_paise, hard_limit_paise,
          grace_days, max_overdue_days, interest_rate_percent, is_frozen, is_blacklisted
        ) VALUES (?, ?, ?, ?, 7, 30, 0, 0, 0)
      `).run(customerId, data.credit_limit_paise, Math.round(data.credit_limit_paise * 0.9), data.credit_limit_paise);

      // 4. Record opening balance in ledger if outstanding > 0
      if (outstandingVal > 0) {
        db.prepare(`
          INSERT INTO customer_ledger (
            customer_id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_by
          ) VALUES (?, 'opening_balance', NULL, NULL, 'Opening balance record', ?, 0, ?, ?)
        `).run(customerId, outstandingVal, outstandingVal, userId);
      }

      // Log activity
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'create', 'Customer profile created', ?)
      `).run(customerId, userId);

      return customerId;
    })();

    auditLogger.log(userId, 'CUSTOMER_CREATED', { customerId: insertResult });
    return this.getCustomerById(insertResult);
  }

  public updateCustomer(id: number, rawFields: unknown) {
    const customer = this.getCustomerById(id);
    const parsed = UpdateCustomerSchema.parse(rawFields);
    const userId = this.getCurrentUserId();

    db.transaction(() => {
      // Dynamic updates build
      const sets: string[] = [];
      const values: any[] = [];
      
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined) {
          sets.push(`${key} = ?`);
          values.push(value);
        }
      }

      if (sets.length > 0) {
        sets.push('updated_by = ?');
        values.push(userId);
        sets.push('updated_at = CURRENT_TIMESTAMP');
        
        values.push(id);
        const query = `UPDATE customers SET ${sets.join(', ')} WHERE id = ?`;
        db.prepare(query).run(...values);
      }

      // Check if credit limits updated, update customer_credit_accounts
      if (parsed.credit_limit_paise !== undefined) {
        db.prepare(`
          UPDATE customer_credit_accounts
          SET credit_limit_paise = ?, soft_limit_paise = ?, hard_limit_paise = ?
          WHERE customer_id = ?
        `).run(parsed.credit_limit_paise, Math.round(parsed.credit_limit_paise * 0.9), parsed.credit_limit_paise, id);
      }

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'update', 'Customer profile updated', ?)
      `).run(id, userId);
    })();

    return this.getCustomerById(id);
  }

  public deactivateCustomer(id: number) {
    const customer = this.getCustomerById(id);
    if (customer.outstanding_balance_paise > 0) {
      throw new ConflictError('Cannot deactivate customer with an outstanding balance');
    }
    const userId = this.getCurrentUserId();
    db.transaction(() => {
      db.prepare("UPDATE customers SET is_active = 0, status = 'inactive', updated_by = ? WHERE id = ?").run(userId, id);
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'deactivate', 'Customer deactivated', ?)
      `).run(id, userId);
    })();
  }

  public reactivateCustomer(id: number) {
    this.getCustomerById(id);
    const userId = this.getCurrentUserId();
    db.transaction(() => {
      db.prepare("UPDATE customers SET is_active = 1, status = 'active', updated_by = ? WHERE id = ?").run(userId, id);
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'reactivate', 'Customer reactivated', ?)
      `).run(id, userId);
    })();
  }

  /**
   * Get detailed purchase history for customer with itemized details and payment breakdown.
   */
  public getCustomerPurchaseHistory(customerId: number, options?: { limit?: number; offset?: number }): { invoices: CustomerPurchaseInvoice[]; total_count: number } {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const countRow = db.prepare(`
      SELECT COUNT(*) as count 
      FROM invoices 
      WHERE customer_id = ? AND status IN ('completed', 'returned')
    `).get(customerId) as any;

    const totalCount = countRow?.count || 0;

    const invoiceRows = db.prepare(`
      SELECT 
        id, invoice_number, created_at, status, payment_status, 
        is_gst_invoice, subtotal_paise, discount_paise, total_paise
      FROM invoices 
      WHERE customer_id = ? AND status IN ('completed', 'returned')
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(customerId, limit, offset) as any[];

    const invoices: CustomerPurchaseInvoice[] = invoiceRows.map((inv) => {
      // Fetch line items
      const rawItems = db.prepare(`
        SELECT 
          ii.id, ii.product_variant_id, ii.rate_paise_snapshot as rate_paise, ii.line_total_paise,
          ii.quantity_grams, ii.quantity_units,
          p.name as product_name, p.unit_type,
          pv.variant_name
        FROM invoice_items ii
        JOIN product_variants pv ON ii.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ii.invoice_id = ?
        ORDER BY ii.id ASC
      `).all(inv.id) as any[];

      const items: CustomerPurchaseItem[] = rawItems.map((item) => {
        const isWeight = item.unit_type === 'weight' || item.unit_type === 'live_dual' || item.quantity_grams != null;
        const qty = isWeight ? (item.quantity_grams || 0) / 1000 : (item.quantity_units || 0);
        return {
          id: item.id,
          product_variant_id: item.product_variant_id,
          product_name: item.product_name,
          variant_name: item.variant_name,
          unit_type: item.unit_type,
          quantity: qty,
          unit_label: isWeight ? 'kg' : 'pcs',
          rate_paise: item.rate_paise,
          line_total_paise: item.line_total_paise,
        };
      });

      // Construct item summary string
      const summaryParts = items.slice(0, 3).map(
        i => `${i.product_name}${i.variant_name && i.variant_name !== 'Default' ? ` (${i.variant_name})` : ''} (${i.quantity.toFixed(i.unit_label === 'kg' ? 2 : 0)} ${i.unit_label})`
      );
      if (items.length > 3) summaryParts.push(`+${items.length - 3} more`);
      const itemsSummary = summaryParts.join(', ') || 'General purchase';

      // Fetch payment methods
      const paymentRows = db.prepare('SELECT DISTINCT method FROM payments WHERE invoice_id = ?').all(inv.id) as any[];
      const paymentMethods = paymentRows.map(p => p.method);

      return {
        id: inv.id,
        invoice_number: inv.invoice_number || `#${inv.id}`,
        created_at: inv.created_at,
        status: inv.status,
        payment_status: inv.payment_status,
        is_gst_invoice: inv.is_gst_invoice,
        subtotal_paise: inv.subtotal_paise || inv.total_paise,
        discount_paise: inv.discount_paise || 0,
        total_paise: inv.total_paise,
        payment_methods: paymentMethods.length > 0 ? paymentMethods : ['cash'],
        items_summary: itemsSummary,
        items_count: items.length,
        items,
      };
    });

    return {
      invoices,
      total_count: totalCount,
    };
  }

  /**
   * Get Customer Overview summary metrics (lifetime spend, visits, last purchase, balances).
   */
  public getCustomerOverviewSummary(customerId: number): CustomerOverviewSummary {
    const customer = this.getCustomerById(customerId);

    // Spend & visit stats from invoices
    const invoiceStats = db.prepare(`
      SELECT 
        COUNT(id) as total_visits,
        COALESCE(SUM(total_paise), 0) as total_purchases_paise
      FROM invoices
      WHERE customer_id = ? AND status IN ('completed', 'returned')
    `).get(customerId) as any;

    // Last invoice details
    const lastInvoice = db.prepare(`
      SELECT id, created_at, total_paise 
      FROM invoices 
      WHERE customer_id = ? AND status IN ('completed', 'returned')
      ORDER BY created_at DESC, id DESC 
      LIMIT 1
    `).get(customerId) as any;

    let lastPurchaseItems: string | null = null;
    if (lastInvoice) {
      const items = db.prepare(`
        SELECT p.name, pv.variant_name, ii.quantity_grams, ii.quantity_units, p.unit_type
        FROM invoice_items ii
        JOIN product_variants pv ON ii.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ii.invoice_id = ?
        LIMIT 3
      `).all(lastInvoice.id) as any[];

      lastPurchaseItems = items.map((i) => {
        const isWeight = i.unit_type === 'weight' || i.unit_type === 'live_dual' || i.quantity_grams != null;
        const q = isWeight ? `${((i.quantity_grams || 0) / 1000).toFixed(1)}kg` : `${i.quantity_units}pc`;
        return `${i.name} (${q})`;
      }).join(', ');
    }

    // Payment stats from payments table and customer_ledger
    const paymentStats = db.prepare(`
      SELECT 
        COALESCE(SUM(credit_paise), 0) as total_payments_paise
      FROM customer_ledger
      WHERE customer_id = ? AND ref_type = 'payment'
    `).get(customerId) as any;

    const lastPayment = db.prepare(`
      SELECT created_at, credit_paise as amount_paise
      FROM customer_ledger
      WHERE customer_id = ? AND ref_type = 'payment'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(customerId) as any;

    const creditLimit = customer.credit_limit_paise || 0;
    const outstanding = customer.outstanding_balance_paise || 0;
    const availableCredit = Math.max(0, creditLimit - outstanding);

    return {
      customer_id: customerId,
      total_purchases_paise: invoiceStats?.total_purchases_paise || 0,
      total_visits: invoiceStats?.total_visits || 0,
      total_payments_paise: paymentStats?.total_payments_paise || 0,
      last_purchase_date: lastInvoice?.created_at || null,
      last_purchase_amount_paise: lastInvoice?.total_paise || 0,
      last_purchase_items: lastPurchaseItems,
      last_payment_date: lastPayment?.created_at || null,
      last_payment_amount_paise: lastPayment?.amount_paise || 0,
      outstanding_balance_paise: outstanding,
      advance_balance_paise: customer.advance_balance_paise || 0,
      credit_limit_paise: creditLimit,
      available_credit_paise: availableCredit,
    };
  }

  /**
   * Merge Source Customer into Target (Surviving) Customer.
   * Atomically transfers all invoices, ledger records, credit notes, reminders, visits, and notes.
   */
  public mergeCustomers(sourceCustomerId: number, targetCustomerId: number, options?: { reason?: string }): any {
    if (sourceCustomerId === targetCustomerId) {
      throw new ValidationError('Cannot merge a customer into themselves');
    }

    const source = this.getCustomerById(sourceCustomerId);
    const target = this.getCustomerById(targetCustomerId);

    if (source.status === 'merged') {
      throw new ConflictError(`Source customer ${source.name} is already merged`);
    }

    const userId = this.getCurrentUserId();
    const reason = options?.reason || `Merged customer #${source.customer_code} into #${target.customer_code}`;

    return db.transaction(() => {
      // 1. Reassign Invoices
      const invoiceUpdate = db.prepare('UPDATE invoices SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 2. Reassign Customer Ledger entries
      db.prepare('UPDATE customer_ledger SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 3. Reassign Customer Visits
      db.prepare('UPDATE customer_visits SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 4. Reassign Customer Notes
      db.prepare('UPDATE customer_notes SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 5. Reassign Customer Reminders
      db.prepare('UPDATE customer_reminders SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 6. Reassign Customer Communication Log
      db.prepare('UPDATE customer_communication_log SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 7. Reassign Credit Notes
      db.prepare('UPDATE credit_notes SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);

      // 8. Reassign Customer Credit Transactions (if table exists)
      try {
        db.prepare('UPDATE customer_credit_transactions SET customer_id = ? WHERE customer_id = ?').run(targetCustomerId, sourceCustomerId);
      } catch (e) {
        // Ignored if table doesn't exist
      }

      // 9. Calculate combined balances
      const combinedOutstanding = (target.outstanding_balance_paise || 0) + (source.outstanding_balance_paise || 0);
      const combinedAdvance = (target.advance_balance_paise || 0) + (source.advance_balance_paise || 0);
      const combinedCreditLimit = Math.max(target.credit_limit_paise || 0, source.credit_limit_paise || 0);

      // 10. Update target (surviving) customer
      const targetNotes = target.notes ? `${target.notes}\n[Merged with ${source.customer_code} (${source.name}): ${reason}]` : `[Merged with ${source.customer_code} (${source.name}): ${reason}]`;
      db.prepare(`
        UPDATE customers 
        SET 
          outstanding_balance_paise = ?,
          advance_balance_paise = ?,
          credit_limit_paise = ?,
          notes = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(combinedOutstanding, combinedAdvance, combinedCreditLimit, targetNotes, userId, targetCustomerId);

      // Update credit account limits
      db.prepare(`
        UPDATE customer_credit_accounts
        SET credit_limit_paise = ?, soft_limit_paise = ?, hard_limit_paise = ?
        WHERE customer_id = ?
      `).run(combinedCreditLimit, Math.round(combinedCreditLimit * 0.9), combinedCreditLimit, targetCustomerId);

      // 11. Update source customer (mark merged, 0 balances, inactive)
      const sourceNotes = source.notes ? `${source.notes}\n[MERGED INTO ${target.customer_code} (${target.name}) on ${new Date().toISOString()}]` : `[MERGED INTO ${target.customer_code} (${target.name}) on ${new Date().toISOString()}]`;
      db.prepare(`
        UPDATE customers
        SET 
          status = 'merged',
          is_active = 0,
          merged_into_customer_id = ?,
          outstanding_balance_paise = 0,
          advance_balance_paise = 0,
          notes = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(targetCustomerId, sourceNotes, userId, sourceCustomerId);

      // 12. Record audit logs on both customers
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'merge', ?, ?)
      `).run(targetCustomerId, `Merged customer #${source.customer_code} (${source.name}) into this record. Reassigned ${invoiceUpdate.changes} invoices.`, userId);

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'merged_away', ?, ?)
      `).run(sourceCustomerId, `This customer record was merged into #${target.customer_code} (${target.name}).`, userId);

      auditLogger.log(userId, 'CUSTOMER_MERGED', {
        sourceCustomerId,
        targetCustomerId,
        invoicesTransferred: invoiceUpdate.changes,
        combinedOutstanding,
      });

      return {
        success: true,
        message: `Successfully merged ${source.name} (${source.customer_code}) into ${target.name} (${target.customer_code}).`,
        targetCustomer: this.getCustomerById(targetCustomerId),
        invoicesTransferred: invoiceUpdate.changes,
      };
    })();
  }

  public getCustomerGroups() {
    return db.prepare('SELECT * FROM customer_groups ORDER BY name ASC').all();
  }

  public getActivityLog(customerId: number, limit = 50) {
    return db.prepare(`
      SELECT l.*, u.username as performer_name 
      FROM customer_activity_logs l 
      LEFT JOIN users u ON l.performed_by = u.id 
      WHERE l.customer_id = ? 
      ORDER BY l.created_at DESC 
      LIMIT ?
    `).all(customerId, limit);
  }

  // Reminders
  public createReminder(rawInput: unknown) {
    const parsed = CreateReminderSchema.parse(rawInput);
    const userId = this.getCurrentUserId();
    const customer = this.getCustomerById(parsed.customer_id);

    const reminderId = db.transaction(() => {
      const res = db.prepare(`
        INSERT INTO customer_reminders (
          customer_id, channel, template_type, message, outstanding_paise, status, scheduled_for, created_by
        ) VALUES (?, ?, ?, ?, ?, 'sent', ?, ?)
      `).run(
        parsed.customer_id,
        parsed.channel,
        parsed.template_type,
        parsed.message,
        customer.outstanding_balance_paise,
        parsed.scheduled_for ?? new Date().toISOString(),
        userId
      );

      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'send_reminder', ?, ?)
      `).run(parsed.customer_id, `Reminder sent via ${parsed.channel}`, userId);

      return res.lastInsertRowid as number;
    })();

    return db.prepare('SELECT * FROM customer_reminders WHERE id = ?').get(reminderId);
  }

  public getReminders(customerId: number) {
    return db.prepare('SELECT * FROM customer_reminders WHERE customer_id = ? ORDER BY created_at DESC').all();
  }

  // Timestamped Customer Notes
  public addCustomerNote(customerId: number, note: string, category = 'preference') {
    const userId = this.getCurrentUserId();
    const res = db.prepare(`
      INSERT INTO customer_notes (customer_id, note, category, created_by)
      VALUES (?, ?, ?, ?)
    `).run(customerId, note, category, userId);
    return db.prepare('SELECT * FROM customer_notes WHERE id = ?').get(res.lastInsertRowid);
  }

  public getCustomerNotes(customerId: number) {
    return db.prepare('SELECT * FROM customer_notes WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
  }

  // Communication Log
  public logCommunication(customerId: number, channel: string, message: string, templateType?: string, status = 'sent') {
    const userId = this.getCurrentUserId();
    const res = db.prepare(`
      INSERT INTO customer_communication_log (customer_id, channel, template_type, message, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customerId, channel, templateType ?? null, message, status, userId);
    return db.prepare('SELECT * FROM customer_communication_log WHERE id = ?').get(res.lastInsertRowid);
  }

  public getCommunicationLog(customerId: number) {
    return db.prepare('SELECT * FROM customer_communication_log WHERE customer_id = ? ORDER BY sent_at DESC').all(customerId);
  }

  /**
   * Builds a unified chronological timeline for a customer merging:
   * 1. Purchases (invoices with items, amount, payment method)
   * 2. Direct Payments (payment records, advance deposits)
   * 3. Credit transactions & notes (customer_ledger entries)
   * 4. Profile & audit logs (customer_activity_logs)
   */
  public getCustomerUnifiedTimeline(customerId: number, limit = 100): any[] {
    const timeline: any[] = [];

    // 1. Invoices (Purchases)
    const invoices = db.prepare(`
      SELECT id, invoice_number, created_at, total_paise, payment_status, status
      FROM invoices
      WHERE customer_id = ? AND status IN ('completed', 'returned', 'voided')
      ORDER BY created_at DESC
      LIMIT ?
    `).all(customerId, limit) as any[];

    for (const inv of invoices) {
      // Fetch line items summary
      const items = db.prepare(`
        SELECT ii.quantity_grams, ii.quantity_units, p.name as product_name, p.unit_type, pv.variant_name
        FROM invoice_items ii
        JOIN product_variants pv ON ii.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        WHERE ii.invoice_id = ?
      `).all(inv.id) as any[];

      const itemsSummary = items.map(it => {
        const isWeight = it.unit_type === 'weight' || it.quantity_grams != null;
        const qStr = isWeight ? `${((it.quantity_grams || 0) / 1000).toFixed(2)} kg` : `${it.quantity_units || 1} pcs`;
        return `${it.product_name}${it.variant_name !== 'Default' ? ` (${it.variant_name})` : ''} (${qStr})`;
      }).join(', ') || 'POS Meat Items';

      // Fetch payment methods
      const payMethods = db.prepare(`
        SELECT DISTINCT method FROM payments WHERE invoice_id = ?
      `).all(inv.id) as { method: string }[];
      const methodLabel = payMethods.map(m => m.method.toUpperCase()).join(', ') || 'CASH';

      timeline.push({
        id: `purchase-${inv.id}`,
        type: 'purchase',
        title: `Purchase #${inv.invoice_number}`,
        description: itemsSummary,
        amount_paise: inv.total_paise,
        badge: inv.status === 'voided' ? 'Voided' : inv.payment_status.toUpperCase(),
        timestamp: inv.created_at,
        metadata: {
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          payment_methods: payMethods.map(m => m.method),
          method_label: methodLabel,
          items_count: items.length,
        },
      });
    }

    // 2. Payments (Payment Records)
    const payments = db.prepare(`
      SELECT id, amount_paise, method, reference_number, is_advance, notes, created_at, payment_date
      FROM customer_payment_records
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(customerId, limit) as any[];

    for (const pay of payments) {
      timeline.push({
        id: `payment-${pay.id}`,
        type: 'payment',
        title: pay.is_advance === 1 ? 'Advance Deposit' : `Payment Received (${pay.method.toUpperCase()})`,
        description: pay.notes || (pay.reference_number ? `Ref #${pay.reference_number}` : `Direct ${pay.method.toUpperCase()} payment`),
        amount_paise: pay.amount_paise,
        badge: pay.is_advance === 1 ? 'ADVANCE' : pay.method.toUpperCase(),
        timestamp: pay.created_at || pay.payment_date,
        metadata: {
          payment_id: pay.id,
          method: pay.method,
          reference_number: pay.reference_number,
          is_advance: pay.is_advance === 1,
        },
      });
    }

    // 3. Ledger Credit/Debit rows (Credit Sales, Notes, Adjustments)
    const ledgerRows = db.prepare(`
      SELECT id, ref_type, ref_id, invoice_number, description, debit_paise, credit_paise, running_balance_paise, created_at
      FROM customer_ledger
      WHERE customer_id = ? AND ref_type NOT IN ('payment', 'advance_deposit')
      ORDER BY created_at DESC
      LIMIT ?
    `).all(customerId, limit) as any[];

    for (const ledg of ledgerRows) {
      const isDebit = ledg.debit_paise > 0;
      timeline.push({
        id: `credit-${ledg.id}`,
        type: 'credit',
        title: isDebit ? `Credit Sale Debit` : `Credit Adjustment / Note`,
        description: ledg.description || (ledg.invoice_number ? `Invoice #${ledg.invoice_number}` : ledg.ref_type),
        amount_paise: isDebit ? ledg.debit_paise : ledg.credit_paise,
        badge: ledg.ref_type.toUpperCase().replace('_', ' '),
        timestamp: ledg.created_at,
        metadata: {
          ledger_id: ledg.id,
          ref_type: ledg.ref_type,
          running_balance_paise: ledg.running_balance_paise,
        },
      });
    }

    // 4. Activity Logs (Profile changes, freeze, reminders, merge)
    const activityLogs = db.prepare(`
      SELECT id, action, details, created_at
      FROM customer_activity_logs
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(customerId, limit) as any[];

    for (const act of activityLogs) {
      timeline.push({
        id: `activity-${act.id}`,
        type: 'activity',
        title: `Account: ${act.action.replace('_', ' ').toUpperCase()}`,
        description: act.details || '',
        amount_paise: null,
        badge: 'AUDIT',
        timestamp: act.created_at,
        metadata: {
          activity_id: act.id,
          action: act.action,
        },
      });
    }

    // Sort combined feed newest first
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return timeline.slice(0, limit);
  }
}

export const customerService = new CustomerService();
