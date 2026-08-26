import { db } from '../../../../core/backend/db';
import type { AccountingLedgerEntry, EnterpriseAuditLog } from '../../../../core/types/enterprise_types';

export class LedgerService {
  public getAccountingEntries(accountType?: string): AccountingLedgerEntry[] {
    if (accountType && accountType !== 'All') {
      return db.prepare('SELECT * FROM accounting_daily_ledger WHERE account_type = ? ORDER BY id DESC LIMIT 100').all(accountType) as AccountingLedgerEntry[];
    }
    return db.prepare('SELECT * FROM accounting_daily_ledger ORDER BY id DESC LIMIT 100').all() as AccountingLedgerEntry[];
  }

  public getAuditLogs(): EnterpriseAuditLog[] {
    return db.prepare('SELECT * FROM enterprise_audit_logs ORDER BY id DESC LIMIT 100').all() as EnterpriseAuditLog[];
  }
}

export const ledgerService = new LedgerService();
