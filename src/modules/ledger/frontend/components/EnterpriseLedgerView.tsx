import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search, Download, ShieldCheck } from 'lucide-react';
import type { AccountingLedgerEntry, EnterpriseAuditLog } from '../../../../core/types/enterprise_types';

export default function EnterpriseLedgerView() {
  const [filterAccount, setFilterAccount] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'ledgers' | 'audit'>('ledgers');

  const { data: entries = [] } = useQuery<AccountingLedgerEntry[]>({
    queryKey: ['ledgers', filterAccount],
    queryFn: async () => {
      const res = await window.api.invoke('ledgers:get-entries', { accountType: filterAccount });
      return (res && res.success && Array.isArray(res.data)) ? res.data : [];
    },
  });

  const { data: auditLogs = [] } = useQuery<EnterpriseAuditLog[]>({
    queryKey: ['audit', 'logs'],
    queryFn: async () => {
      const res = await window.api.invoke('audit:get-logs');
      return (res && res.success && Array.isArray(res.data)) ? res.data : [];
    },
  });

  const safeEntries = Array.isArray(entries) ? entries : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];

  const filteredEntries = safeEntries.filter(e =>
    e?.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e?.reference_id && e.reference_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-surface-app text-text-primary p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle pb-4 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black font-outfit text-text-primary flex items-center gap-2">
            <BookOpen className="text-brand-500" size={24} />
            <span>Enterprise Accounting Daily Ledgers & Audit Log</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Double-entry style financial ledger accounting across cash, sales, purchases, expenses, supplier settlements, and security audit logs.
          </p>
        </div>

        <button
          onClick={async () => {
            await window.api.invoke('system:export-csv', { type: 'ledger' });
          }}
          className="btn-secondary px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-elevation"
        >
          <Download size={15} /> Export Ledger CSV
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('ledgers')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'ledgers' ? 'border-brand-500 text-brand-500 font-black' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <BookOpen size={14} /> Accounting Daily Ledgers
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`py-2 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'audit' ? 'border-brand-500 text-brand-500 font-black' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <ShieldCheck size={14} /> Enterprise Audit Logs ({safeAuditLogs.length})
          </button>
        </div>

        {activeSubTab === 'ledgers' && (
          <div className="flex items-center gap-3">
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="bg-surface-card border border-border-subtle rounded px-3 py-1.5 text-xs font-bold text-text-primary"
            >
              <option value="All">All Account Types</option>
              <option value="Cash">Cash Account</option>
              <option value="Sales">Sales Account</option>
              <option value="Purchase">Purchase Account</option>
              <option value="Expense">Expense Account</option>
              <option value="Supplier">Supplier Ledger</option>
              <option value="Customer">Customer Credit Account</option>
              <option value="Variance">Cash Variance Ledger</option>
            </select>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search description..."
                className="pl-8 pr-3 py-1.5 bg-surface-card border border-border-subtle rounded text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-surface-panel border border-border-subtle rounded-xl overflow-hidden shadow-elevation">
        {activeSubTab === 'ledgers' ? (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-surface-card border-b border-border-subtle text-[10px] text-text-muted font-bold uppercase">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Account Type</th>
                <th className="p-3">Ref ID</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Debit (₹)</th>
                <th className="p-3 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-text-muted">
                    No ledger entries found.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-surface-card/40">
                    <td className="p-3 font-bold">{entry.date}</td>
                    <td className="p-3 font-bold text-brand-500">{entry.account_type}</td>
                    <td className="p-3 text-text-muted">{entry.reference_id || '-'}</td>
                    <td className="p-3 text-text-primary">{entry.description}</td>
                    <td className="p-3 text-right font-bold text-red-400">
                      {entry.debit_paise > 0 ? `₹${(entry.debit_paise / 100).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-brand-500">
                      {entry.credit_paise > 0 ? `₹${(entry.credit_paise / 100).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-surface-card border-b border-border-subtle text-[10px] text-text-muted font-bold uppercase">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">User</th>
                <th className="p-3">Module</th>
                <th className="p-3">Action</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {safeAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-text-muted">
                    No audit logs recorded yet.
                  </td>
                </tr>
              ) : (
                safeAuditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-surface-card/40">
                    <td className="p-3 text-text-muted">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="p-3 font-bold text-brand-500">{log.username || `User #${log.user_id}`}</td>
                    <td className="p-3 font-bold">{log.module}</td>
                    <td className="p-3 font-bold text-amber-400">{log.action}</td>
                    <td className="p-3 text-text-secondary">{log.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
