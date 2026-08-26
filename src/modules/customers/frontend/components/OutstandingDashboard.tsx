import { useState } from 'react';
import {
  TrendingDown, TrendingUp, Users, AlertCircle, ArrowRight,
  Wallet, CheckCircle2
} from 'lucide-react';
import { useARReports } from '../hooks/useCustomerLedger';
import { formatPaise } from '../types/customer.types';

interface OutstandingDashboardProps {
  onSelectCustomer?: (customerId: number) => void;
}

export default function OutstandingDashboard({ onSelectCustomer }: OutstandingDashboardProps) {
  const { useOutstandingReport, useTopDebtors, useOverdueReport, useAdvanceReport, useCollectionReport } = useARReports();

  const today = new Date().toISOString().split('T')[0];
  const firstOfMonth = `${today.slice(0, 7)}-01`;

  const { data: outstanding } = useOutstandingReport();
  const { data: topDebtors } = useTopDebtors(8);
  const { data: overdue } = useOverdueReport();
  const { data: advances } = useAdvanceReport();
  const { data: collectionToday } = useCollectionReport(today, today);
  const { data: collectionMonth } = useCollectionReport(firstOfMonth, today);

  const [tab, setTab] = useState<'outstanding' | 'overdue' | 'advance'>('outstanding');

  const rows: any[] = (outstanding as any) ?? [];
  const overdueRows: any[] = (overdue as any) ?? [];
  const advanceRows: any[] = (advances as any) ?? [];
  const topRows: any[] = (topDebtors as any) ?? [];

  const totalOutstanding = rows.reduce((s: number, r: any) => s + r.outstanding_balance_paise, 0);
  const totalAdvance = advanceRows.reduce((s: number, r: any) => s + r.advance_balance_paise, 0);
  const overdueCount = overdueRows.length;
  const todayCollected = (collectionToday as any)?.total_collected_paise ?? 0;
  const monthCollected = (collectionMonth as any)?.total_collected_paise ?? 0;

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Accounts Receivable Dashboard</h2>
        <p className="text-xs text-text-secondary mt-0.5">Live outstanding, collections, and advance positions</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {[
          {
            label: 'Total Outstanding', value: formatPaise(totalOutstanding),
            icon: <TrendingDown size={18} />, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20'
          },
          {
            label: 'Overdue Customers', value: String(overdueCount),
            icon: <AlertCircle size={18} />, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20'
          },
          {
            label: 'Advance Balances', value: formatPaise(totalAdvance),
            icon: <Wallet size={18} />, color: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500/20'
          },
          {
            label: "Collected Today", value: formatPaise(todayCollected),
            icon: <TrendingUp size={18} />, color: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500/50'
          },
          {
            label: 'This Month', value: formatPaise(monthCollected),
            icon: <CheckCircle2 size={18} />, color: 'text-brand-500', bg: 'bg-brand-500/10', border: 'border-brand-500/50'
          },
        ].map((card, i) => (
          <div key={i} className={`bg-surface-panel border ${card.border} rounded-xl p-4`}>
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color} mb-3`}>
              {card.icon}
            </div>
            <p className="text-[11px] text-text-secondary">{card.label}</p>
            <p className={`text-base font-bold mt-1 ${card.color} font-mono`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Top Debtors */}
        <div className="col-span-2 bg-surface-panel border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Top Debtors</h3>
            <Users size={14} className="text-text-secondary" />
          </div>
          <div className="divide-y divide-border-subtle">
            {topRows.length === 0 ? (
              <div className="py-10 text-center text-text-secondary text-xs">No outstanding balances</div>
            ) : (
              topRows.map((r: any, i: number) => {
                const util = r.credit_limit_paise > 0 ? Math.round((r.outstanding_balance_paise / r.credit_limit_paise) * 100) : 0;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-app/40 cursor-pointer transition-colors group"
                    onClick={() => onSelectCustomer?.(r.id)}
                  >
                    <div className="w-6 text-center text-[10px] font-bold text-text-secondary">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-text-secondary">{r.customer_code} · {r.category}</div>
                      {r.credit_limit_paise > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 bg-surface-app rounded-full h-1">
                            <div
                              className={`h-full rounded-full ${util > 90 ? 'bg-red-500' : util > 70 ? 'bg-orange-500' : 'bg-brand-500'}`}
                              style={{ width: `${Math.min(100, util)}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-text-secondary">{util}% used</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-red-400">{formatPaise(r.outstanding_balance_paise)}</div>
                      {r.phone && <div className="text-[10px] text-text-secondary">{r.phone}</div>}
                    </div>
                    <ArrowRight size={12} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tabs Panel */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden flex flex-col">
          <div className="flex border-b border-border-subtle">
            {(['outstanding', 'overdue', 'advance'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-[10px] font-semibold transition-colors ${
                  tab === t ? 'text-accent border-b-2 border-accent' : 'text-text-secondary hover:text-white'
                }`}
              >
                {t === 'outstanding' ? 'All' : t === 'overdue' ? 'Overdue' : 'Advance'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto divide-y divide-border-subtle">
            {tab === 'outstanding' && rows.slice(0, 15).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-app/30 cursor-pointer" onClick={() => onSelectCustomer?.(r.id)}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{r.name}</div>
                  <div className="text-[10px] text-text-secondary">{r.phone ?? r.customer_code}</div>
                </div>
                <div className="text-xs font-mono font-bold text-red-400">{formatPaise(r.outstanding_balance_paise)}</div>
              </div>
            ))}
            {tab === 'overdue' && overdueRows.slice(0, 15).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-app/30 cursor-pointer" onClick={() => onSelectCustomer?.(r.id)}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{r.name}</div>
                  <div className="text-[10px] text-orange-400">{r.days_overdue ?? 0}d overdue</div>
                </div>
                <div className="text-xs font-mono font-bold text-orange-400">{formatPaise(r.outstanding_balance_paise)}</div>
              </div>
            ))}
            {tab === 'advance' && advanceRows.slice(0, 15).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-app/30 cursor-pointer" onClick={() => onSelectCustomer?.(r.id)}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{r.name}</div>
                  <div className="text-[10px] text-text-secondary">{r.phone ?? r.customer_code}</div>
                </div>
                <div className="text-xs font-mono font-bold text-brand-500">{formatPaise(r.advance_balance_paise)}</div>
              </div>
            ))}
            {((tab === 'outstanding' && rows.length === 0) ||
              (tab === 'overdue' && overdueRows.length === 0) ||
              (tab === 'advance' && advanceRows.length === 0)) && (
              <div className="py-10 text-center text-text-secondary text-xs">
                {tab === 'advance' ? 'No advance balances' : 'Nothing to show'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
