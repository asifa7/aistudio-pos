import { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Calendar, 
  BarChart3, 
  FileText, 
  ArrowRightLeft,
  Bird,
  ChevronRight
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { 
  useSalesSummary, 
  useCategorySales, 
  useProfitSummary 
} from '../hooks/useReports';
import { formatPaise } from '../../../billing/frontend/types/billing.types';

export default function ReportsView() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'transfers' | 'mortality'>('sales');

  const { data: sales, isLoading: isLoadingSales } = useSalesSummary(startDate, endDate);
  const { data: categorySales, isLoading: isLoadingCategories } = useCategorySales(startDate, endDate);
  const { data: profit, isLoading: isLoadingProfit } = useProfitSummary(startDate, endDate);

  // Fetch Stock Transfers
  const { data: transfersData, isLoading: isLoadingTransfers } = useQuery({
    queryKey: ['report-transfers', startDate, endDate],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_TRANSFERS, {});
      if (!res.success) throw new Error(res.error.message);
      return res.data || [];
    },
    enabled: activeReportTab === 'transfers',
  });

  // Fetch Stock Adjustments / Livestock Loss
  const { data: adjData, isLoading: isLoadingAdj } = useQuery({
    queryKey: ['report-adj-mortality', startDate, endDate],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_ADJ_HISTORY, { limit: 100 });
      if (!res.success) throw new Error(res.error.message);
      return res.data || [];
    },
    enabled: activeReportTab === 'mortality',
  });

  const handlePresetChange = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (preset === 'week') {
      const lastWeek = new Date();
      lastWeek.setDate(today.getDate() - 7);
      const lastWeekStr = lastWeek.toISOString().split('T')[0];
      setStartDate(lastWeekStr);
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const lastMonth = new Date();
      lastMonth.setDate(today.getDate() - 30);
      const lastMonthStr = lastMonth.toISOString().split('T')[0];
      setStartDate(lastMonthStr);
      setEndDate(todayStr);
    }
  };

  const isLoading = isLoadingSales || isLoadingCategories || isLoadingProfit;

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6 bg-surface-app text-text-primary">
      {/* Header */}
      <div className="border-b border-border-subtle pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
            <BarChart3 className="text-brand-500" />
            <span>Reports & Sales Analytics</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">Review revenue summaries, profit margins, and category tax splits.</p>
        </div>

        {/* Date Selector & Presets */}
        <div className="flex flex-wrap items-center gap-3 bg-surface-panel border border-border-subtle p-2 rounded-xl self-start shadow-elevation">
          <div className="flex gap-1 border-r border-border-subtle pr-2.5">
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold transition-all ${
                startDate === todayStr && endDate === todayStr
                  ? 'bg-brand-500 text-white shadow-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePresetChange('yesterday')}
              className="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold text-text-muted hover:text-text-primary transition-all"
            >
              Yesterday
            </button>
            <button
              onClick={() => handlePresetChange('week')}
              className="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold text-text-muted hover:text-text-primary transition-all"
            >
              7 Days
            </button>
            <button
              onClick={() => handlePresetChange('month')}
              className="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold text-text-muted hover:text-text-primary transition-all"
            >
              30 Days
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-text-muted" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-surface-card border border-border-subtle text-text-primary text-xs rounded-md px-2 py-1 outline-none font-medium focus:border-brand-500"
            />
            <span className="text-text-muted text-xs font-bold font-mono">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-surface-card border border-border-subtle text-text-primary text-xs rounded-md px-2 py-1 outline-none font-medium focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Subtabs Selector */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          onClick={() => setActiveReportTab('sales')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeReportTab === 'sales'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <BarChart3 size={14} /> Sales & Profit Analytics
        </button>

        <button
          onClick={() => setActiveReportTab('transfers')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeReportTab === 'transfers'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <ArrowRightLeft size={14} /> Stock Transfers Movement
        </button>

        <button
          onClick={() => setActiveReportTab('mortality')}
          className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            activeReportTab === 'mortality'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Bird size={14} /> Dead Stock & Livestock Loss
        </button>
      </div>

      {activeReportTab === 'sales' && (
        isLoading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            Generating analytics report...
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
            {/* KPI Dashboard Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Invoices */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-elevation">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="text-brand-500" size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-text-muted">Total Invoices</p>
                  <p className="text-xl font-bold font-outfit text-text-primary mt-0.5">
                    {sales?.totalInvoices ?? 0}
                  </p>
                </div>
              </div>

              {/* KPI 2: Sales Revenue */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-elevation">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/50 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="text-brand-500" size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-text-muted">Sales Revenue</p>
                  <p className="text-xl font-bold font-outfit text-text-primary mt-0.5 font-mono">
                    {formatPaise(sales?.totalRevenuePaise ?? 0)}
                  </p>
                </div>
              </div>

              {/* KPI 3: Gross Profit */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-elevation">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="text-brand-500" size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-text-muted">Gross Profit</p>
                  <p className="text-xl font-bold font-outfit text-text-primary mt-0.5 font-mono">
                    {formatPaise(profit?.grossProfitPaise ?? 0)}
                  </p>
                </div>
              </div>

              {/* KPI 4: Margin */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center gap-4 shadow-elevation">
                <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/50 flex items-center justify-center flex-shrink-0">
                  <Percent className="text-brand-500" size={18} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-text-muted">Profit Margin</p>
                  <p className="text-xl font-bold font-outfit text-text-primary mt-0.5">
                    {profit?.profitMarginPercent ?? 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Split Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Payment Mode Splits */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-elevation">
                <h3 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-brand-500" />
                  Payment Methods Split
                </h3>
                <div className="space-y-3 flex-1 flex flex-col justify-center">
                  <div className="flex justify-between items-center bg-surface-card p-3 rounded-lg border border-border-subtle">
                    <span className="text-xs font-semibold text-text-secondary">Cash Collections</span>
                    <span className="text-sm font-bold font-mono text-text-primary">
                      {formatPaise(sales?.paymentSplit?.cashPaise ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-card p-3 rounded-lg border border-border-subtle">
                    <span className="text-xs font-semibold text-text-secondary">UPI / Digital QR</span>
                    <span className="text-sm font-bold font-mono text-text-primary">
                      {formatPaise(sales?.paymentSplit?.upiPaise ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-card p-3 rounded-lg border border-border-subtle">
                    <span className="text-xs font-semibold text-text-secondary">Card Transactions</span>
                    <span className="text-sm font-bold font-mono text-text-primary">
                      {formatPaise(sales?.paymentSplit?.cardPaise ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-card p-3 rounded-lg border border-border-subtle">
                    <span className="text-xs font-semibold text-text-secondary">Store Credit / Khata</span>
                    <span className="text-sm font-bold font-mono text-text-primary">
                      {formatPaise(sales?.paymentSplit?.creditPaise ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Volume & Sales Breakdown */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-elevation lg:col-span-2">
                <h3 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
                  <BarChart3 size={14} className="text-brand-500" />
                  Category Contribution & Volume
                </h3>

                {categorySales?.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-xs">
                    No items sold in the selected period.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
                    {categorySales?.map(cat => {
                      const totalRevenue = sales?.totalRevenuePaise || 1;
                      const percent = Math.min(100, Math.round((cat.revenuePaise / totalRevenue) * 100));
                      return (
                        <div key={cat.category} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-text-primary">
                            <span className="flex items-center gap-1">
                              <ChevronRight size={12} className="text-brand-500" />
                              {cat.category}
                            </span>
                            <span className="font-mono">{formatPaise(cat.revenuePaise)} ({percent}%)</span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full h-2.5 bg-surface-card border border-border-subtle rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand-500 rounded-full transition-all duration-500" 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-text-muted font-medium">
                            <span>Volume Sold:</span>
                            <span>
                              {cat.grams > 0 ? (cat.grams / 1000).toFixed(3) + ' kg' : ''}
                              {cat.grams > 0 && cat.units > 0 ? ' / ' : ''}
                              {cat.units > 0 ? cat.units + ' pcs' : ''}
                              {cat.grams === 0 && cat.units === 0 ? '0' : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cost of Goods Sold vs Profit breakdown */}
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 flex flex-col gap-4 shadow-elevation lg:col-span-3">
                <h3 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-brand-500" />
                  Profitability & Cost of Goods Sold (COGS)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Text breakdown */}
                  <div className="space-y-4 text-xs font-medium md:col-span-2">
                    <p className="text-text-muted leading-relaxed">
                      Cost of Goods Sold (COGS) is calculated based on historical supplier purchases. If a variant lacks logged purchase transactions, COGS defaults to <span className="text-text-primary font-bold">65%</span> of its historical invoice subtotal rate.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-card border border-border-subtle rounded-lg p-3">
                        <p className="text-[10px] uppercase font-bold text-text-muted">Total Sales Revenue</p>
                        <p className="text-sm font-bold text-text-primary font-mono mt-1">
                          {formatPaise(profit?.totalSalesRevenuePaise ?? 0)}
                        </p>
                      </div>
                      <div className="bg-surface-card border border-border-subtle rounded-lg p-3">
                        <p className="text-[10px] uppercase font-bold text-text-muted">Total Cost of Goods (COGS)</p>
                        <p className="text-sm font-bold text-text-primary font-mono mt-1">
                          {formatPaise(profit?.totalCostPaise ?? 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Circular chart/Big Stat */}
                  <div className="bg-surface-card border border-border-subtle rounded-xl p-5 text-center flex flex-col items-center justify-center space-y-1 shadow-subtle">
                    <span className="text-[10px] uppercase font-bold text-text-muted">Gross Profit Margin</span>
                    <span className="text-3xl font-extrabold text-brand-500 font-outfit mt-1">
                      {profit?.profitMarginPercent ?? 0}%
                    </span>
                    <span className="text-[10px] text-text-muted font-bold font-mono">
                      Net: {formatPaise(profit?.grossProfitPaise ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )
      )}

      {/* Stock Transfers Tab */}
      {activeReportTab === 'transfers' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-brand-500" />
                  Inter-Branch Stock Movement Log
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Summary of all dispatched and completed inter-store transfers.</p>
              </div>
              <span className="text-xs font-mono font-bold bg-surface-card px-2.5 py-1 rounded-lg border border-border-subtle text-text-primary">
                Total Movements: {(transfersData || []).length}
              </span>
            </div>

            {isLoadingTransfers ? (
              <div className="text-center py-8 text-text-muted text-xs">Loading stock transfers...</div>
            ) : (transfersData || []).length === 0 ? (
              <div className="text-center py-10 text-text-muted text-xs">
                No stock transfers logged for this workspace.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle text-[10px] font-extrabold uppercase text-text-muted bg-surface-card">
                      <th className="py-2.5 px-3">Transfer #</th>
                      <th className="py-2.5 px-3">From Branch</th>
                      <th className="py-2.5 px-3">To Branch</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Dispatched Date</th>
                      <th className="py-2.5 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {(transfersData || []).map((t: any) => (
                      <tr key={t.id} className="hover:bg-surface-card/60 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-text-primary">
                          {t.transfer_number || `#TR-${t.id}`}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-text-primary">
                          {t.from_location_name || `Branch #${t.from_location_id}`}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-text-primary">
                          {t.to_location_name || `Branch #${t.to_location_id}`}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.status === 'completed'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                            {t.status === 'completed' ? 'Received / Done' : 'In-Transit'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-text-muted font-mono text-[11px]">
                          {t.created_at ? new Date(t.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-2.5 px-3 text-text-muted text-xs max-w-xs truncate">
                          {t.notes || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dead Stock & Livestock Loss Tab */}
      {activeReportTab === 'mortality' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <Bird size={16} className="text-rose-500" />
                  Dead Stock & Livestock Mortality Log
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Track pre-processing chicken, country bird, and quail mortality losses.</p>
              </div>
              <span className="text-xs font-mono font-bold bg-surface-card px-2.5 py-1 rounded-lg border border-border-subtle text-text-primary">
                Entries: {(adjData || []).length}
              </span>
            </div>

            {isLoadingAdj ? (
              <div className="text-center py-8 text-text-muted text-xs">Loading livestock loss records...</div>
            ) : (adjData || []).length === 0 ? (
              <div className="text-center py-10 text-text-muted text-xs">
                No livestock mortality adjustments recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-subtle text-[10px] font-extrabold uppercase text-text-muted bg-surface-card">
                      <th className="py-2.5 px-3">Date & Time</th>
                      <th className="py-2.5 px-3">Product / Variant</th>
                      <th className="py-2.5 px-3">Reason / Type</th>
                      <th className="py-2.5 px-3 text-right">Adjustment Qty</th>
                      <th className="py-2.5 px-3">Remarks & Bird Counts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {(adjData || []).map((a: any) => {
                      const qtyDisplay = a.quantity_grams !== null
                        ? `${(a.quantity_grams / 1000).toFixed(3)} kg`
                        : `${a.quantity_units ?? 0} pcs`;
                      return (
                        <tr key={a.id} className="hover:bg-surface-card/60 transition-colors">
                          <td className="py-2.5 px-3 text-text-muted font-mono text-[11px]">
                            {a.created_at ? new Date(a.created_at).toLocaleString() : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-text-primary">
                            {a.product_name || a.variant_name || `Variant #${a.product_variant_id}`}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              {a.reason || 'Livestock Loss'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-rose-400">
                            -{qtyDisplay}
                          </td>
                          <td className="py-2.5 px-3 text-text-muted text-xs max-w-sm truncate">
                            {a.notes || a.remarks || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
