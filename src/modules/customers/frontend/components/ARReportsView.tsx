import { useState } from 'react';
import { BarChart3, Clock, FileText, Landmark } from 'lucide-react';
import OutstandingDashboard from './OutstandingDashboard';
import AgingDashboard from './AgingDashboard';
import CustomerSearch from './CustomerSearch';
import { useARReports } from '../hooks/useCustomerLedger';
import { formatPaise, formatDate, getLedgerRefLabel } from '../types/customer.types';
import type { Customer } from '../types/customer.types';

type Tab = 'dashboard' | 'aging' | 'statement' | 'collections';

export default function ARReportsView() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  
  // Statement selectors
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [stmtStart, setStmtStart] = useState('');
  const [stmtEnd, setStmtEnd] = useState('');
  const [isStatementLoaded, setIsStatementLoaded] = useState(false);

  // Collections state
  const today = new Date().toISOString().split('T')[0];
  const [colStart, setColStart] = useState(today);
  const [colEnd, setColEnd] = useState(today);

  const { useCollectionReport } = useARReports();
  const { data: collectionSummary, refetch: refetchCol } = useCollectionReport(colStart, colEnd);

  // Statement fetching directly
  const [statementData, setStatementData] = useState<any>(null);
  const [isStmtLoading, setIsStmtLoading] = useState(false);

  const handleFetchStatement = async () => {
    if (!selectedCust || !stmtStart || !stmtEnd) return;
    setIsStmtLoading(true);
    try {
      const res = await window.api.invoke('customers:get-statement', {
        customer_id: selectedCust.id,
        startDate: stmtStart,
        endDate: stmtEnd
      }) as { success: boolean; data?: any };
      if (res.success && res.data) {
        setStatementData(res.data);
        setIsStatementLoaded(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStmtLoading(false);
    }
  };

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="h-full flex flex-col select-none text-xs text-text-secondary">
      {/* Sub-nav Tabs */}
      <div className="flex border-b border-border-subtle bg-surface-panel px-6">
        {[
          { id: 'dashboard', label: 'Outstanding Dashboard', icon: <Landmark size={14} /> },
          { id: 'aging', label: 'Aging Schedule', icon: <Clock size={14} /> },
          { id: 'statement', label: 'Customer Statements', icon: <FileText size={14} /> },
          { id: 'collections', label: 'Collection Reports', icon: <BarChart3 size={14} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as Tab)}
            className={`flex items-center gap-2 py-3 px-4 border-b-2 font-semibold transition-colors ${
              activeTab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-secondary hover:text-white'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && (
          <OutstandingDashboard onSelectCustomer={() => {}} />
        )}

        {activeTab === 'aging' && (
          <AgingDashboard />
        )}

        {activeTab === 'statement' && (
          <div className="h-full overflow-auto p-6 space-y-5">
            {/* Input Toolbar */}
            <div className="bg-surface-panel border border-border-subtle p-4 rounded-xl flex flex-wrap items-end gap-4 print:hidden">
              <div className="w-64">
                <label className="block text-[10px] text-text-secondary mb-1">Select Customer</label>
                <CustomerSearch value={selectedCust} onChange={setSelectedCust} showBalance={false} />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Start Date</label>
                <input
                  type="date"
                  value={stmtStart}
                  onChange={(e) => setStmtStart(e.target.value)}
                  className="bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">End Date</label>
                <input
                  type="date"
                  value={stmtEnd}
                  onChange={(e) => setStmtEnd(e.target.value)}
                  className="bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white"
                />
              </div>
              <button
                onClick={handleFetchStatement}
                disabled={!selectedCust || !stmtStart || !stmtEnd || isStmtLoading}
                className="px-4 py-2 bg-accent hover:bg-brand-500 rounded-lg text-white font-bold transition-colors disabled:opacity-30"
              >
                {isStmtLoading ? 'Loading...' : 'Generate Statement'}
              </button>
            </div>

            {/* Statement Printable sheet */}
            {isStatementLoaded && statementData && (
              <div className="bg-surface-panel border border-border-subtle rounded-xl p-6 space-y-6 print:border-0 print:bg-white print:text-black">
                
                {/* Print button toolbar */}
                <div className="flex justify-end gap-2 print:hidden border-b border-border-subtle pb-4">
                  <button
                    onClick={handlePrintStatement}
                    className="px-3 py-1.5 bg-accent text-white hover:bg-brand-500 rounded-md font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <PrinterIcon size={14} />
                    Print Statement
                  </button>
                </div>

                {/* Print Invoice Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-base font-bold text-white print:text-black uppercase">ACCOUNT STATEMENT</h2>
                    <p className="text-[10px] text-text-secondary print:text-slate-500 font-mono mt-0.5">
                      Period: {formatDate(statementData.startDate)} to {formatDate(statementData.endDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-white print:text-black">{statementData.customer.name}</h3>
                    <p className="text-[10px] text-text-secondary print:text-slate-500 font-mono mt-0.5">{statementData.customer.customer_code}</p>
                    {statementData.customer.phone && <p className="text-[10px] text-text-secondary print:text-slate-500 font-mono">{statementData.customer.phone}</p>}
                  </div>
                </div>

                {/* Balance summaries */}
                <div className="grid grid-cols-4 gap-3 bg-surface-app/40 border border-border-subtle rounded-lg p-3 print:bg-slate-100 print:border-slate-300 print:text-black">
                  <div>
                    <span className="text-[10px] text-text-secondary print:text-slate-600">Opening Balance</span>
                    <p className="font-mono text-white font-bold mt-1 print:text-black">{formatPaise(statementData.opening_balance_paise)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary print:text-slate-600">Total DR (Debits)</span>
                    <p className="font-mono text-red-400 font-bold mt-1 print:text-red-700">+{formatPaise(statementData.total_debits_paise)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary print:text-slate-600">Total CR (Credits)</span>
                    <p className="font-mono text-brand-500 font-bold mt-1 print:text-emerald-700">-{formatPaise(statementData.total_credits_paise)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-secondary print:text-slate-600">Closing Balance</span>
                    <p className="font-mono text-white font-bold mt-1 print:text-black">{formatPaise(statementData.closing_balance_paise)}</p>
                  </div>
                </div>

                {/* Details Table */}
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b-2 border-border-subtle bg-surface-app/40 print:bg-slate-200 print:border-slate-300 text-[10px]">
                      <th className="px-3 py-2 text-text-secondary font-semibold print:text-black">Date</th>
                      <th className="px-3 py-2 text-text-secondary font-semibold print:text-black">Type</th>
                      <th className="px-4 py-2 text-text-secondary font-semibold print:text-black">Description</th>
                      <th className="px-3 py-2 text-right text-red-400 font-semibold print:text-red-700">Debit (DR)</th>
                      <th className="px-3 py-2 text-right text-brand-500 font-semibold print:text-emerald-700">Credit (CR)</th>
                      <th className="px-3 py-2 text-right text-text-secondary font-semibold print:text-black">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle print:divide-slate-200">
                    {statementData.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-text-secondary">No transactions in this period</td>
                      </tr>
                    ) : (
                      statementData.entries.map((r: any) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 font-mono text-white print:text-black">{formatDate(r.entry_date)}</td>
                          <td className="px-3 py-2 font-semibold text-[10px] uppercase text-text-secondary print:text-black">{getLedgerRefLabel(r.ref_type as any)}</td>
                          <td className="px-4 py-2 text-white/90 print:text-black">{r.description}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-400 print:text-red-600">
                            {r.debit_paise > 0 ? `+${formatPaise(r.debit_paise)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-brand-500 print:text-emerald-700">
                            {r.credit_paise > 0 ? `-${formatPaise(r.credit_paise)}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white print:text-black">{formatPaise(r.running_balance_paise)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'collections' && (
          <div className="h-full overflow-auto p-6 space-y-5">
            {/* Range selection */}
            <div className="bg-surface-panel border border-border-subtle p-4 rounded-xl flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">Start Date</label>
                <input
                  type="date"
                  value={colStart}
                  onChange={(e) => setColStart(e.target.value)}
                  className="bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-secondary mb-1">End Date</label>
                <input
                  type="date"
                  value={colEnd}
                  onChange={(e) => setColEnd(e.target.value)}
                  className="bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white"
                />
              </div>
              <button
                onClick={() => refetchCol()}
                className="px-4 py-2 bg-accent hover:bg-brand-500 rounded-lg text-white font-bold transition-colors"
              >
                Fetch Collections
              </button>
            </div>

            {/* Metrics cards */}
            {!!collectionSummary && (() => {
              const colData = collectionSummary as any;
              return (
                <>
                  <div className="grid grid-cols-6 gap-3">
                    <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 col-span-2">
                      <p className="text-[10px] text-text-secondary font-medium">TOTAL RECEIVED</p>
                      <p className="text-base font-mono font-bold text-brand-500 mt-1">{formatPaise(colData.total_collected_paise)}</p>
                    </div>
                    {Object.entries(colData.by_method).map(([method, val]: any) => (
                      <div key={method} className="bg-surface-panel border border-border-subtle rounded-xl p-3">
                        <p className="text-[10px] text-text-secondary font-medium capitalize">{method.replace('_', ' ')}</p>
                        <p className="text-xs font-mono font-bold text-white mt-1">{formatPaise(val)}</p>
                      </div>
                    ))}
                  </div>

                  {/* Collection transaction logs */}
                  <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                      <h3 className="font-semibold text-white">Payment Collections Log</h3>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border-subtle bg-surface-app/40 text-[10px]">
                          <th className="px-4 py-2.5 text-text-secondary">Date</th>
                          <th className="px-4 py-2.5 text-text-secondary">Customer</th>
                          <th className="px-3 py-2.5 text-text-secondary">Method</th>
                          <th className="px-3 py-2.5 text-text-secondary">Reference</th>
                          <th className="px-4 py-2.5 text-text-secondary">Remarks</th>
                          <th className="px-4 py-2.5 text-right text-brand-500 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {colData.payments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-text-secondary">No payment entries in this period</td>
                          </tr>
                        ) : (
                          colData.payments.map((p: any) => (
                            <tr key={p.id} className="hover:bg-surface-app/20 transition-colors">
                              <td className="px-4 py-2 font-mono text-white">{formatDate(p.payment_date)}</td>
                              <td className="px-4 py-2 text-white">
                                <div className="font-semibold">{p.customer_name}</div>
                                <div className="text-[10px] text-text-secondary font-mono">{p.customer_code}</div>
                              </td>
                              <td className="px-3 py-2 capitalize text-white">{p.method.replace('_', ' ')}</td>
                              <td className="px-3 py-2 font-mono text-white/90">{p.reference_number || '—'}</td>
                              <td className="px-4 py-2 text-text-secondary">{p.notes || '—'}</td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-brand-500">{formatPaise(p.amount_paise)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function PrinterIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
    </svg>
  );
}
