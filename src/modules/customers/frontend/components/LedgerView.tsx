import { useState } from 'react';
import { Download, Printer, Calendar, RefreshCw } from 'lucide-react';
import { useCustomerLedger } from '../hooks/useCustomerLedger';
import { formatPaise, formatDate, getLedgerRefLabel } from '../types/customer.types';
import type { LedgerEntry } from '../types/customer.types';

interface LedgerViewProps {
  customerId: number;
  customerName: string;
}

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'all';

export default function LedgerView({ customerId, customerName }: LedgerViewProps) {
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Date range logic
  const getDates = () => {
    if (period === 'all') return { startDate: undefined, endDate: undefined };
    
    const today = new Date();
    const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

    switch (period) {
      case 'today':
        return { startDate: formatDateStr(today), endDate: formatDateStr(today) };
      case 'yesterday': {
        const y = new Date();
        y.setDate(today.getDate() - 1);
        return { startDate: formatDateStr(y), endDate: formatDateStr(y) };
      }
      case 'week': {
        const w = new Date();
        w.setDate(today.getDate() - today.getDay());
        return { startDate: formatDateStr(w), endDate: formatDateStr(today) };
      }
      case 'month': {
        const m = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: formatDateStr(m), endDate: formatDateStr(today) };
      }
      case 'last_month': {
        const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return { startDate: formatDateStr(lmStart), endDate: formatDateStr(lmEnd) };
      }
      default:
        return { startDate: undefined, endDate: undefined };
    }
  };

  const dates = period === 'all' ? getDates() : (customStart && customEnd ? { startDate: customStart, endDate: customEnd } : getDates());

  const { data: ledgerEntries, isLoading, refetch } = useCustomerLedger(customerId, {
    startDate: dates.startDate,
    endDate: dates.endDate,
    limit: 500, // retrieve bulk logs for view
  });

  const entries = ledgerEntries ?? [];

  // Calculate totals
  const totalDebit = entries.reduce((s, r) => s + r.debit_paise, 0);
  const totalCredit = entries.reduce((s, r) => s + r.credit_paise, 0);
  
  const openingBalance = entries.length > 0 
    ? (entries[0].running_balance_paise - entries[0].debit_paise + entries[0].credit_paise)
    : 0;

  const closingBalance = entries.length > 0
    ? entries[entries.length - 1].running_balance_paise
    : 0;

  const handleExportCSV = () => {
    if (entries.length === 0) return;
    
    const headers = ['Date', 'Reference Type', 'Invoice/Reference No', 'Description', 'Debit (DR) (₹)', 'Credit (CR) (₹)', 'Running Balance (₹)'];
    const rows = entries.map(r => [
      r.entry_date,
      getLedgerRefLabel(r.ref_type as any),
      r.invoice_number || '—',
      r.description,
      (r.debit_paise / 100).toFixed(2),
      (r.credit_paise / 100).toFixed(2),
      (r.running_balance_paise / 100).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `customer-ledger-${customerName.toLowerCase().replace(/\s+/g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app/40 border border-border-subtle p-3 rounded-xl select-none">
        
        {/* Date presets */}
        <div className="flex items-center bg-surface-app p-0.5 rounded-lg border border-border-subtle">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'last_month', label: 'Last Month' },
            { key: 'all', label: 'All Time' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setPeriod(t.key as Period);
                setCustomStart('');
                setCustomEnd('');
              }}
              className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                period === t.key && !customStart
                  ? 'bg-surface-card text-brand-600 dark:text-brand-400 border border-brand-500/30 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Custom Datepicker */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-text-secondary" />
          <input
            type="date"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              setPeriod('all'); // custom mode trigger
            }}
            className="bg-surface-card border border-border-subtle rounded px-2 py-1 text-[10px] text-text-primary font-mono shadow-sm"
          />
          <span className="text-text-secondary text-[10px]">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setPeriod('all');
            }}
            className="bg-surface-card border border-border-subtle rounded px-2 py-1 text-[10px] text-text-primary font-mono shadow-sm"
          />
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => refetch()}
            className="p-2 border border-border-subtle hover:border-brand-500 rounded-lg text-text-secondary hover:text-text-primary transition-colors bg-surface-card shadow-sm"
            title="Refresh Ledger"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={entries.length === 0}
            className="p-2 border border-border-subtle hover:border-brand-500 rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 bg-surface-card shadow-sm"
            title="Export CSV"
          >
            <Download size={12} />
          </button>
          <button
            onClick={handlePrint}
            disabled={entries.length === 0}
            className="p-2 border border-border-subtle hover:border-brand-500 rounded-lg text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 bg-surface-card shadow-sm"
            title="Print Ledger"
          >
            <Printer size={12} />
          </button>
        </div>
      </div>

      {/* Summary card metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-surface-card border border-border-subtle rounded-lg p-2.5 shadow-sm">
          <p className="text-[10px] text-text-secondary font-medium">Opening Balance</p>
          <p className="text-xs font-mono font-bold text-text-primary mt-0.5">{formatPaise(openingBalance)}</p>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-lg p-2.5 shadow-sm">
          <p className="text-[10px] font-medium font-mono text-red-600 dark:text-red-400">Total Debit (DR)</p>
          <p className="text-xs font-mono font-bold text-red-600 dark:text-red-400 mt-0.5">+{formatPaise(totalDebit)}</p>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-lg p-2.5 shadow-sm">
          <p className="text-[10px] font-medium font-mono text-brand-600 dark:text-brand-500">Total Credit (CR)</p>
          <p className="text-xs font-mono font-bold text-brand-600 dark:text-brand-500 mt-0.5">-{formatPaise(totalCredit)}</p>
        </div>
        <div className="bg-surface-card border border-border-subtle rounded-lg p-2.5 shadow-sm">
          <p className="text-[10px] text-text-secondary font-medium">Closing Balance</p>
          <p className="text-xs font-mono font-bold text-text-primary mt-0.5">{formatPaise(closingBalance)}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden print:border-0 print:bg-white print:text-black shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-panel print:bg-slate-200 print:text-black">
                <th className="px-4 py-2.5 text-text-secondary font-semibold print:text-black">Date</th>
                <th className="px-3 py-2.5 text-text-secondary font-semibold print:text-black">Reference Type</th>
                <th className="px-3 py-2.5 text-text-secondary font-semibold print:text-black">Ref Invoice</th>
                <th className="px-4 py-2.5 text-text-secondary font-semibold print:text-black">Description</th>
                <th className="px-3 py-2.5 text-right text-red-600 dark:text-red-400 font-semibold print:text-red-600">Debit (DR)</th>
                <th className="px-3 py-2.5 text-right text-brand-600 dark:text-brand-500 font-semibold print:text-emerald-700">Credit (CR)</th>
                <th className="px-4 py-2.5 text-right text-text-secondary font-semibold print:text-black">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle print:divide-slate-200">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-2.5 bg-surface-panel rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-text-secondary print:text-slate-500">
                    No ledger transactions recorded in this period
                  </td>
                </tr>
              ) : (
                entries.map((r: LedgerEntry) => (
                  <tr key={r.id} className="hover:bg-surface-hover transition-colors print:hover:bg-transparent">
                    <td className="px-4 py-2.5 font-mono text-text-primary print:text-black">{formatDate(r.entry_date)}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-[10px] uppercase text-text-secondary print:text-black">
                        {getLedgerRefLabel(r.ref_type as any)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-text-primary print:text-black">{r.invoice_number || '—'}</td>
                    <td className="px-4 py-2.5 text-text-primary print:text-black font-medium">{r.description}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-red-600 dark:text-red-400 print:text-red-600">
                      {r.debit_paise > 0 ? `+${formatPaise(r.debit_paise)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-brand-600 dark:text-brand-500 print:text-emerald-700">
                      {r.credit_paise > 0 ? `-${formatPaise(r.credit_paise)}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-text-primary print:text-black">
                      {formatPaise(r.running_balance_paise)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
