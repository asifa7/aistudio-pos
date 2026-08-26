import { useState } from 'react';
import {
  TrendingUp,
  Clock,
  Briefcase,
  FileSpreadsheet,
  Info
} from 'lucide-react';
import {
  useSupplierAgingReport,
  useSupplierPurchaseVolumes,
  usePurchaseRegister
} from '../../hooks/useSupplierProcurement';
import { useActiveRates } from '../../../../billing/frontend/hooks/useActiveRates';
import { formatPaise, formatDate } from '../../types/supplier.types';
import PriceTrendChart from './PriceTrendChart';

export default function ProcurementReports() {
  const [activeReportTab, setActiveReportTab] = useState<'aging' | 'volumes' | 'trend' | 'register'>('aging');

  // Active rates for Price Trend product selector
  const { data: variants } = useActiveRates();
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Aging Hook
  const { data: agingData, isLoading: isLoadingAging } = useSupplierAgingReport();

  // Purchase Volumes Date Filters & Hook
  const [volStart, setVolStart] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [volEnd, setVolEnd] = useState(new Date().toISOString().split('T')[0]);
  const { data: volumeData, isLoading: isLoadingVolumes, refetch: refetchVolumes } = useSupplierPurchaseVolumes(
    volStart,
    volEnd
  );

  // Purchase Register Date Filters & Hook
  const [regStart, setRegStart] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [regEnd, setRegEnd] = useState(new Date().toISOString().split('T')[0]);
  const { data: registerData, isLoading: isLoadingRegister, refetch: refetchRegister } = usePurchaseRegister(
    regStart,
    regEnd
  );

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6">
      {/* Title */}
      <div className="border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-secondary flex items-center gap-2">
            <TrendingUp className="text-accent" />
            <span>Procurement & Accounts Payable Analytics</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">Audit payables aging schedules, purchase taxes, and variant price trend indexes.</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-surface-panel border border-border-subtle p-1 rounded-xl gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveReportTab('aging')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeReportTab === 'aging'
              ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Clock size={13} /> Payables Aging
        </button>
        <button
          onClick={() => setActiveReportTab('volumes')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeReportTab === 'volumes'
              ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Briefcase size={13} /> Supplier Volumes
        </button>
        <button
          onClick={() => setActiveReportTab('trend')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeReportTab === 'trend'
              ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <TrendingUp size={13} /> Price Trend Analysis
        </button>
        <button
          onClick={() => setActiveReportTab('register')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            activeReportTab === 'register'
              ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <FileSpreadsheet size={13} /> Purchase & Tax Register
        </button>
      </div>

      {/* Report View Panel */}
      <div className="flex-1 min-h-0 bg-surface-panel rounded-xl border border-border-subtle overflow-hidden flex flex-col shadow-sm">
        <div className="flex-1 overflow-y-auto p-6">
          {/* REPORT TAB 1: PAYABLES AGING */}
          {activeReportTab === 'aging' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase text-text-secondary">Vendor Payables Aging Schedule</h3>
                  <p className="text-[10px] text-text-muted mt-0.5">Outstanding accounts payable segmented by credit due buckets.</p>
                </div>
              </div>

              {isLoadingAging ? (
                <p className="text-xs text-text-muted py-8 text-center">Loading payables aging details...</p>
              ) : agingData?.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center italic">All vendor balances are fully settled. No payables aging schedule detected.</p>
              ) : (
                <div className="border border-border-subtle rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                        <th className="p-4">Vendor</th>
                        <th className="p-4 text-right">Owed Balance</th>
                        <th className="p-4 text-right">Current (0-30d)</th>
                        <th className="p-4 text-right">31-60 Days</th>
                        <th className="p-4 text-right">61-90 Days</th>
                        <th className="p-4 text-right pr-6">Overdue (90d+)</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                      {agingData?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-app/20 transition-colors">
                          <td className="p-4">
                            <span className="font-bold text-text-secondary">{row.company_name}</span>
                            <span className="text-[10px] block font-mono text-text-muted mt-0.5">ID: {row.supplier_id}</span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-text-secondary">
                            {formatPaise(row.outstanding_balance_paise)}
                          </td>
                          <td className="p-4 text-right font-mono text-text-secondary/80">
                            {row.current_due_paise > 0 ? formatPaise(row.current_due_paise) : '-'}
                          </td>
                          <td className="p-4 text-right font-mono text-text-secondary/80">
                            {row.overdue_30_days_paise > 0 ? formatPaise(row.overdue_30_days_paise) : '-'}
                          </td>
                          <td className="p-4 text-right font-mono text-text-secondary/80">
                            {row.overdue_60_days_paise > 0 ? formatPaise(row.overdue_60_days_paise) : '-'}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-rose-400 pr-6">
                            {row.overdue_90_days_paise > 0 ? formatPaise(row.overdue_90_days_paise) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* REPORT TAB 2: SUPPLIER VOLUMES */}
          {activeReportTab === 'volumes' && (
            <div className="space-y-6">
              {/* Date Filters bar */}
              <div className="bg-surface-app/40 border border-border-subtle p-4 rounded-xl flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-text-muted">Start Date</label>
                  <input
                    type="date"
                    value={volStart}
                    onChange={e => setVolStart(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-text-muted">End Date</label>
                  <input
                    type="date"
                    value={volEnd}
                    onChange={e => setVolEnd(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                  />
                </div>
                <button
                  onClick={() => refetchVolumes()}
                  className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition-all"
                >
                  Analyze Volumes
                </button>
              </div>

              {isLoadingVolumes ? (
                <p className="text-xs text-text-muted py-8 text-center">Crunching supplier purchase volumes...</p>
              ) : volumeData?.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center italic">No purchase transactions mapped during specified dates.</p>
              ) : (
                <div className="border border-border-subtle rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                        <th className="p-4">Supplier Identity</th>
                        <th className="p-4 text-right">Invoices Filed</th>
                        <th className="p-4 text-right pr-6">Accumulated Purchase Value</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                      {volumeData?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-app/20 transition-colors">
                          <td className="p-4">
                            <span className="font-bold text-text-secondary">{row.company_name}</span>
                            <span className="text-[10px] block font-mono text-text-muted mt-0.5">ID: {row.supplier_id}</span>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-text-secondary">
                            {row.total_invoices_count}
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-accent pr-6">
                            {formatPaise(row.total_purchases_paise)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* REPORT TAB 3: PRICE TREND CHART */}
          {activeReportTab === 'trend' && (
            <div className="space-y-6">
              <div className="bg-surface-app/40 border border-border-subtle p-4 rounded-xl flex items-center gap-4">
                <div className="space-y-1 flex-1 max-w-sm">
                  <label className="text-[9px] uppercase font-bold text-text-muted">Target Product Variant</label>
                  <select
                    value={selectedVariantId}
                    onChange={e => setSelectedVariantId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface-panel border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-semibold"
                  >
                    <option value="">Select Variant...</option>
                    {variants?.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.product_name} ({v.variant_name})</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedVariantId ? (
                <PriceTrendChart productVariantId={parseInt(selectedVariantId)} />
              ) : (
                <div className="p-8 text-center bg-surface-app/10 border border-border-subtle rounded-xl text-xs text-text-muted font-medium flex items-center justify-center gap-2">
                  <Info size={14} className="text-accent" />
                  <span>Choose a variant from selection to inspect purchasing histories.</span>
                </div>
              )}
            </div>
          )}

          {/* REPORT TAB 4: TAX & PURCHASE REGISTER */}
          {activeReportTab === 'register' && (
            <div className="space-y-6">
              {/* Date Filters bar */}
              <div className="bg-surface-app/40 border border-border-subtle p-4 rounded-xl flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-text-muted">Start Date</label>
                  <input
                    type="date"
                    value={regStart}
                    onChange={e => setRegStart(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-text-muted">End Date</label>
                  <input
                    type="date"
                    value={regEnd}
                    onChange={e => setRegEnd(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                  />
                </div>
                <button
                  onClick={() => refetchRegister()}
                  className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition-all"
                >
                  Generate Register
                </button>
              </div>

              {isLoadingRegister ? (
                <p className="text-xs text-text-muted py-8 text-center">Constructing Purchase & Tax Register...</p>
              ) : !registerData ? (
                <p className="text-xs text-text-muted py-8 text-center italic">Specify a date range and request analysis.</p>
              ) : (
                <div className="space-y-6">
                  {/* Summary analytics metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3">
                      <span className="text-[8px] uppercase font-bold text-text-muted">Total Cost Invoiced</span>
                      <p className="text-xs font-bold font-mono text-text-secondary mt-0.5">
                        {formatPaise(registerData.summary.total_amount_paise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3">
                      <span className="text-[8px] uppercase font-bold text-text-muted">GST Input Credit</span>
                      <p className="text-xs font-bold font-mono text-brand-500 mt-0.5">
                        {formatPaise(registerData.summary.total_gst_paise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3">
                      <span className="text-[8px] uppercase font-bold text-text-muted">CGST</span>
                      <p className="text-xs font-bold font-mono text-text-secondary mt-0.5">
                        {formatPaise(registerData.summary.total_cgst_paise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3">
                      <span className="text-[8px] uppercase font-bold text-text-muted">SGST</span>
                      <p className="text-xs font-bold font-mono text-text-secondary mt-0.5">
                        {formatPaise(registerData.summary.total_sgst_paise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3">
                      <span className="text-[8px] uppercase font-bold text-text-muted">IGST</span>
                      <p className="text-xs font-bold font-mono text-text-secondary mt-0.5">
                        {formatPaise(registerData.summary.total_igst_paise)}
                      </p>
                    </div>
                  </div>

                  {/* Register entries list */}
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                          <th className="p-3">Invoice Date</th>
                          <th className="p-3">Invoice No.</th>
                          <th className="p-3">Supplier</th>
                          <th className="p-3 text-right">Taxable Subtotal</th>
                          <th className="p-3 text-right">GST Paid</th>
                          <th className="p-3 text-right pr-4">Total Amt</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                        {registerData.invoices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-text-muted italic">
                              No purchase logs stored during date cycles.
                            </td>
                          </tr>
                        ) : (
                          registerData.invoices.map((inv, idx) => (
                            <tr key={idx} className="hover:bg-surface-app/20 transition-colors">
                              <td className="p-3 text-text-muted font-mono">{formatDate(inv.invoice_date)}</td>
                              <td className="p-3 font-mono font-bold text-text-secondary">{inv.invoice_number}</td>
                              <td className="p-3 text-text-secondary">{inv.company_name}</td>
                              <td className="p-3 text-right font-mono">{formatPaise(inv.subtotal_paise)}</td>
                              <td className="p-3 text-right font-mono text-brand-500">{formatPaise(inv.gst_paise)}</td>
                              <td className="p-3 text-right font-mono font-bold text-text-secondary pr-4">{formatPaise(inv.total_amount_paise)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
