import { db } from '../../../../core/backend/db';
import { logger, auditLogger } from '../../../../core/backend/logger';
import { authService } from '../../../auth/backend/service/auth_service';
import type { 
  PosSession, 
  ShiftCashMovement, 
  ShiftClosingRecord, 
  ShiftCorrection, 
  ShiftSummaryItem,
  ShiftMovementType 
} from '../../../../core/types/enterprise_types';

export interface ShiftMovementInput {
  movement_type: ShiftMovementType;
  category: string;
  amount_paise: number;
  reason: string;
  added_by?: string;
  taken_by?: string;
  expense_category_id?: number;
}

export interface ShiftClosingInput {
  sessionId: number;
  closingCashPaise: number;
  denominations?: Record<string, number>;
  declaredReason?: string;
  notes?: string;
}

export interface ShiftCorrectionInput {
  sessionId: number;
  movementId?: number;
  action: 'update_movement' | 'delete_movement' | 'adjust_closing';
  amount_paise?: number;
  category?: string;
  reason: string;
  authPinOrPassword?: string;
}

export interface ShiftHistoryFilter {
  startDate?: string;
  endDate?: string;
  cashierId?: number;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CashBoxService {
  /**
   * Calculates live expected cash from the unified formula:
   * Expected = Opening Float + Cash Sales + Cash In - Cash Expenses - Cash Refunds - Cash Out
   */
  public calculateExpectedCash(sessionId: number): {
    openingCashPaise: number;
    cashSalesPaise: number;
    cashInPaise: number;
    cashExpensesPaise: number;
    cashRefundsPaise: number;
    cashOutPaise: number;
    expectedCashPaise: number;
  } {
    const session = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(sessionId) as PosSession | undefined;
    if (!session) {
      return {
        openingCashPaise: 0,
        cashSalesPaise: 0,
        cashInPaise: 0,
        cashExpensesPaise: 0,
        cashRefundsPaise: 0,
        cashOutPaise: 0,
        expectedCashPaise: 0,
      };
    }

    const openingCashPaise = session.opening_cash_paise || 0;

    // 1. Cash Sales from store_cash_box
    const salesRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM store_cash_box
      WHERE session_id = ? AND type = 'CASH_SALE' AND is_active = 1
    `).get(sessionId) as { total: number };
    const cashSalesPaise = salesRow?.total || 0;

    // 2. Cash In from shift_cash_movements
    const cashInRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM shift_cash_movements
      WHERE session_id = ? AND movement_type = 'cash_in' AND is_active = 1
    `).get(sessionId) as { total: number };
    const cashInPaise = cashInRow?.total || 0;

    // 3. Cash Expenses from shift_cash_movements (and store_cash_box CASH_EXPENSE)
    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM shift_cash_movements
      WHERE session_id = ? AND movement_type = 'expense' AND is_active = 1
    `).get(sessionId) as { total: number };
    const cashExpensesPaise = expenseRow?.total || 0;

    // 4. Cash Refunds from store_cash_box
    const refundRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM store_cash_box
      WHERE session_id = ? AND type = 'CASH_REFUND' AND is_active = 1
    `).get(sessionId) as { total: number };
    const cashRefundsPaise = refundRow?.total || 0;

    // 5. Cash Out from shift_cash_movements (and withdrawals)
    const cashOutRow = db.prepare(`
      SELECT COALESCE(SUM(amount_paise), 0) as total
      FROM shift_cash_movements
      WHERE session_id = ? AND movement_type = 'cash_out' AND is_active = 1
    `).get(sessionId) as { total: number };
    const cashOutPaise = cashOutRow?.total || 0;

    const expectedCashPaise = openingCashPaise + cashSalesPaise + cashInPaise - cashExpensesPaise - cashRefundsPaise - cashOutPaise;

    return {
      openingCashPaise,
      cashSalesPaise,
      cashInPaise,
      cashExpensesPaise,
      cashRefundsPaise,
      cashOutPaise,
      expectedCashPaise,
    };
  }

  /**
   * Computes Non-Cash sales summary for a session (UPI, Card, Credit)
   */
  public calculateNonCashSummary(sessionId: number): {
    upiSalesPaise: number;
    upiCount: number;
    cardSalesPaise: number;
    cardCount: number;
    creditSalesPaise: number;
    creditCount: number;
    totalNonCashPaise: number;
  } {
    const session = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(sessionId) as PosSession | undefined;
    if (!session) {
      return { upiSalesPaise: 0, upiCount: 0, cardSalesPaise: 0, cardCount: 0, creditSalesPaise: 0, creditCount: 0, totalNonCashPaise: 0 };
    }

    const timeClause = session.closed_at 
      ? 'AND (i.completed_at >= ? AND i.completed_at <= ?)' 
      : 'AND i.completed_at >= ?';
    const params = session.closed_at 
      ? [session.cashier_id, session.opened_at, session.closed_at] 
      : [session.cashier_id, session.opened_at];

    const payments = db.prepare(`
      SELECT p.method, COALESCE(SUM(p.amount_paise), 0) as total, COUNT(p.id) as count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      WHERE i.status = 'completed' AND i.created_by = ? ${timeClause}
      GROUP BY p.method
    `).all(...params) as Array<{ method: string; total: number; count: number }>;

    let upiSalesPaise = 0, upiCount = 0;
    let cardSalesPaise = 0, cardCount = 0;
    let creditSalesPaise = 0, creditCount = 0;

    payments.forEach(p => {
      const m = (p.method || '').toLowerCase();
      if (m.includes('upi') || m.includes('qr') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm')) {
        upiSalesPaise += p.total;
        upiCount += p.count;
      } else if (m.includes('card') || m.includes('pos') || m.includes('debit') || m.includes('credit_card')) {
        cardSalesPaise += p.total;
        cardCount += p.count;
      } else if (m.includes('credit') || m.includes('ar') || m.includes('customer')) {
        creditSalesPaise += p.total;
        creditCount += p.count;
      }
    });

    return {
      upiSalesPaise,
      upiCount,
      cardSalesPaise,
      cardCount,
      creditSalesPaise,
      creditCount,
      totalNonCashPaise: upiSalesPaise + cardSalesPaise + creditSalesPaise,
    };
  }

  public getCurrentSession(): PosSession | null {
    const cashierId = authService.getCurrentUserId();
    return (db.prepare("SELECT * FROM pos_sessions WHERE cashier_id = ? AND status = 'Open' ORDER BY id DESC LIMIT 1").get(cashierId) as PosSession) || null;
  }

  public openSession(openingCashPaise: number, denominations?: Record<string, number>): PosSession {
    const cashierId = authService.getCurrentUserId();
    const existing = this.getCurrentSession();
    if (existing) return existing;

    if (!Number.isSafeInteger(openingCashPaise) || openingCashPaise < 0) throw new Error('Invalid opening cash float');
    
    return db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO pos_sessions (store_id, cashier_id, opening_cash_paise, opening_denominations_json, status, created_by)
        VALUES (1, ?, ?, ?, 'Open', ?)
      `).run(cashierId, openingCashPaise, JSON.stringify(denominations ?? {}), cashierId);
      
      const sessionId = Number(result.lastInsertRowid);

      if (openingCashPaise > 0) {
        db.prepare(`
          INSERT INTO store_cash_box
          (store_id, session_id, type, direction, amount_paise, category, reason, denomination_snapshot_json, expected_before_paise, expected_after_paise, performed_by, created_by)
          VALUES (1, ?, 'OPENING_BALANCE', 'IN', ?, 'Opening float', 'Counted opening cash', ?, 0, ?, ?, ?)
        `).run(sessionId, openingCashPaise, JSON.stringify(denominations ?? {}), openingCashPaise, cashierId, cashierId);
      }

      auditLogger.log(cashierId, 'CASHBOX_OPEN_SESSION', { sessionId, openingCashPaise });
      logger.info('POS shift session opened', { cashierId, sessionId, openingCashPaise });
      return db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(sessionId) as PosSession;
    })();
  }

  /**
   * Section A: Record real categorized cash movement (Cash In, Cash Out, Shop Expense)
   */
  public recordMovement(input: ShiftMovementInput): { success: boolean; movement: ShiftCashMovement; liveExpectedCashPaise: number } {
    const cashierId = authService.getCurrentUserId();
    const session = this.getCurrentSession();
    if (!session) throw new Error('Open a cash shift before recording cash movements');

    if (!Number.isSafeInteger(input.amount_paise) || input.amount_paise <= 0) {
      throw new Error('Cash movement amount must be a positive whole number of paise');
    }
    if (!input.reason?.trim()) {
      throw new Error('Reason / description is mandatory for all cash movements');
    }

    const today = new Date().toISOString().split('T')[0];

    return db.transaction(() => {
      let expenseId: number | null = null;

      // 1. If Expense, sync with store expenses table and daily ledger
      if (input.movement_type === 'expense') {
        const expResult = db.prepare(`
          INSERT INTO expenses (store_id, category_id, vendor_name, amount_paise, gst_paise, payment_method, expense_date, notes, status, created_by)
          VALUES (1, ?, ?, ?, 0, 'Cash', ?, ?, 'Approved', ?)
        `).run(
          input.expense_category_id || 1,
          input.taken_by || null,
          input.amount_paise,
          today,
          `Shift #${session.id} Expense (${input.category}): ${input.reason.trim()}`,
          cashierId
        );
        expenseId = Number(expResult.lastInsertRowid);

        db.prepare(`
          INSERT INTO accounting_daily_ledger (store_id, date, account_type, reference_id, description, debit_paise, created_by)
          VALUES (1, ?, 'Expense', ?, ?, ?, ?)
        `).run(
          today,
          `EXP-SHIFT-${session.id}-${expenseId}`,
          `Shift #${session.id} Expense: ${input.reason.trim()}`,
          input.amount_paise,
          cashierId
        );
      }

      // 2. Insert into shift_cash_movements
      const moveResult = db.prepare(`
        INSERT INTO shift_cash_movements
        (store_id, session_id, movement_type, category, amount_paise, reason, added_by, taken_by, expense_id, is_active, created_by)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        session.id,
        input.movement_type,
        input.category.trim() || input.movement_type,
        input.amount_paise,
        input.reason.trim(),
        input.added_by?.trim() || null,
        input.taken_by?.trim() || null,
        expenseId,
        cashierId
      );
      const movementId = Number(moveResult.lastInsertRowid);

      // 3. Mirror into store_cash_box for unified transaction view
      const direction = input.movement_type === 'cash_in' ? 'IN' : 'OUT';
      const boxType = input.movement_type === 'cash_in' ? 'CASH_IN' : input.movement_type === 'expense' ? 'CASH_EXPENSE' : 'CASH_WITHDRAWAL';
      
      const before = this.calculateExpectedCash(session.id).expectedCashPaise - (direction === 'IN' ? input.amount_paise : -input.amount_paise);
      const after = before + (direction === 'IN' ? input.amount_paise : -input.amount_paise);

      db.prepare(`
        INSERT INTO store_cash_box
        (store_id, session_id, type, direction, amount_paise, category, reason, reference_type, reference_id, expected_before_paise, expected_after_paise, performed_by, created_by)
        VALUES (1, ?, ?, ?, ?, ?, ?, 'SHIFT_MOVEMENT', ?, ?, ?, ?, ?)
      `).run(
        session.id,
        boxType,
        direction,
        input.amount_paise,
        input.category.trim(),
        input.reason.trim(),
        String(movementId),
        before,
        after,
        cashierId,
        cashierId
      );

      const liveExpected = this.calculateExpectedCash(session.id).expectedCashPaise;

      auditLogger.log(cashierId, 'SHIFT_RECORD_MOVEMENT', {
        sessionId: session.id,
        movementId,
        movementType: input.movement_type,
        amountPaise: input.amount_paise,
        category: input.category,
      });

      const movement = db.prepare('SELECT * FROM shift_cash_movements WHERE id = ?').get(movementId) as ShiftCashMovement;
      return { success: true, movement, liveExpectedCashPaise: liveExpected };
    })();
  }

  /**
   * Edit movement on a still-OPEN shift directly
   */
  public updateOpenMovement(movementId: number, input: Partial<ShiftMovementInput>): ShiftCashMovement {
    const cashierId = authService.getCurrentUserId();
    const movement = db.prepare('SELECT * FROM shift_cash_movements WHERE id = ?').get(movementId) as ShiftCashMovement | undefined;
    if (!movement) throw new Error('Shift movement not found');

    const session = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(movement.session_id) as PosSession | undefined;
    if (!session || session.status !== 'Open') {
      throw new Error('Direct editing is locked on closed shifts. Use the Correction action instead.');
    }

    return db.transaction(() => {
      const newAmount = input.amount_paise !== undefined ? input.amount_paise : movement.amount_paise;
      const newCategory = input.category !== undefined ? input.category.trim() : movement.category;
      const newReason = input.reason !== undefined ? input.reason.trim() : movement.reason;
      const newAddedBy = input.added_by !== undefined ? input.added_by.trim() : movement.added_by;
      const newTakenBy = input.taken_by !== undefined ? input.taken_by.trim() : movement.taken_by;

      if (!Number.isSafeInteger(newAmount) || newAmount <= 0) throw new Error('Invalid cash amount');
      if (!newReason) throw new Error('Reason cannot be blank');

      db.prepare(`
        UPDATE shift_cash_movements
        SET amount_paise = ?, category = ?, reason = ?, added_by = ?, taken_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newAmount, newCategory, newReason, newAddedBy, newTakenBy, movementId);

      // Update linked store_cash_box
      db.prepare(`
        UPDATE store_cash_box
        SET amount_paise = ?, category = ?, reason = ?
        WHERE session_id = ? AND reference_type = 'SHIFT_MOVEMENT' AND reference_id = ?
      `).run(newAmount, newCategory, newReason, movement.session_id, String(movementId));

      // Update linked expense if applicable
      if (movement.expense_id) {
        db.prepare('UPDATE expenses SET amount_paise = ?, notes = ? WHERE id = ?').run(newAmount, newReason, movement.expense_id);
        db.prepare("UPDATE accounting_daily_ledger SET debit_paise = ?, description = ? WHERE reference_id = ?").run(
          newAmount,
          `Shift #${session.id} Expense: ${newReason}`,
          `EXP-SHIFT-${session.id}-${movement.expense_id}`
        );
      }

      auditLogger.log(cashierId, 'SHIFT_UPDATE_OPEN_MOVEMENT', { movementId, newAmount });
      return db.prepare('SELECT * FROM shift_cash_movements WHERE id = ?').get(movementId) as ShiftCashMovement;
    })();
  }

  /**
   * Delete movement on a still-OPEN shift directly
   */
  public deleteOpenMovement(movementId: number): { success: boolean } {
    const cashierId = authService.getCurrentUserId();
    const movement = db.prepare('SELECT * FROM shift_cash_movements WHERE id = ?').get(movementId) as ShiftCashMovement | undefined;
    if (!movement) throw new Error('Shift movement not found');

    const session = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(movement.session_id) as PosSession | undefined;
    if (!session || session.status !== 'Open') {
      throw new Error('Direct deletion is locked on closed shifts. Use the Correction action instead.');
    }

    return db.transaction(() => {
      db.prepare('UPDATE shift_cash_movements SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(movementId);
      db.prepare("UPDATE store_cash_box SET is_active = 0 WHERE session_id = ? AND reference_type = 'SHIFT_MOVEMENT' AND reference_id = ?").run(
        movement.session_id,
        String(movementId)
      );

      if (movement.expense_id) {
        db.prepare("UPDATE expenses SET status = 'Rejected', is_active = 0 WHERE id = ?").run(movement.expense_id);
      }

      auditLogger.log(cashierId, 'SHIFT_DELETE_OPEN_MOVEMENT', { movementId, sessionId: session.id });
      return { success: true };
    })();
  }

  /**
   * Section B: Step-by-Step Shift Closing Flow
   */
  public closeSession(input: ShiftClosingInput): { session: PosSession; closingRecord: ShiftClosingRecord } {
    const cashierId = authService.getCurrentUserId();
    const session = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(input.sessionId) as PosSession | undefined;
    if (!session || session.status !== 'Open') throw new Error('Only an open shift can be closed');

    if (!Number.isSafeInteger(input.closingCashPaise) || input.closingCashPaise < 0) {
      throw new Error('Invalid physical cash count');
    }

    const calculation = this.calculateExpectedCash(input.sessionId);
    const expectedCashPaise = calculation.expectedCashPaise;
    const differencePaise = input.closingCashPaise - expectedCashPaise;
    const isMatched = differencePaise === 0;

    if (!isMatched && !input.declaredReason?.trim()) {
      throw new Error('A declared reason is strictly required when counted physical cash differs from expected cash');
    }

    const nonCash = this.calculateNonCashSummary(input.sessionId);
    const closingStatus = isMatched ? 'matched' : 'explained_difference';
    const now = new Date().toISOString();

    return db.transaction(() => {
      // 1. Insert or Replace Shift Closing Record
      db.prepare(`
        INSERT INTO shift_closing_records
        (store_id, session_id, expected_cash_paise, physical_cash_paise, difference_paise, status, declared_reason, closing_denominations_json, non_cash_summary_json, closed_by, closed_at, notes)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          expected_cash_paise = excluded.expected_cash_paise,
          physical_cash_paise = excluded.physical_cash_paise,
          difference_paise = excluded.difference_paise,
          status = excluded.status,
          declared_reason = excluded.declared_reason,
          closing_denominations_json = excluded.closing_denominations_json,
          non_cash_summary_json = excluded.non_cash_summary_json,
          closed_by = excluded.closed_by,
          closed_at = excluded.closed_at,
          notes = excluded.notes,
          updated_at = CURRENT_TIMESTAMP
      `).run(
        session.id,
        expectedCashPaise,
        input.closingCashPaise,
        differencePaise,
        closingStatus,
        input.declaredReason?.trim() || null,
        JSON.stringify(input.denominations ?? {}),
        JSON.stringify(nonCash),
        cashierId,
        now,
        input.notes?.trim() || null
      );

      // 2. Update pos_sessions
      db.prepare(`
        UPDATE pos_sessions
        SET closed_at = ?, closing_cash_paise = ?, closing_denominations_json = ?, expected_cash_paise = ?, variance_paise = ?, variance_reason = ?, status = 'Closed', notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        now,
        input.closingCashPaise,
        JSON.stringify(input.denominations ?? {}),
        expectedCashPaise,
        differencePaise,
        input.declaredReason?.trim() || null,
        input.notes?.trim() || null,
        session.id
      );

      auditLogger.log(cashierId, 'SHIFT_CLOSE_SESSION', {
        sessionId: session.id,
        closingCashPaise: input.closingCashPaise,
        expectedCashPaise,
        differencePaise,
        closingStatus,
      });

      logger.info('POS shift session successfully closed and locked', {
        sessionId: session.id,
        differencePaise,
        status: closingStatus,
      });

      const updatedSession = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(session.id) as PosSession;
      const closingRecord = db.prepare('SELECT * FROM shift_closing_records WHERE session_id = ?').get(session.id) as ShiftClosingRecord;
      return { session: updatedSession, closingRecord };
    })();
  }

  /**
   * Section C: Filterable Shift History List
   */
  public getShiftHistory(filter: ShiftHistoryFilter = {}): { shifts: ShiftSummaryItem[]; total: number } {
    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (filter.startDate) {
      where += ' AND DATE(ps.opened_at) >= DATE(?)';
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      where += ' AND DATE(ps.opened_at) <= DATE(?)';
      params.push(filter.endDate);
    }
    if (filter.cashierId) {
      where += ' AND ps.cashier_id = ?';
      params.push(filter.cashierId);
    }
    if (filter.status && filter.status !== 'ALL') {
      if (filter.status === 'Open') {
        where += " AND ps.status = 'Open'";
      } else {
        where += ' AND scr.status = ?';
        params.push(filter.status);
      }
    }
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      where += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR u.emp_code LIKE ? OR ps.id LIKE ?)';
      params.push(term, term, term, term);
    }

    const countRow = db.prepare(`
      SELECT COUNT(DISTINCT ps.id) as total
      FROM pos_sessions ps
      LEFT JOIN users u ON u.id = ps.cashier_id
      LEFT JOIN shift_closing_records scr ON scr.session_id = ps.id
      ${where}
    `).get(...params) as { total: number };

    const limit = Math.min(filter.limit || 50, 200);
    const offset = Math.max(filter.offset || 0, 0);

    const rows = db.prepare(`
      SELECT 
        ps.id,
        ps.id as session_id,
        ps.cashier_id,
        COALESCE(u.full_name, u.username, 'Cashier #' || ps.cashier_id) as cashier_name,
        COALESCE(u.emp_code, u.code, 'EMP-' || ps.cashier_id) as cashier_code,
        ps.opened_at,
        ps.closed_at,
        ps.status,
        COALESCE(scr.status, ps.status) as reconciliation_status,
        ps.opening_cash_paise,
        COALESCE((SELECT SUM(amount_paise) FROM store_cash_box WHERE session_id = ps.id AND type = 'CASH_SALE' AND is_active = 1), 0) as cash_sales_paise,
        COALESCE((SELECT SUM(amount_paise) FROM shift_cash_movements WHERE session_id = ps.id AND movement_type = 'cash_in' AND is_active = 1), 0) as cash_in_paise,
        COALESCE((SELECT SUM(amount_paise) FROM shift_cash_movements WHERE session_id = ps.id AND movement_type = 'expense' AND is_active = 1), 0) as cash_expenses_paise,
        COALESCE((SELECT SUM(amount_paise) FROM store_cash_box WHERE session_id = ps.id AND type = 'CASH_REFUND' AND is_active = 1), 0) as cash_refunds_paise,
        COALESCE((SELECT SUM(amount_paise) FROM shift_cash_movements WHERE session_id = ps.id AND movement_type = 'cash_out' AND is_active = 1), 0) as cash_out_paise,
        COALESCE(scr.expected_cash_paise, ps.expected_cash_paise, ps.opening_cash_paise) as expected_cash_paise,
        COALESCE(scr.physical_cash_paise, ps.closing_cash_paise) as physical_cash_paise,
        COALESCE(scr.difference_paise, ps.variance_paise) as difference_paise,
        COALESCE(scr.declared_reason, ps.variance_reason) as declared_reason,
        (SELECT COUNT(*) FROM shift_corrections WHERE session_id = ps.id) as has_corrections
      FROM pos_sessions ps
      LEFT JOIN users u ON u.id = ps.cashier_id
      LEFT JOIN shift_closing_records scr ON scr.session_id = ps.id
      ${where}
      ORDER BY ps.opened_at DESC, ps.id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as ShiftSummaryItem[];

    return { shifts: rows, total: countRow?.total || 0 };
  }

  /**
   * Section C: Full Shift Drill-down Details
   */
  public getShiftDetails(sessionId: number) {
    const session = db.prepare(`
      SELECT ps.*, COALESCE(u.full_name, u.username) as cashier_name, u.emp_code as cashier_code
      FROM pos_sessions ps
      LEFT JOIN users u ON u.id = ps.cashier_id
      WHERE ps.id = ?
    `).get(sessionId) as any;
    if (!session) throw new Error(`Shift #${sessionId} not found`);

    const closingRecord = db.prepare(`
      SELECT scr.*, COALESCE(u.full_name, u.username) as closed_by_name
      FROM shift_closing_records scr
      LEFT JOIN users u ON u.id = scr.closed_by
      WHERE scr.session_id = ?
    `).get(sessionId) as ShiftClosingRecord | undefined;

    const movements = db.prepare(`
      SELECT scm.*, COALESCE(u.full_name, u.username) as created_by_name
      FROM shift_cash_movements scm
      LEFT JOIN users u ON u.id = scm.created_by
      WHERE scm.session_id = ? AND scm.is_active = 1
      ORDER BY scm.created_at ASC
    `).all(sessionId) as ShiftCashMovement[];

    const corrections = db.prepare(`
      SELECT sc.*, COALESCE(ua.full_name, ua.username) as authorized_by_name, COALESCE(uc.full_name, uc.username) as created_by_name
      FROM shift_corrections sc
      LEFT JOIN users ua ON ua.id = sc.authorized_by
      LEFT JOIN users uc ON uc.id = sc.created_by
      WHERE sc.session_id = ?
      ORDER BY sc.created_at ASC
    `).all(sessionId) as ShiftCorrection[];

    const transactions = this.getShiftTransactions(sessionId);
    const nonCash = this.calculateNonCashSummary(sessionId);
    const liveExpected = this.calculateExpectedCash(sessionId);

    return {
      session,
      closingRecord: closingRecord || null,
      movements,
      corrections,
      transactions,
      nonCashSummary: nonCash,
      liveExpected,
    };
  }

  /**
   * Section C: Safe Manager Corrections on Closed Shifts
   */
  public applyShiftCorrection(input: ShiftCorrectionInput): { success: boolean; recalculatedExpectedPaise: number; differencePaise: number } {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const managerId = authService.getCurrentUserId();

    if (!input.reason?.trim()) {
      throw new Error('A detailed reason is mandatory for auditing historical shift corrections');
    }

    const session = db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(input.sessionId) as PosSession | undefined;
    if (!session) throw new Error('Shift session not found');

    return db.transaction(() => {
      if (input.action === 'update_movement' && input.movementId) {
        const movement = db.prepare('SELECT * FROM shift_cash_movements WHERE id = ?').get(input.movementId) as ShiftCashMovement | undefined;
        if (!movement) throw new Error('Movement not found');

        const origAmount = movement.amount_paise;
        const newAmount = input.amount_paise !== undefined ? input.amount_paise : origAmount;
        const origCategory = movement.category;
        const newCategory = input.category || origCategory;

        // 1. Audit log in shift_corrections
        db.prepare(`
          INSERT INTO shift_corrections
          (store_id, session_id, entity_type, entity_id, field_name, original_value, new_value, reason, authorized_by, created_by)
          VALUES (1, ?, 'cash_movement', ?, 'amount_paise', ?, ?, ?, ?, ?)
        `).run(session.id, input.movementId, String(origAmount), String(newAmount), input.reason.trim(), managerId, managerId);

        // 2. Update movement
        db.prepare(`
          UPDATE shift_cash_movements
          SET amount_paise = ?, category = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newAmount, newCategory, input.movementId);

        // 3. Update store_cash_box
        db.prepare(`
          UPDATE store_cash_box
          SET amount_paise = ?, category = ?
          WHERE session_id = ? AND reference_type = 'SHIFT_MOVEMENT' AND reference_id = ?
        `).run(newAmount, newCategory, session.id, String(input.movementId));

        if (movement.expense_id) {
          db.prepare('UPDATE expenses SET amount_paise = ? WHERE id = ?').run(newAmount, movement.expense_id);
        }
      } else if (input.action === 'delete_movement' && input.movementId) {
        const movement = db.prepare('SELECT * FROM shift_cash_movements WHERE id = ?').get(input.movementId) as ShiftCashMovement | undefined;
        if (!movement) throw new Error('Movement not found');

        db.prepare(`
          INSERT INTO shift_corrections
          (store_id, session_id, entity_type, entity_id, field_name, original_value, new_value, reason, authorized_by, created_by)
          VALUES (1, ?, 'cash_movement', ?, 'is_active', '1', '0', ?, ?, ?)
        `).run(session.id, input.movementId, input.reason.trim(), managerId, managerId);

        db.prepare('UPDATE shift_cash_movements SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(input.movementId);
        db.prepare("UPDATE store_cash_box SET is_active = 0 WHERE session_id = ? AND reference_type = 'SHIFT_MOVEMENT' AND reference_id = ?").run(
          session.id,
          String(input.movementId)
        );

        if (movement.expense_id) {
          db.prepare("UPDATE expenses SET status = 'Rejected', is_active = 0 WHERE id = ?").run(movement.expense_id);
        }
      } else if (input.action === 'adjust_closing') {
        const closing = db.prepare('SELECT * FROM shift_closing_records WHERE session_id = ?').get(session.id) as ShiftClosingRecord | undefined;
        if (!closing) throw new Error('Closing record not found');

        const origCount = closing.physical_cash_paise;
        const newCount = input.amount_paise !== undefined ? input.amount_paise : origCount;

        db.prepare(`
          INSERT INTO shift_corrections
          (store_id, session_id, entity_type, entity_id, field_name, original_value, new_value, reason, authorized_by, created_by)
          VALUES (1, ?, 'closing_record', ?, 'physical_cash_paise', ?, ?, ?, ?, ?)
        `).run(session.id, closing.id, String(origCount), String(newCount), input.reason.trim(), managerId, managerId);

        db.prepare('UPDATE shift_closing_records SET physical_cash_paise = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(
          newCount,
          session.id
        );
      }

      // 4. Recalculate Expected Cash and Difference
      const recalc = this.calculateExpectedCash(session.id);
      const closing = db.prepare('SELECT * FROM shift_closing_records WHERE session_id = ?').get(session.id) as ShiftClosingRecord | undefined;
      const physicalCash = closing ? closing.physical_cash_paise : (session.closing_cash_paise || 0);
      const newDiff = physicalCash - recalc.expectedCashPaise;

      if (closing) {
        db.prepare(`
          UPDATE shift_closing_records
          SET expected_cash_paise = ?, difference_paise = ?, status = 'corrected', updated_at = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `).run(recalc.expectedCashPaise, newDiff, session.id);
      }

      db.prepare(`
        UPDATE pos_sessions
        SET expected_cash_paise = ?, variance_paise = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(recalc.expectedCashPaise, newDiff, session.id);

      auditLogger.log(managerId, 'SHIFT_APPLY_CORRECTION', {
        sessionId: session.id,
        action: input.action,
        newExpectedPaise: recalc.expectedCashPaise,
        newDifferencePaise: newDiff,
      });

      return {
        success: true,
        recalculatedExpectedPaise: recalc.expectedCashPaise,
        differencePaise: newDiff,
      };
    })();
  }

  /**
   * Inspection view: all shift transactions for Cashier Check View during shift closing
   */
  public getShiftTransactions(sessionId: number) {
    return db.prepare(`
      SELECT 
        id,
        type,
        direction,
        amount_paise,
        category,
        reason,
        reference_type,
        reference_id,
        invoice_id,
        created_at,
        CASE WHEN direction = 'IN' THEN amount_paise ELSE 0 END as cash_in_paise,
        CASE WHEN direction = 'OUT' THEN amount_paise ELSE 0 END as cash_out_paise
      FROM store_cash_box
      WHERE session_id = ? AND is_active = 1
      ORDER BY created_at DESC, id DESC
    `).all(sessionId);
  }

  /**
   * Dashboard & Legacy compatibility wrappers
   */
  public getDashboard(sessionId?: number) {
    const session: PosSession | null = sessionId
      ? (db.prepare('SELECT * FROM pos_sessions WHERE id = ?').get(sessionId) as PosSession | undefined) ?? null
      : this.getCurrentSession();
    if (!session) return null;

    const expected = this.calculateExpectedCash(session.id);
    const nonCash = this.calculateNonCashSummary(session.id);
    const recentMovements = db.prepare(`
      SELECT * FROM shift_cash_movements
      WHERE session_id = ? AND is_active = 1
      ORDER BY created_at DESC LIMIT 20
    `).all(session.id) as ShiftCashMovement[];

    return {
      session,
      expectedCashPaise: expected.expectedCashPaise,
      calculation: expected,
      nonCashSummary: nonCash,
      recentMovements,
      totals: {
        OPENING_BALANCE: expected.openingCashPaise,
        CASH_SALE: expected.cashSalesPaise,
        CASH_IN: expected.cashInPaise,
        CASH_EXPENSE: expected.cashExpensesPaise,
        CASH_REFUND: expected.cashRefundsPaise,
        CASH_WITHDRAWAL: expected.cashOutPaise,
      },
    };
  }

  public getTransactions(sessionId?: number, limit = 100, offset = 0) {
    const session = sessionId ? { id: sessionId } : this.getCurrentSession();
    if (!session) return [];
    return db.prepare(`
      SELECT *, 
        CASE WHEN direction = 'IN' THEN amount_paise ELSE 0 END as cash_in_paise, 
        CASE WHEN direction = 'OUT' THEN amount_paise ELSE 0 END as cash_out_paise 
      FROM store_cash_box 
      WHERE session_id = ? AND is_active = 1 
      ORDER BY created_at DESC, id DESC 
      LIMIT ? OFFSET ?
    `).all(session.id, Math.min(limit, 500), Math.max(0, offset));
  }

  public recordTransaction(type: string, amountPaise: number, category: string, reason: string) {
    const movementType: ShiftMovementType = type === 'CASH_IN' || type === 'ADJUSTMENT_IN' 
      ? 'cash_in' 
      : type === 'CASH_EXPENSE' 
      ? 'expense' 
      : 'cash_out';
    return this.recordMovement({
      movement_type: movementType,
      category,
      amount_paise: amountPaise,
      reason,
    });
  }

  public recordCashSale(invoiceId: number, invoiceNumber: string, cashAmountPaise: number, cashierId: number) {
    if (cashAmountPaise <= 0) return;
    const session = db.prepare("SELECT * FROM pos_sessions WHERE cashier_id = ? AND status = 'Open' ORDER BY id DESC LIMIT 1").get(cashierId) as PosSession | undefined;
    if (!session) throw new Error('An open cash shift is required for a cash payment');
    const exists = db.prepare("SELECT id FROM store_cash_box WHERE invoice_id = ? AND type = 'CASH_SALE'").get(invoiceId);
    if (exists) return;

    db.prepare(`
      INSERT INTO store_cash_box
      (store_id, session_id, type, direction, amount_paise, category, reason, reference_type, reference_id, invoice_id, performed_by, created_by)
      VALUES (1, ?, 'CASH_SALE', 'IN', ?, 'Billing', ?, 'INVOICE', ?, ?, ?, ?)
    `).run(session.id, cashAmountPaise, `Cash sale for Bill #${invoiceNumber}`, invoiceNumber, invoiceId, cashierId, cashierId);
  }

  public recordCashRefund(invoiceId: number, invoiceNumber: string, amountPaise: number, reason: string, cashierId: number) {
    const session = this.getCurrentSession();
    if (session) {
      db.prepare(`
        INSERT INTO store_cash_box
        (store_id, session_id, type, direction, amount_paise, category, reason, reference_type, reference_id, invoice_id, performed_by, created_by)
        VALUES (1, ?, 'CASH_REFUND', 'OUT', ?, 'Sales return', ?, 'INVOICE_RETURN', ?, ?, ?, ?)
      `).run(session.id, amountPaise, `Cash refund for Bill #${invoiceNumber}: ${reason}`, invoiceNumber, invoiceId, cashierId, cashierId);
    } else {
      logger.warn('Cash refund processed without an active cash shift session', { invoiceId, invoiceNumber, amountPaise, cashierId });
    }
  }

  public recordCashAdvance(advanceId: number, amountPaise: number, employeeName: string, cashierId: number) {
    if (amountPaise <= 0) return;
    const session = db.prepare("SELECT * FROM pos_sessions WHERE status = 'Open' ORDER BY id DESC LIMIT 1").get() as PosSession | undefined;
    if (session) {
      db.prepare(`
        INSERT INTO store_cash_box
        (store_id, session_id, type, direction, amount_paise, category, reason, reference_type, reference_id, performed_by, created_by)
        VALUES (1, ?, 'CASH_EXPENSE', 'OUT', ?, 'Salary Advance', ?, 'EMPLOYEE_ADVANCE', ?, ?, ?)
      `).run(session.id, amountPaise, `Salary Advance for ${employeeName} (Ref #${advanceId})`, String(advanceId), cashierId, cashierId);
      logger.info('Cash advance recorded in cash box', { advanceId, amountPaise, employeeName });
    } else {
      logger.warn('Cash advance issued without an active open cash shift session', { advanceId, amountPaise, employeeName });
    }
  }
}

export const cashBoxService = new CashBoxService();
