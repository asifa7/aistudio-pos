import React, { useState } from 'react';
import {
  BookOpen,
  Printer,
  FileText,
  Eye,
  Edit2,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Search,
} from 'lucide-react';
import {
  usePassbookLedger,
  useSuppliersProfile,
  useSupplierSnapshot,
  usePrintPurchaseThermal,
} from '../../hooks/useSupplierProcurement';
import { formatPaise, formatDate, PassbookLedgerEntry } from '../../types/supplier.types';
import InvoiceTemplateModal, { InvoiceTemplateData } from './InvoiceTemplateModal';

import BillCrossCheckModal from './BillCrossCheckModal';
import SupplierPaymentDialog from '../suppliers/SupplierPaymentDialog';
import { useSession } from '../../../../auth/frontend/hooks/useAuth';
import { useQuickPurchaseStore } from '../../hooks/useQuickPurchaseStore';
import { IPC_CHANNELS } from '../../../../../core/ipc/channels';
import { useDuePurchasesList } from '../../../../ledger/frontend/hooks/usePaymentEngine';

interface Props {
  initialSupplierId?: number;
  onSwitchToQuickTab?: () => void;
}

export default function PassbookLedgerView({ initialSupplierId, onSwitchToQuickTab }: Props) {
  const { data: session } = useSession();
  const isAdminOrManager = session?.role === 'ADMIN' || session?.role === 'MANAGER';

  // View Mode: 'ledger' or 'due'
  const [viewMode, setViewMode] = useState<'ledger' | 'due'>('ledger');

  // Filters State
  const [supplierId, setSupplierId] = useState<number | undefined>(initialSupplierId);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'IN' | 'OUT'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [productFilter, setProductFilter] = useState<string>('');

  // Expandable Rows State
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Active Popovers & Modals
  const [printPopoverId, setPrintPopoverId] = useState<string | null>(null);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<InvoiceTemplateData | null>(null);

  const [viewingBillEntry, setViewingBillEntry] = useState<PassbookLedgerEntry | null>(null);
  const [payingSupplier, setPayingSupplier] = useState<{ id: number; name: string; balancePaise: number } | null>(null);

  // Password confirmation states for full invoice edit
  const [passwordPromptEntry, setPasswordPromptEntry] = useState<PassbookLedgerEntry | null>(null);
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const handleEditVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordConfirm.trim()) {
      alert('Please enter your password.');
      return;
    }

    try {
      // 1. Verify password via IPC
      const verifyRes = await window.api.invoke(IPC_CHANNELS.AUTH.VERIFY_PASSWORD, { password: passwordConfirm });
      if (!verifyRes.success || !verifyRes.data) {
        alert('Invalid password. Authorized managers/admins only.');
        return;
      }

      // 2. Fetch full purchase invoice details (invoice + items)
      const fetchRes = await window.api.invoke(IPC_CHANNELS.PROCUREMENT.INVOICE_GET_BY_ID, { id: passwordPromptEntry!.ref_id });
      if (!fetchRes.success || !fetchRes.data) {
        alert('Failed to retrieve purchase invoice details: ' + (fetchRes.error?.message || 'Unknown error'));
        return;
      }

      // 3. Load into Zustand store and switch active workspace tab
      const { startEditInvoice } = useQuickPurchaseStore.getState();
      startEditInvoice(fetchRes.data.invoice, fetchRes.data.items);

      setPasswordPromptEntry(null);
      setPasswordConfirm('');

      onSwitchToQuickTab?.();
    } catch (err: any) {
      alert(err.message || 'Authentication check failed');
    }
  };

  const { data: suppliers } = useSuppliersProfile();
  const { data: supplierSnapshot } = useSupplierSnapshot(supplierId);

  const { data: ledgerData, isLoading, refetch } = usePassbookLedger({
    supplierId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status: statusFilter,
  });

  const { data: duePurchases, isLoading: isDueLoading } = useDuePurchasesList({
    supplierId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const printThermalMutation = usePrintPurchaseThermal();

  const toggleRowExpanded = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrintThermal = async (invoiceId: number) => {
    try {
      const result = await printThermalMutation.mutateAsync({ invoiceId });
      alert(`Thermal Receipt Slip generated:\n\n${result.receiptText}`);
    } catch (err: any) {
      alert('Thermal print error: ' + err.message);
    }
  };

  const handleOpenA4Invoice = (entry: PassbookLedgerEntry) => {
    const invData: InvoiceTemplateData = {
      invoiceNumber: entry.supplier_bill_number || `INV-${entry.ref_id}`,
      invoiceDate: entry.entry_date,
      poNumber: entry.purchase_ref_number,
      fromName: entry.supplier_name,
      billToName: 'Meat Shop Store',
      billToAddress: 'Main Counter / Inventory Dept',
      items: [
        {
          qty: 1,
          description: entry.items_summary || entry.description,
          unitPricePaise: entry.amount_paise,
          amountPaise: entry.amount_paise,
        },
      ],
      subtotalPaise: entry.amount_paise,
      totalPaise: entry.amount_paise,
    };
    setSelectedInvoiceData(invData);
  };

  // Filter entries locally by type, search query, & product
  const filteredEntries = (ledgerData?.entries || []).filter(entry => {
    if (typeFilter !== 'all' && entry.type !== typeFilter) return false;
    if (productFilter.trim()) {
      const p = productFilter.toLowerCase().trim();
      const matchProduct = (entry.items_summary || '').toLowerCase().includes(p);
      if (!matchProduct) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = entry.supplier_name.toLowerCase().includes(q);
      const matchRef = (entry.purchase_ref_number || '').toLowerCase().includes(q);
      const matchBill = (entry.supplier_bill_number || '').toLowerCase().includes(q);
      const matchDesc = (entry.items_summary || entry.description || '').toLowerCase().includes(q);
      if (!matchName && !matchRef && !matchBill && !matchDesc) return false;
    }
    return true;
  });

  const selectedSupplierObj = suppliers?.find(s => s.id === supplierId);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-app p-4 sm:p-6 space-y-5 text-text-primary overflow-auto">
      
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
            <BookOpen className="text-brand-500" />
            <span>Purchases In/Out Passbook Ledger</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">
            Real-time movement ledger showing stock receipts (IN), payments (OUT), and live running balances.
          </p>
        </div>

        <div className="flex p-1 bg-surface-panel border border-border-subtle rounded-xl">
          <button
            onClick={() => setViewMode('ledger')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'ledger'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Passbook Ledger
          </button>
          <button
            onClick={() => setViewMode('due')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewMode === 'due'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <span>Outstanding / Due Bills</span>
            {(duePurchases?.length || 0) > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full">
                {duePurchases?.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Selected Supplier Outstanding Summary Strip */}
      {supplierId && selectedSupplierObj && (
        <div className="bg-gradient-to-r from-surface-panel via-surface-panel to-surface-card border border-brand-500/30 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-outfit text-text-primary">
                  {selectedSupplierObj.company_name}
                </h3>
                <span className="text-[10px] uppercase font-bold text-text-muted bg-surface-card px-2 py-0.5 rounded border border-border-subtle">
                  Supplier #{selectedSupplierObj.id}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Phone: {selectedSupplierObj.phone || 'N/A'} | Tax GSTIN: {selectedSupplierObj.gstin || 'Unregistered'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-[10px] uppercase font-bold text-text-muted block">Total Outstanding Owed</span>
              <span className="text-xl font-mono font-extrabold text-rose-400">
                {formatPaise(supplierSnapshot?.outstanding_balance_paise ?? selectedSupplierObj.outstanding_balance_paise)}
              </span>
            </div>

            {supplierSnapshot?.last_purchase_date && (
              <div className="hidden sm:block border-l border-border-subtle pl-4">
                <span className="text-[10px] uppercase font-bold text-text-muted block">Last Purchase</span>
                <span className="text-xs font-bold text-text-primary block">
                  {formatDate(supplierSnapshot.last_purchase_date)}
                </span>
                <span className="text-xs font-mono font-bold text-brand-400">
                  {supplierSnapshot.last_purchase_amount_paise ? formatPaise(supplierSnapshot.last_purchase_amount_paise) : '-'}
                </span>
              </div>
            )}

            {/* Quick Pay Now Button */}
            <button
              onClick={() =>
                setPayingSupplier({
                  id: selectedSupplierObj.id,
                  name: selectedSupplierObj.company_name,
                  balancePaise: supplierSnapshot?.outstanding_balance_paise ?? selectedSupplierObj.outstanding_balance_paise,
                })
              }
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
            >
              <CreditCard size={16} /> Pay Now 💳
            </button>
          </div>
        </div>
      )}

      {/* Combinable Filter Toolbar */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Supplier Dropdown */}
          <div className="w-full sm:w-64">
            <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">Filter Supplier</label>
            <select
              value={supplierId || ''}
              onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-medium focus:outline-none focus:border-brand-500"
            >
              <option value="">All Suppliers (Combined Passbook)</option>
              {suppliers?.map(s => (
                <option key={s.id} value={s.id}>
                  {s.company_name} {s.phone ? `(${s.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Permanent Date Range Filter Bar */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[10px] uppercase font-bold text-text-muted">Date Range (From – To)</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(today);
                    setEndDate(today);
                  }}
                  className="text-[9.5px] px-1.5 py-0.5 rounded bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-brand-400 font-semibold border border-border-subtle transition-colors"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(firstDay);
                    setEndDate(today);
                  }}
                  className="text-[9.5px] px-1.5 py-0.5 rounded bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-brand-400 font-semibold border border-border-subtle transition-colors"
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    const today = new Date().toISOString().split('T')[0];
                    setStartDate(firstDay);
                    setEndDate(today);
                  }}
                  className="text-[9.5px] px-1.5 py-0.5 rounded bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-brand-400 font-semibold border border-border-subtle transition-colors"
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[9.5px] px-1.5 py-0.5 rounded bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-brand-400 font-semibold border border-border-subtle transition-colors"
                >
                  All
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 h-[38px] box-border">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-text-primary focus:outline-none font-mono"
              />
              <span className="text-text-muted text-xs font-semibold px-0.5">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-text-primary focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">Movement Type</label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-medium focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Movements</option>
              <option value="IN">Purchases (IN ↓)</option>
              <option value="OUT">Payments (OUT ↑)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-medium focus:outline-none focus:border-brand-500"
            >
              <option value="all">All Status</option>
              <option value="approved">Confirmed Only</option>
              <option value="pending_approval">Pending Approval Only</option>
            </select>
          </div>

          {/* Product Filter */}
          <div className="w-full sm:w-48">
            <label className="block text-[10px] uppercase font-bold text-text-muted mb-1">Filter Product</label>
            <input
              type="text"
              placeholder="e.g. Chicken, Mutton..."
              value={productFilter}
              onChange={e => setProductFilter(e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary font-medium focus:outline-none focus:border-brand-500"
            />
          </div>

        </div>

        {/* Search Bar */}
        <div className="relative pt-2 border-t border-border-subtle">
          <Search size={15} className="absolute left-3 top-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by supplier name, PUR reference #, bill #, or items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Main Passbook Table OR Due Purchases Table */}
      {viewMode === 'due' ? (
        <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-border-subtle bg-surface-card flex items-center justify-between">
            <div>
              <h3 className="font-bold text-xs text-text-primary uppercase tracking-wider">
                Outstanding / Due Purchase Invoices
              </h3>
              <p className="text-[11px] text-text-muted">Unpaid or partially-paid invoices requiring payment settlement.</p>
            </div>
            <div className="text-xs font-mono">
              Total Unpaid Invoices: <strong className="text-rose-400 font-bold">{duePurchases?.length || 0}</strong>
            </div>
          </div>

          {isDueLoading ? (
            <div className="p-12 text-center text-text-muted text-xs">Loading outstanding purchases...</div>
          ) : !duePurchases || duePurchases.length === 0 ? (
            <div className="p-12 text-center text-emerald-400 text-xs font-bold">
              ✓ All purchase invoices are fully paid! No outstanding supplier dues.
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-card border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Invoice # / Date</th>
                    <th className="py-3 px-3">Due Date / Overdue</th>
                    <th className="py-3 px-3 text-right">Invoice Total</th>
                    <th className="py-3 px-3 text-right">Paid Amount</th>
                    <th className="py-3 px-3 text-right">Balance Due</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-right">Quick Jump / Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle font-medium">
                  {duePurchases.map(p => {
                    const dueRupees = p.outstanding_balance_paise / 100;
                    const totalRupees = p.total_amount_paise / 100;
                    const paidRupees = p.paid_amount_paise / 100;

                    return (
                      <tr key={p.id} className="hover:bg-surface-hover transition-colors">
                        <td className="py-3 px-3 font-semibold text-text-primary">
                          <div>{p.supplier_company || p.supplier_name}</div>
                          <div className="text-[10px] text-text-muted">Supplier #{p.supplier_id}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-xs">
                          <div className="font-bold text-brand-400">{p.supplier_invoice_number || p.invoice_number}</div>
                          <div className="text-[10px] text-text-muted">{p.invoice_date}</div>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <div className="font-mono text-text-muted">{p.due_date || '—'}</div>
                          {p.days_overdue > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                              {p.days_overdue} days overdue
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-text-muted">
                          ₹{totalRupees.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400">
                          ₹{paidRupees.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-400 text-sm">
                          ₹{dueRupees.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            p.payment_status === 'partial' ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'
                          }`}>
                            {p.payment_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedInvoiceData({
                                  invoiceNumber: p.supplier_invoice_number || p.invoice_number,
                                  invoiceDate: p.invoice_date,
                                  poNumber: p.invoice_number,
                                  fromName: p.supplier_company || p.supplier_name,
                                  billToName: 'Meat Shop Store',
                                  billToAddress: 'Main Counter / Inventory Dept',
                                  items: [
                                    {
                                      qty: 1,
                                      description: `Purchase Invoice #${p.supplier_invoice_number || p.invoice_number}`,
                                      unitPricePaise: p.total_amount_paise,
                                      amountPaise: p.total_amount_paise,
                                    }
                                  ],
                                  subtotalPaise: p.total_amount_paise,
                                  totalPaise: p.total_amount_paise,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-surface-card hover:bg-surface-app border border-border-subtle text-text-primary text-[11px] font-semibold flex items-center gap-1 transition-colors"
                              title="Quick jump to original invoice preview / print"
                            >
                              <Eye size={13} /> View Invoice
                            </button>
                            <button
                              onClick={() =>
                                setPayingSupplier({
                                  id: p.supplier_id,
                                  name: p.supplier_company || p.supplier_name,
                                  balancePaise: p.outstanding_balance_paise,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors"
                            >
                              <CreditCard size={13} /> Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      /* Main Passbook Table (NO Horizontal Scroll Layout) */
      <div className="bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading passbook movement ledger...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-xs">No matching passbook ledger entries found.</div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse text-xs table-fixed">
              <thead>
                <tr className="bg-surface-card border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider sticky top-0 z-10">
                  <th className="w-8 py-3 px-2 text-center"></th>
                  <th className="w-24 py-3 px-3">Date</th>
                  <th className="w-28 py-3 px-2 text-center">Type</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="w-36 py-3 px-3">Ref / Bill #</th>
                  <th className="w-36 py-3 px-3 text-right">Amount (₹)</th>
                  <th className="w-28 py-3 px-3 text-center">Status</th>
                  <th className="w-44 py-3 px-3 text-right">Running Balance</th>
                  <th className="w-56 py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-medium">
                {filteredEntries.map(entry => {
                  const isIn = entry.type === 'IN';
                  const isPending = entry.status === 'pending_approval';
                  const isExpanded = !!expandedRows[entry.id];
                  const balance = entry.running_balance_paise;

                  // High-Contrast Meaningful Running Balance Color System
                  let balanceClass = 'pill-balance-settled';
                  let balanceLabel = '₹0.00 (Settled)';
                  if (balance > 0) {
                    balanceClass = 'pill-balance-owed';
                    balanceLabel = formatPaise(balance);
                  } else if (balance < 0) {
                    balanceClass = 'pill-balance-credit';
                    balanceLabel = `-${formatPaise(Math.abs(balance))} (Credit)`;
                  }

                  const hoursDiff = (Date.now() - new Date(entry.entry_date).getTime()) / (1000 * 60 * 60);
                  const isEditable = isAdminOrManager && hoursDiff <= 24 && isIn;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="hover:bg-surface-hover/50 transition-colors group">
                        {/* Expand Chevron */}
                        <td className="py-3 px-2 text-center cursor-pointer" onClick={() => toggleRowExpanded(entry.id)}>
                          <button className="text-text-muted hover:text-text-primary">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 text-text-secondary whitespace-nowrap text-[11px]">
                          {formatDate(entry.entry_date)}
                        </td>

                        {/* Movement Type */}
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <span className={isIn ? 'badge-warning' : 'badge-success'}>
                            {isIn ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                            {isIn ? 'IN (Stock)' : 'OUT (Pay)'}
                          </span>
                        </td>

                        {/* Supplier */}
                        <td className="py-3 px-3 font-bold text-text-primary truncate" title={entry.supplier_name}>
                          {entry.supplier_name}
                        </td>

                        {/* Ref / Bill # */}
                        <td className="py-3 px-3 font-mono text-[11px] truncate">
                          <div className="flex flex-col">
                            <span className="text-brand-500 font-extrabold block" title="Internal Reference Number">
                              Int Ref: {entry.purchase_ref_number || `PUR-${entry.ref_id}`}
                            </span>
                            {entry.supplier_bill_number ? (
                              <span className="text-text-muted text-[10px] block" title="Supplier Bill Number">
                                Supp Bill: {entry.supplier_bill_number}
                              </span>
                            ) : (
                              <span className="text-text-muted/50 text-[10px] block italic">
                                Supp Bill: N/A
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className={`py-3 px-3 text-right font-mono font-extrabold whitespace-nowrap text-xs ${
                          isIn ? 'text-text-primary' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {isIn ? formatPaise(entry.amount_paise) : `-${formatPaise(entry.amount_paise)}`}
                        </td>

                        {/* Status Badge (High Contrast) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={isPending ? 'badge-warning' : 'badge-success'}>
                            {isPending ? 'Pending' : 'Confirmed'}
                          </span>
                        </td>

                        {/* Running Balance Column (Full Content Visible, No Truncation) */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className={balanceClass}>
                            {balanceLabel}
                          </span>
                        </td>

                        {/* Actions Column (Fixed Grid Slots for Perfect Vertical Alignment) */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5 relative min-w-[210px]">
                            
                            {/* Slot 1: View Bill Action */}
                            <button
                              onClick={() => setViewingBillEntry(entry)}
                              className="px-2.5 py-1 bg-surface-card hover:bg-surface-hover text-brand-500 border border-border-subtle rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm shrink-0"
                              title="View and Cross-Check Physical Bill"
                            >
                              <Eye size={12} /> View Bill
                            </button>

                            {/* Slot 2: Merged Single Print Button with Dropdown Popover */}
                            {isIn ? (
                              <div className="relative shrink-0">
                                <button
                                  onClick={() => setPrintPopoverId(printPopoverId === entry.id ? null : entry.id)}
                                  className="px-2 py-1 bg-surface-card hover:bg-surface-hover text-text-primary border border-border-subtle rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                >
                                  <Printer size={12} /> Print <ChevronDown size={10} />
                                </button>

                                {printPopoverId === entry.id && (
                                  <div className="absolute right-0 top-full mt-1 z-30 bg-surface-panel border border-border-subtle rounded-xl p-1.5 shadow-2xl space-y-1 w-36 text-left">
                                    <button
                                      onClick={() => {
                                        setPrintPopoverId(null);
                                        handleOpenA4Invoice(entry);
                                      }}
                                      className="w-full px-2.5 py-1.5 hover:bg-surface-hover rounded-lg text-[11px] font-bold text-text-primary flex items-center gap-2"
                                    >
                                      <FileText size={13} className="text-brand-500" /> Print A4 Invoice
                                    </button>

                                    <button
                                      onClick={() => {
                                        setPrintPopoverId(null);
                                        handlePrintThermal(entry.ref_id);
                                      }}
                                      className="w-full px-2.5 py-1.5 hover:bg-surface-hover rounded-lg text-[11px] font-bold text-text-primary flex items-center gap-2"
                                    >
                                      <Printer size={13} className="text-emerald-500" /> Print Thermal Slip
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="w-[68px] shrink-0" />
                            )}

                             {/* Slot 3: Edit Action (Admin/Manager) */}
                             {isEditable ? (
                               <button
                                 onClick={() => setPasswordPromptEntry(entry)}
                                 className="p-1 bg-surface-card hover:bg-surface-hover text-amber-500 border border-border-subtle rounded-lg shadow-sm shrink-0"
                                 title="Edit Purchase details (requires manager authorization)"
                               >
                                 <Edit2 size={12} />
                               </button>
                             ) : (
                              <div className="w-6 shrink-0" />
                            )}

                          </div>
                        </td>
                      </tr>

                      {/* Expandable Row Itemized Details */}
                      {isExpanded && (
                        <tr className="bg-surface-card/40 border-b border-border-subtle">
                          <td colSpan={9} className="p-4">
                            <div className="bg-surface-card p-3 rounded-xl border border-border-subtle space-y-2 text-xs">
                              <div className="flex items-center justify-between font-bold text-brand-400 text-[11px]">
                                <span>Itemized Description / Breakdown:</span>
                                <span>Ref ID: #{entry.ref_id}</span>
                              </div>
                              <p className="text-text-primary font-medium leading-relaxed">
                                {entry.items_summary || entry.description}
                              </p>
                              {entry.file_path && (
                                <p className="text-[10px] text-text-muted font-mono truncate">
                                  File: {entry.file_path}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Bill Cross-Check Modal */}
      {viewingBillEntry && (
        <BillCrossCheckModal
          entry={viewingBillEntry}
          onClose={() => setViewingBillEntry(null)}
          onFlagMismatch={(entry) => {
            setViewingBillEntry(null);
            setPasswordPromptEntry(entry);
          }}
          onAttachPhoto={(entry) => {
            setViewingBillEntry(null);
            setPasswordPromptEntry(entry);
          }}
        />
      )}

      {/* A4 Invoice Preview Modal */}
      {selectedInvoiceData && (
        <InvoiceTemplateModal
          data={selectedInvoiceData}
          onClose={() => setSelectedInvoiceData(null)}
        />
      )}

      {/* Password override modal for full bill editing */}
      {passwordPromptEntry && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-text-primary">
            <div>
              <h3 className="text-base font-bold font-outfit text-amber-400">
                🔒 Manager Authorization Required
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Editing Invoice #{passwordPromptEntry.supplier_bill_number || passwordPromptEntry.ref_id} from ledger requires authorization.
              </p>
            </div>

            <form onSubmit={handleEditVerifyPassword} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-text-secondary mb-1">Enter Manager/Admin Password</label>
                <input
                  type="password"
                  required
                  value={passwordConfirm}
                  onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordPromptEntry(null);
                    setPasswordConfirm('');
                  }}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-lg text-text-secondary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg"
                >
                  Unlock & Edit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Quick Payment Dialog */}
      {payingSupplier && (
        <SupplierPaymentDialog
          supplierId={payingSupplier.id}
          supplierName={payingSupplier.name}
          outstandingBalancePaise={payingSupplier.balancePaise}
          onClose={() => setPayingSupplier(null)}
          onSuccess={() => {
            setPayingSupplier(null);
            refetch();
          }}
        />
      )}

    </div>
  );
}
