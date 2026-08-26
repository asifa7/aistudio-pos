import { useState } from 'react';
import { AlertTriangle, TrendingDown, Users, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { useARReports } from '../hooks/useCustomerLedger';
import { formatPaise, getRiskBadgeColor } from '../types/customer.types';
import type { AgingReportRow } from '../types/customer.types';

type SortKey = 'name' | 'outstanding_paise' | 'days_1_30_paise' | 'days_31_60_paise' | 'days_61_90_paise' | 'days_91_180_paise' | 'days_180_plus_paise';

export default function AgingDashboard() {
  const { useAgingReport } = useARReports();
  const [asOfDate, setAsOfDate] = useState('');
  const { data: agingRows, isLoading } = useAgingReport(asOfDate || undefined);
  const [sortKey, setSortKey] = useState<SortKey>('outstanding_paise');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');

  const rows = agingRows ?? [];

  const totals = rows.reduce((acc, r) => ({
    outstanding: acc.outstanding + r.outstanding_paise,
    current: acc.current + r.current_paise,
    d1_30: acc.d1_30 + r.days_1_30_paise,
    d31_60: acc.d31_60 + r.days_31_60_paise,
    d61_90: acc.d61_90 + r.days_61_90_paise,
    d91_180: acc.d91_180 + r.days_91_180_paise,
    d180plus: acc.d180plus + r.days_180_plus_paise,
  }), { outstanding: 0, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d180plus: 0 });

  const filtered = rows.filter(r => riskFilter === 'all' || r.risk_level === riskFilter);

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] as number;
    const bv = b[sortKey] as number;
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)
      : null;

  const buckets = [
    { label: 'Current', value: totals.current, color: 'bg-brand-500' },
    { label: '1–30 Days', value: totals.d1_30, color: 'bg-yellow-500' },
    { label: '31–60 Days', value: totals.d31_60, color: 'bg-orange-500' },
    { label: '61–90 Days', value: totals.d61_90, color: 'bg-red-500' },
    { label: '91–180 Days', value: totals.d91_180, color: 'bg-rose-700' },
    { label: '180+ Days', value: totals.d180plus, color: 'bg-rose-900' },
  ];

  const maxBucket = Math.max(...buckets.map(b => b.value), 1);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Accounts Receivable Aging</h2>
          <p className="text-xs text-text-secondary mt-0.5">Outstanding balances by age bucket</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-text-secondary">As of date:</label>
          <input
            type="date"
            value={asOfDate}
            onChange={e => setAsOfDate(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-md px-3 py-1.5 text-xs text-white"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Outstanding', value: totals.outstanding, icon: <TrendingDown size={18} />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Overdue (30+ days)', value: totals.d1_30 + totals.d31_60 + totals.d61_90 + totals.d91_180 + totals.d180plus, icon: <Clock size={18} />, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'High Risk', value: rows.filter(r => r.risk_level === 'high').reduce((s, r) => s + r.outstanding_paise, 0), icon: <AlertTriangle size={18} />, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Total Customers', value: null, icon: <Users size={18} />, color: 'text-brand-500', bg: 'bg-brand-500/10', count: rows.length },
        ].map((card, i) => (
          <div key={i} className="bg-surface-panel border border-border-subtle rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center ${card.color} mb-3`}>
              {card.icon}
            </div>
            <p className="text-xs text-text-secondary">{card.label}</p>
            <p className={`text-lg font-bold mt-1 ${card.color}`}>
              {card.count !== undefined ? card.count : formatPaise(card.value!)}
            </p>
          </div>
        ))}
      </div>

      {/* Aging Bars */}
      <div className="bg-surface-panel border border-border-subtle rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Aging Distribution</h3>
        <div className="space-y-3">
          {buckets.map(b => (
            <div key={b.label} className="flex items-center gap-4">
              <div className="w-24 text-xs text-text-secondary text-right">{b.label}</div>
              <div className="flex-1 bg-surface-app rounded-full h-5 overflow-hidden">
                <div
                  className={`h-full ${b.color} rounded-full transition-all duration-500`}
                  style={{ width: `${(b.value / maxBucket) * 100}%` }}
                />
              </div>
              <div className="w-28 text-xs font-mono text-white text-right">{formatPaise(b.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-text-secondary">Risk:</span>
        {(['all', 'low', 'medium', 'high'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              riskFilter === r
                ? 'bg-accent text-white border-accent'
                : 'border-border-subtle text-text-secondary hover:text-white'
            }`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-secondary">{sorted.length} customers</span>
      </div>

      {/* Table */}
      <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-app">
                <th className="text-left px-4 py-3 text-text-secondary font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('name')}>
                  Customer <SortIcon col="name" />
                </th>
                <th className="text-right px-3 py-3 text-text-secondary font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('outstanding_paise')}>
                  Outstanding <SortIcon col="outstanding_paise" />
                </th>
                <th className="text-right px-3 py-3 text-brand-500 font-semibold cursor-pointer hover:text-brand-500" onClick={() => toggleSort('current_paise' as SortKey)}>Current</th>
                <th className="text-right px-3 py-3 text-yellow-400 font-semibold cursor-pointer hover:text-yellow-300" onClick={() => toggleSort('days_1_30_paise')}>1–30d</th>
                <th className="text-right px-3 py-3 text-orange-400 font-semibold cursor-pointer hover:text-orange-300" onClick={() => toggleSort('days_31_60_paise')}>31–60d</th>
                <th className="text-right px-3 py-3 text-red-400 font-semibold cursor-pointer hover:text-red-300" onClick={() => toggleSort('days_61_90_paise')}>61–90d</th>
                <th className="text-right px-3 py-3 text-rose-500 font-semibold cursor-pointer hover:text-rose-400" onClick={() => toggleSort('days_91_180_paise')}>91–180d</th>
                <th className="text-right px-3 py-3 text-rose-800 font-semibold cursor-pointer hover:text-rose-700" onClick={() => toggleSort('days_180_plus_paise')}>180d+</th>
                <th className="text-center px-3 py-3 text-text-secondary font-semibold">Risk</th>
                <th className="text-right px-3 py-3 text-text-secondary font-semibold">Credit Limit</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border-subtle animate-pulse">
                    {Array.from({ length: 10 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-surface-app rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-text-secondary">
                    <TrendingDown size={32} className="mx-auto mb-2 opacity-30" />
                    No outstanding balances found.
                  </td>
                </tr>
              ) : (
                sorted.map((row: AgingReportRow) => (
                  <tr key={row.customer_id} className="border-b border-border-subtle hover:bg-surface-app/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{row.name}</div>
                      <div className="text-text-secondary text-[10px]">{row.customer_code} {row.phone ? `· ${row.phone}` : ''}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-red-400">{formatPaise(row.outstanding_paise)}</td>
                    <td className="px-3 py-3 text-right font-mono text-brand-500">{row.current_paise > 0 ? formatPaise(row.current_paise) : '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-yellow-400">{row.days_1_30_paise > 0 ? formatPaise(row.days_1_30_paise) : '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-orange-400">{row.days_31_60_paise > 0 ? formatPaise(row.days_31_60_paise) : '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-red-400">{row.days_61_90_paise > 0 ? formatPaise(row.days_61_90_paise) : '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-rose-500">{row.days_91_180_paise > 0 ? formatPaise(row.days_91_180_paise) : '—'}</td>
                    <td className="px-3 py-3 text-right font-mono text-rose-800">{row.days_180_plus_paise > 0 ? formatPaise(row.days_180_plus_paise) : '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRiskBadgeColor(row.risk_level)}`}>
                        {row.risk_level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-text-secondary">{formatPaise(row.credit_limit_paise)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="bg-surface-app border-t-2 border-border-subtle font-bold">
                  <td className="px-4 py-3 text-white text-xs">TOTALS</td>
                  <td className="px-3 py-3 text-right text-red-400 font-mono text-xs">{formatPaise(totals.outstanding)}</td>
                  <td className="px-3 py-3 text-right text-brand-500 font-mono text-xs">{formatPaise(totals.current)}</td>
                  <td className="px-3 py-3 text-right text-yellow-400 font-mono text-xs">{formatPaise(totals.d1_30)}</td>
                  <td className="px-3 py-3 text-right text-orange-400 font-mono text-xs">{formatPaise(totals.d31_60)}</td>
                  <td className="px-3 py-3 text-right text-red-400 font-mono text-xs">{formatPaise(totals.d61_90)}</td>
                  <td className="px-3 py-3 text-right text-rose-500 font-mono text-xs">{formatPaise(totals.d91_180)}</td>
                  <td className="px-3 py-3 text-right text-rose-800 font-mono text-xs">{formatPaise(totals.d180plus)}</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
