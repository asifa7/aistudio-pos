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

export class CustomerService {
  private getCurrentUserId(): number {
    return authService.getCurrentUserId() || 1;
  }

  public getAllCustomers(includeInactive = false): any[] {
    const query = includeInactive
      ? `SELECT c.*, cg.name as group_name 
         FROM customers c 
         LEFT JOIN customer_groups cg ON c.group_id = cg.id 
         ORDER BY c.name ASC`
      : `SELECT c.*, cg.name as group_name 
         FROM customers c 
         LEFT JOIN customer_groups cg ON c.group_id = cg.id 
         WHERE c.is_active = 1 
         ORDER BY c.name ASC`;
    return db.prepare(query).all();
  }

  public getCustomerById(id: number): any {
    const row = db.prepare(`
      SELECT c.*, cg.name as group_name 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      WHERE c.id = ?
    `).get(id);
    if (!row) {
      throw new NotFoundError(`Customer with id ${id} not found`);
    }
    return row;
  }

  public searchCustomers(searchQuery: string, limit = 20): any[] {
    const likeQuery = `%${searchQuery}%`;
    return db.prepare(`
      SELECT c.*, cg.name as group_name 
      FROM customers c 
      LEFT JOIN customer_groups cg ON c.group_id = cg.id 
      WHERE c.is_active = 1 AND (c.name LIKE ? OR c.phone LIKE ? OR c.business_name LIKE ? OR c.customer_code LIKE ?)
      LIMIT ?
    `).all(likeQuery, likeQuery, likeQuery, likeQuery, limit);
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
      const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(data.phone);
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
          delivery_notes, group_id, category, is_active, credit_allowed, credit_limit_paise,
          outstanding_balance_paise, advance_balance_paise, opening_balance_paise, opening_balance_date,
          preferred_payment_method, preferred_delivery_time, price_tier, discount_percent, notes,
          created_by, updated_by
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, 1, ?, ?,
          ?, 0, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      const creditAllowedVal = data.credit_allowed ? 1 : 0;
      const outstandingVal = data.opening_balance_paise ?? 0;
      
      const res = stmt.run(
        code, data.name, data.business_name ?? null, data.gstin ?? null, data.pan ?? null, data.phone ?? null, data.phone2 ?? null, data.whatsapp ?? null, data.email ?? null,
        data.billing_address_line1 ?? null, data.billing_address_line2 ?? null, data.billing_city ?? null, data.billing_state ?? null, data.billing_pincode ?? null,
        data.shipping_address_line1 ?? null, data.shipping_address_line2 ?? null, data.shipping_city ?? null, data.shipping_state ?? null, data.shipping_pincode ?? null,
        data.delivery_notes ?? null, data.group_id ?? null, data.category, creditAllowedVal, data.credit_limit_paise,
        outstandingVal, data.opening_balance_paise ?? 0, data.opening_balance_date ?? null,
        data.preferred_payment_method, data.preferred_delivery_time ?? null, data.price_tier, data.discount_percent, data.notes ?? null,
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
      db.prepare('UPDATE customers SET is_active = 0, updated_by = ? WHERE id = ?').run(userId, id);
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
      db.prepare('UPDATE customers SET is_active = 1, updated_by = ? WHERE id = ?').run(userId, id);
      db.prepare(`
        INSERT INTO customer_activity_logs (customer_id, action, details, performed_by)
        VALUES (?, 'reactivate', 'Customer reactivated', ?)
      `).run(id, userId);
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


}

export const customerService = new CustomerService();
