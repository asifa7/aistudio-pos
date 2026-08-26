import { db } from '../../../../core/backend/db';
import { logger, auditLogger } from '../../../../core/backend/logger';
import { authService } from '../../../auth/backend/service/auth_service';
import type { Expense } from '../../../../core/types/enterprise_types';

export class ExpenseService {
  public getCategories() {
    return db.prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name ASC').all();
  }

  public createCategory(name: string) {
    authService.requireRole(['ADMIN', 'MANAGER', 'ACCOUNTANT']);
    db.prepare('INSERT OR IGNORE INTO expense_categories (name) VALUES (?)').run(name.trim());
    return this.getCategories();
  }

  public recordExpense(input: Partial<Expense>): Expense {
    const userId = authService.getCurrentUserId();
    const today = new Date().toISOString().split('T')[0];

    const result = db.prepare(`
      INSERT INTO expenses (store_id, category_id, vendor_name, amount_paise, gst_paise, payment_method, expense_date, notes, status, created_by)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?)
    `).run(
      input.category_id || 1,
      input.vendor_name || null,
      input.amount_paise || 0,
      input.gst_paise || 0,
      input.payment_method || 'Cash',
      input.expense_date || today,
      input.notes || null,
      userId
    );

    // Record in accounting ledger as well
    db.prepare(`
      INSERT INTO accounting_daily_ledger (store_id, date, account_type, reference_id, description, debit_paise, created_by)
      VALUES (1, ?, 'Expense', ?, ?, ?, ?)
    `).run(
      input.expense_date || today,
      `EXP-${result.lastInsertRowid}`,
      `Expense: ${input.notes || 'General Expense'}`,
      input.amount_paise || 0,
      userId
    );

    auditLogger.log(userId, 'EXPENSE_RECORDED', { amountPaise: input.amount_paise, vendor: input.vendor_name });
    logger.info('Expense recorded', { amountPaise: input.amount_paise });
    return db.prepare('SELECT e.*, c.name as category_name FROM expenses e LEFT JOIN expense_categories c ON e.category_id = c.id WHERE e.id = ?').get(result.lastInsertRowid) as Expense;
  }

  public getExpenses(): Expense[] {
    return db.prepare(`
      SELECT e.*, c.name as category_name
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.is_active = 1
      ORDER BY e.id DESC LIMIT 100
    `).all() as Expense[];
  }
}

export const expenseService = new ExpenseService();
