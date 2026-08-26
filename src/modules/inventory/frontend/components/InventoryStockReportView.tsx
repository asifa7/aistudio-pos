import { useState, useMemo } from 'react';
import { 
  History, 
  Calendar, 
  Search, 
  Filter, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RotateCcw, 
  Scissors, 
  ClipboardCheck, 
  Trash2, 
  ShoppingCart,
  Store,
  Layers
} from 'lucide-react';
import { useInventoryActivityLog } from '../hooks/useInventoryLedger';
import { useStockStatus } from '../hooks/useInventory';
import { useActiveBranches } from '../hooks/useBranches';

const ACTION_TYPES = [
  { key: 'purchase', label: 'Purchase (In)', icon: ArrowDownLeft, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { key: 'sale', label: 'Sale (Out)', icon: ShoppingCart, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { key: 'return', label: 'Sale Return (In)', icon: RotateCcw, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { key: 'transfer_out', label: 'Transfer Out', icon: ArrowUpRight, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  { key: 'transfer_in', label: 'Transfer In', icon: ArrowDownLeft, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  { key: 'yield_out', label: 'Yield Carcass (Out)', icon: Scissors, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { key: 'yield_in', label: 'Yield Cut (In)', icon: Scissors, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { key: 'audit_adjustment', label: 'Physical Audit Correction', icon: ClipboardCheck, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { key: 'wastage', label: 'Wastage / Loss', icon: Trash2, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
];

export default function InventoryStockReportView() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedProductVariantId, setSelectedProductVariantId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedActionTypes, setSelectedActionTypes] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  const { data: stockStatus } = useStockStatus();
  const { data: branches } = useActiveBranches();

  // Query Activity Log from unified inventory_ledger
  const { data: logs, isLoading, refetch } = useInventoryActivityLog({
    startDate,
    endDate,
    productVariantIds: selectedProductVariantId !== 'all' ? [Number(selectedProductVariantId)] : undefined,
    actionTypes: selectedActionTypes.length > 0 ? selectedActionTypes : undefined,
    branchId: selectedBranchId !== 'all' ? Number(selectedBranchId) : undefined,
    limit: 200,
  });

  const toggleActionType = (typeKey: string) => {
    setSelectedActionTypes(prev => 
      prev.includes(typeKey) ? prev.filter(t => t !== typeKey) : [...prev, typeKey]
    );
  };

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!searchFilter.trim()) return logs;
    const q = searchFilter.toLowerCase().trim();
    return logs.filter(l => 
      l.product_name.toLowerCase().includes(q) ||
      l.variant_name.toLowerCase().includes(q) ||
      (l.reference_number && l.reference_number.toLowerCase().includes(q)) ||
      (l.notes && l.notes.toLowerCase().includes(q)) ||
      (l.created_by_name && l.created_by_name.toLowerCase().includes(q))
    );
  }, [logs, searchFilter]);

  const getActionBadge = (actionType: string) => {
    const config = ACTION_TYPES.find(a => a.key === actionType);
    if (!config) {
      return (
        <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] bg-surface-app text-text-muted">
          {actionType}
        </span>
      );
    }
    const Icon = config.icon;
    return (
      <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase flex items-center gap-1 border ${config.color}`}>
        <Icon size={11} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2">
            <History className="text-brand-500" size={22} />
            Inventory Stock Report & Activity Ledger
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Complete unified ledger of every stock-affecting action with running balances across all store branches.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-card hover:bg-surface-panel border border-border-subtle text-text-primary rounded-xl text-xs font-semibold shadow-sm transition-colors"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin text-brand-500' : ''} />
          Refresh Activity Log
        </button>
      </div>

      {/* Filter Panel */}
      <div className="p-4 bg-surface-card border border-border-subtle rounded-2xl space-y-3 shadow-sm">
        {/* Row 1: Date Range, Product & Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
              <Calendar size={12} /> From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
              <Calendar size={12} /> To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
              <Layers size={12} /> Filter Product
            </label>
            <select
              value={selectedProductVariantId}
              onChange={e => setSelectedProductVariantId(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
            >
              <option value="all">All Products & Cuts</option>
              {(stockStatus || []).map(s => (
                <option key={s.product_variant_id} value={s.product_variant_id}>
                  {s.product_name} - {s.variant_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
              <Store size={12} /> Store Branch
            </label>
            <select
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
            >
              <option value="all">All Branches</option>
              {(branches || []).map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Action Type Checkbox Pills */}
        <div className="pt-2 border-t border-border-subtle/60 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-text-muted mr-1.5 flex items-center gap-1">
            <Filter size={11} /> Actions:
          </span>
          <button
            onClick={() => setSelectedActionTypes([])}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              selectedActionTypes.length === 0
                ? 'bg-brand-500 text-white'
                : 'bg-surface-panel border border-border-subtle text-text-muted hover:text-text-primary'
            }`}
          >
            All Actions
          </button>
          {ACTION_TYPES.map(a => {
            const isSelected = selectedActionTypes.includes(a.key);
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={() => toggleActionType(a.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                  isSelected
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                    : 'bg-surface-panel border border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon size={11} />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Log Grid / Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm">
        {/* Table Sub-header with Search */}
        <div className="p-3 bg-surface-app border-b border-border-subtle flex items-center justify-between gap-3">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search reference, notes, user..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-8 pr-3 py-1 text-xs text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div className="text-xs text-text-muted">
            Showing <strong className="text-text-primary font-mono">{filteredLogs.length}</strong> activity records
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-app/50 text-text-muted font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Action Type</th>
                <th className="py-3 px-3">Product / Item</th>
                <th className="py-3 px-3">Branch</th>
                <th className="py-3 px-3 text-right">Quantity Change</th>
                <th className="py-3 px-3 text-right">Running Balance</th>
                <th className="py-3 px-3">Reference / Details</th>
                <th className="py-3 px-4 text-right">User / Cashier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    <RefreshCw className="animate-spin text-brand-500 mx-auto mb-2" size={18} />
                    Loading inventory activity records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-muted">
                    No stock activity found for the selected filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isPositive = (log.quantity_display ?? 0) > 0;
                  const isZero = log.quantity_display === 0;

                  return (
                    <tr key={log.id} className="hover:bg-surface-panel/40 transition-colors">
                      <td className="py-3 px-4 text-text-muted font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getActionBadge(log.action_type)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-text-primary">{log.product_name}</div>
                        <div className="text-[11px] text-text-muted">{log.variant_name}</div>
                      </td>
                      <td className="py-3 px-3 text-text-muted font-medium text-[11px] whitespace-nowrap">
                        {log.branch_name || 'Main Store'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap">
                        {log.quantity_display !== null ? (
                          <span className={isPositive ? 'text-emerald-400' : isZero ? 'text-text-muted' : 'text-rose-400'}>
                            {isPositive ? '+' : ''}{log.quantity_display.toFixed(2)} {log.unit_label}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-text-primary whitespace-nowrap">
                        {log.running_balance_display.toFixed(2)} {log.unit_label}
                      </td>
                      <td className="py-3 px-3">
                        {log.reference_number ? (
                          <span className="font-mono font-bold text-brand-400 text-[11px] block">
                            {log.reference_number}
                          </span>
                        ) : log.reference_id ? (
                          <span className="font-mono text-text-muted text-[11px] block">
                            Ref #{log.reference_id}
                          </span>
                        ) : null}
                        {log.notes && (
                          <span className="text-[11px] text-text-muted line-clamp-1">
                            {log.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted text-[11px] whitespace-nowrap">
                        {log.created_by_name || 'System / Admin'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
