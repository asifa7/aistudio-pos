import React, { useState, useMemo, useRef } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Landmark, 
  Search, 
  ArrowRightLeft, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Calendar, 
  DollarSign,
  Sparkles,
  RotateCcw,
  History,
  FileText,
  Clock,
  Plus
} from 'lucide-react';
import { 
  useLiquidBalances, 
  useOpenBills, 
  usePaymentRegister, 
  useRecordPaymentReceipt,
  useOutstandingPurchaseBills,
  PaymentReceiptVoucher,
  OutstandingPurchaseBill
} from '../hooks/usePaymentEngine';
import { useSuppliersProfile } from '../../../inventory/frontend/hooks/useSupplierProcurement';
import { useCustomers } from '../../../customers/frontend/hooks/useCustomers';
import ContraTransferModal from './ContraTransferModal';
import VoucherPrintModal from './VoucherPrintModal';
import BillPaymentModal from './BillPaymentModal';
import BillHistoryModal from './BillHistoryModal';
import PaymentReversalModal from './PaymentReversalModal';

const EXPENSE_CATEGORIES = [
  'Electricity & Utilities',
  'Shop Rent',
  'Staff Wages / Salary',
  'Packaging & Bags',
  'Ice & Refrigeration Salt',
  'Equipment Maintenance & Repairs',
  'Cleaning & Sanitization',
  'Transportation & Logistics',
  'Tea, Snacks & Refreshments',
  'Other Miscellaneous Expense'
];

const INCOME_CATEGORIES = [
  'Scrap & By-Product Sales',
  'Skin / Feather / Offal Sales',
  'Discount Received',
  'Interest Income',
  'Miscellaneous Receipt'
];

export default function PaymentsReceiptsView() {
  // Main sub-tabs: Outstanding Bills (Default), Voucher Entry, Payment Register
  const [activeTab, setActiveTab] = useState<'outstanding' | 'entry' | 'register'>('outstanding');
  const [isContraOpen, setIsContraOpen] = useState(false);
  const [selectedVoucherForPrint, setSelectedVoucherForPrint] = useState<PaymentReceiptVoucher | null>(null);

  // Modals for Outstanding Bills Workflow
  const [isBillPaymentModalOpen, setIsBillPaymentModalOpen] = useState(false);
  const [paymentModalSupplierId, setPaymentModalSupplierId] = useState<number>(0);
  const [paymentModalSupplierName, setPaymentModalSupplierName] = useState<string>('');
  const [paymentModalSelectedBills, setPaymentModalSelectedBills] = useState<OutstandingPurchaseBill[]>([]);

  const [selectedBillForHistory, setSelectedBillForHistory] = useState<OutstandingPurchaseBill | null>(null);
  const [selectedVoucherForReversal, setSelectedVoucherForReversal] = useState<PaymentReceiptVoucher | null>(null);

  // Financial Balances Query
  const { data: balances } = useLiquidBalances();

  // Fetch Parties
  const { data: suppliers } = useSuppliersProfile();
  const { data: customers } = useCustomers();

  // ─── OUTSTANDING BILLS TAB STATE ──────────────────────────────────────────
  const [billsStatusFilter, setBillsStatusFilter] = useState<'outstanding' | 'unpaid' | 'partial' | 'paid' | 'all'>('outstanding');
  const [billsSupplierFilter, setBillsSupplierFilter] = useState<number | undefined>(undefined);
  const [billsSearch, setBillsSearch] = useState<string>('');
  const [billsSortBy, setBillsSortBy] = useState<'due_date' | 'total_amount' | 'outstanding' | 'supplier'>('due_date');
  const [billsSortOrder, setBillsSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-select bill IDs map: bill_id -> true
  const [selectedBillIds, setSelectedBillIds] = useState<Record<number, boolean>>({});

  const { data: outstandingBills = [], isLoading: isBillsLoading, refetch: refetchBills } = useOutstandingPurchaseBills({
    status: billsStatusFilter,
    supplierId: billsSupplierFilter,
    search: billsSearch,
    sortBy: billsSortBy,
    sortOrder: billsSortOrder,
  });

  // Calculate totals for Outstanding Bills Tab
  const totalOutstandingLiabilitiesPaise = useMemo(() => {
    return outstandingBills.reduce((sum, b) => sum + (b.outstanding_balance_paise > 0 ? b.outstanding_balance_paise : 0), 0);
  }, [outstandingBills]);

  const overdueCount = useMemo(() => {
    return outstandingBills.filter(b => b.outstanding_balance_paise > 0 && b.days_overdue > 0).length;
  }, [outstandingBills]);

  // Selected bills array
  const selectedBillsArray = useMemo(() => {
    return outstandingBills.filter(b => selectedBillIds[b.id]);
  }, [outstandingBills, selectedBillIds]);

  // Ensure all selected bills belong to the same supplier
  const selectedSupplierId = selectedBillsArray.length > 0 ? selectedBillsArray[0].supplier_id : null;
  const isMultiSupplierSelected = selectedBillsArray.some(b => b.supplier_id !== selectedSupplierId);

  const handleToggleSelectBill = (bill: OutstandingPurchaseBill) => {
    setSelectedBillIds(prev => {
      const next = { ...prev };
      if (next[bill.id]) {
        delete next[bill.id];
      } else {
        next[bill.id] = true;
      }
      return next;
    });
  };

  const handleOpenPaymentForSingleBill = (bill: OutstandingPurchaseBill) => {
    setPaymentModalSupplierId(bill.supplier_id);
    setPaymentModalSupplierName(bill.supplier_company || bill.supplier_name);
    setPaymentModalSelectedBills([bill]);
    setIsBillPaymentModalOpen(true);
  };

  const handleOpenPaymentForSelectedBills = () => {
    if (selectedBillsArray.length === 0 || isMultiSupplierSelected || !selectedSupplierId) return;
    const supp = suppliers?.find(s => s.id === selectedSupplierId);
    setPaymentModalSupplierId(selectedSupplierId);
    setPaymentModalSupplierName(supp?.company_name || selectedBillsArray[0].supplier_company || selectedBillsArray[0].supplier_name);
    setPaymentModalSelectedBills(selectedBillsArray);
    setIsBillPaymentModalOpen(true);
  };

  // ─── VOUCHER ENTRY TAB STATE ──────────────────────────────────────────────
  const [direction, setDirection] = useState<'payment' | 'receipt'>('payment');
  const [method, setMethod] = useState<'cash' | 'bank' | 'upi' | 'card'>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  const [partyMode, setPartyMode] = useState<'party' | 'category'>('party');
  const [selectedPartyId, setSelectedPartyId] = useState<number | null>(null);
  const [selectedPartyName, setSelectedPartyName] = useState<string>('');
  const [partySearch, setPartySearch] = useState<string>('');
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState<boolean>(false);
  const [customCategory, setCustomCategory] = useState<string>('');

  const [amountRupees, setAmountRupees] = useState<string>('');
  const [narration, setNarration] = useState<string>('');
  const [allocationsMap, setAllocationsMap] = useState<Record<number, string>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const partyType = direction === 'payment' ? 'supplier' : 'customer';
  const { data: openBills } = useOpenBills(partyType, selectedPartyId);

  // ─── REGISTER TAB STATE ───────────────────────────────────────────────────
  const [registerStartDate, setRegisterStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [registerEndDate, setRegisterEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [registerDirection, setRegisterDirection] = useState<string>('all');
  const [registerMethod, setRegisterMethod] = useState<string>('all');
  const [registerSearch, setRegisterSearch] = useState<string>('');

  const { data: registerData, isLoading: isRegisterLoading, refetch: refetchRegister } = usePaymentRegister({
    startDate: registerStartDate,
    endDate: registerEndDate,
    direction: registerDirection,
    paymentMethod: registerMethod,
    search: registerSearch,
  });

  const recordPaymentMutation = useRecordPaymentReceipt();

  // Matching Parties for Voucher Entry
  const matchingParties = useMemo(() => {
    if (!partySearch.trim()) return [];
    const q = partySearch.toLowerCase().trim();

    if (direction === 'payment') {
      return (suppliers || []).filter(s => 
        (s.company_name && s.company_name.toLowerCase().includes(q)) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      ).slice(0, 8).map(s => ({
        id: s.id,
        name: s.company_name || s.owner_name || 'Supplier',
        phone: s.phone,
        balancePaise: s.outstanding_balance_paise || 0,
      }));
    } else {
      return (customers || []).filter(c => 
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
      ).slice(0, 8).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        balancePaise: c.outstanding_balance_paise || 0,
      }));
    }
  }, [suppliers, customers, direction, partySearch]);

  const handleSelectParty = (party: { id: number; name: string; balancePaise: number }) => {
    setSelectedPartyId(party.id);
    setSelectedPartyName(party.name);
    setPartySearch(party.name);
    setIsPartyDropdownOpen(false);
    setAllocationsMap({});
    setTimeout(() => amountInputRef.current?.focus(), 100);
  };

  const numericAmount = parseFloat(amountRupees) || 0;
  const totalAllocatedRupees = useMemo(() => {
    return Object.values(allocationsMap).reduce<number>((sum: number, val: string) => {
      const num = parseFloat(val) || 0;
      return sum + num;
    }, 0);
  }, [allocationsMap]);

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (numericAmount <= 0) {
      setErrorMsg('Please enter an amount greater than 0.');
      return;
    }

    if (partyMode === 'party' && !selectedPartyId) {
      setErrorMsg(`Please select a valid ${direction === 'payment' ? 'supplier' : 'customer'}.`);
      return;
    }

    if (partyMode === 'category' && !customCategory.trim()) {
      setErrorMsg('Please select or specify an expense/income category.');
      return;
    }

    if (totalAllocatedRupees > numericAmount) {
      setErrorMsg(`Allocated amount (₹${totalAllocatedRupees.toFixed(2)}) cannot exceed total amount (₹${numericAmount.toFixed(2)}).`);
      return;
    }

    const allocationPayload = Object.entries(allocationsMap)
      .filter(([_, val]) => (parseFloat(val) || 0) > 0)
      .map(([billId, val]) => {
        const bill = (openBills || []).find(b => b.id === Number(billId));
        return {
          bill_type: (direction === 'payment' ? 'purchase_invoice' : 'sale_invoice') as 'purchase_invoice' | 'sale_invoice',
          bill_id: Number(billId),
          bill_number: bill?.bill_number || `BILL-${billId}`,
          allocated_amount_paise: Math.round((parseFloat(val) || 0) * 100),
        };
      });

    try {
      const res = await recordPaymentMutation.mutateAsync({
        direction,
        payment_method: method,
        party_type: partyMode === 'party' ? (direction === 'payment' ? 'supplier' : 'customer') : 'other',
        party_id: partyMode === 'party' ? selectedPartyId : null,
        party_name: partyMode === 'party' ? selectedPartyName : customCategory,
        category: partyMode === 'category' ? customCategory : null,
        amount_paise: Math.round(numericAmount * 100),
        payment_date: paymentDate,
        narration: narration.trim() || undefined,
        allocations: allocationPayload.length > 0 ? allocationPayload : undefined,
      });

      setSuccessMsg(`${direction === 'payment' ? 'Payment' : 'Receipt'} #${res.voucher_number} saved successfully!`);
      setSelectedVoucherForPrint(res);

      // Reset form
      setAmountRupees('');
      setNarration('');
      setAllocationsMap({});
      if (partyMode === 'category') setCustomCategory('');
      refetchBills();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save transaction');
    }
  };

  const cashInHandRupees = ((balances?.cashInHandPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const bankBalanceRupees = ((balances?.bankBalancePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const totalLiquidRupees = ((balances?.totalLiquidFundsPaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="flex flex-col h-full bg-surface-app text-text-primary p-5 space-y-4 overflow-hidden">
      {/* Financial Liquid Funds Banner Strip */}
      <div className="p-3.5 bg-surface-panel border border-border-subtle rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400">
              <Wallet size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Cash In Hand</span>
              <div className="text-base font-extrabold font-mono text-text-primary">₹{cashInHandRupees}</div>
            </div>
          </div>

          <div className="h-7 w-px bg-border-subtle" />

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-400">
              <Landmark size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Bank Balance</span>
              <div className="text-base font-extrabold font-mono text-text-primary">₹{bankBalanceRupees}</div>
            </div>
          </div>

          <div className="h-7 w-px bg-border-subtle" />

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Total Liquidity</span>
              <div className="text-base font-extrabold font-mono text-brand-400">₹{totalLiquidRupees}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsContraOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-card hover:bg-surface-app border border-border-subtle text-text-primary text-xs font-bold shadow-sm transition-colors"
          >
            <ArrowRightLeft size={13} className="text-cyan-400" /> Contra (Cash ⇄ Bank)
          </button>

          {/* Sub Tab Switcher */}
          <div className="flex p-1 bg-surface-app border border-border-subtle rounded-xl">
            <button
              onClick={() => setActiveTab('outstanding')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'outstanding'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <FileText size={13} />
              <span>Outstanding Bills</span>
            </button>
            <button
              onClick={() => setActiveTab('entry')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'entry'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Plus size={13} />
              <span>General Voucher</span>
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'register'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <History size={13} />
              <span>Payment Register &amp; Reversals</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: OUTSTANDING PURCHASE BILLS (PRIMARY ENTRY POINT)            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'outstanding' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase">Total Outstanding Liabilities</span>
                <div className="text-xl font-black font-mono text-rose-400 mt-0.5">
                  ₹{(totalOutstandingLiabilitiesPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
                <DollarSign size={20} />
              </div>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase">Pending Purchase Bills</span>
                <div className="text-xl font-black font-mono text-text-primary mt-0.5">
                  {outstandingBills.filter(b => b.outstanding_balance_paise > 0).length} bills
                </div>
              </div>
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                <FileText size={20} />
              </div>
            </div>

            <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase">Overdue Bills</span>
                <div className="text-xl font-black font-mono text-rose-400 mt-0.5">
                  {overdueCount} bills
                </div>
              </div>
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Filters Strip */}
          <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={billsSearch}
                  onChange={e => setBillsSearch(e.target.value)}
                  placeholder="Search supplier, bill number, or reference..."
                  className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500"
                />
              </div>

              {suppliers && suppliers.length > 0 && (
                <select
                  value={billsSupplierFilter || ''}
                  onChange={e => setBillsSupplierFilter(e.target.value ? Number(e.target.value) : undefined)}
                  className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name || s.owner_name || `Supplier #${s.id}`}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5">
              <div className="flex p-1 bg-surface-panel border border-border-subtle rounded-xl text-xs font-bold">
                {[
                  { id: 'outstanding', label: 'Outstanding' },
                  { id: 'unpaid', label: 'Unpaid' },
                  { id: 'partial', label: 'Partial' },
                  { id: 'paid', label: 'Paid History' },
                  { id: 'all', label: 'All Bills' },
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setBillsStatusFilter(st.id as any);
                      setSelectedBillIds({});
                    }}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      billsStatusFilter === st.id
                        ? 'bg-surface-card text-brand-400 border border-border-subtle shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                value={`${billsSortBy}-${billsSortOrder}`}
                onChange={e => {
                  const [by, order] = e.target.value.split('-');
                  setBillsSortBy(by as any);
                  setBillsSortOrder(order as any);
                }}
                className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-secondary outline-none focus:border-brand-500"
              >
                <option value="due_date-asc">Oldest Due Date First</option>
                <option value="due_date-desc">Newest Due Date First</option>
                <option value="outstanding-desc">Highest Outstanding</option>
                <option value="total_amount-desc">Highest Bill Amount</option>
                <option value="supplier-asc">Supplier Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Bills Table */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
            {isBillsLoading ? (
              <div className="p-12 text-center text-xs text-text-muted">Loading purchase bills...</div>
            ) : outstandingBills.length === 0 ? (
              <div className="p-12 text-center space-y-2 my-auto">
                <CheckCircle size={32} className="mx-auto text-emerald-400/50" />
                <div className="text-sm font-bold text-text-secondary">No Outstanding Purchase Bills</div>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  {billsStatusFilter === 'outstanding' 
                    ? 'All purchase invoices are completely paid! New purchases will appear here automatically.'
                    : 'No purchase bills matched the selected filter.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-panel border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={outstandingBills.length > 0 && selectedBillsArray.length === outstandingBills.length}
                          onChange={e => {
                            if (e.target.checked) {
                              const allMap: Record<number, boolean> = {};
                              outstandingBills.forEach(b => { allMap[b.id] = true; });
                              setSelectedBillIds(allMap);
                            } else {
                              setSelectedBillIds({});
                            }
                          }}
                          className="rounded border-border-subtle accent-brand-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-3">INVOICE / REF #</th>
                      <th className="py-3 px-3">SUPPLIER</th>
                      <th className="py-3 px-3">BILL DATE / DUE DATE</th>
                      <th className="py-3 px-3 text-right">TOTAL AMOUNT</th>
                      <th className="py-3 px-3 text-right">PAID AMOUNT</th>
                      <th className="py-3 px-3 text-right">OUTSTANDING</th>
                      <th className="py-3 px-3 text-center">STATUS</th>
                      <th className="py-3 pr-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-medium">
                    {outstandingBills.map(bill => {
                      const isSelected = !!selectedBillIds[bill.id];
                      const totalRupees = (bill.total_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                      const paidRupees = (bill.paid_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                      const outRupees = (bill.outstanding_balance_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

                      const isPaid = bill.outstanding_balance_paise <= 0;
                      const isOverdue = bill.outstanding_balance_paise > 0 && bill.days_overdue > 0;

                      return (
                        <tr key={bill.id} className={`hover:bg-surface-hover/50 transition-colors ${isSelected ? 'bg-brand-500/5' : ''}`}>
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectBill(bill)}
                              className="rounded border-border-subtle accent-brand-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono font-bold text-text-primary">
                              {bill.supplier_invoice_number || bill.purchase_ref_number || bill.invoice_number}
                            </div>
                            {bill.purchase_ref_number && bill.supplier_invoice_number && (
                              <div className="text-[10px] text-text-muted font-mono">{bill.purchase_ref_number}</div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-text-primary text-xs">{bill.supplier_company || bill.supplier_name}</div>
                            {bill.supplier_company && (
                              <div className="text-[10px] text-text-muted">{bill.supplier_name}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-text-secondary text-xs">
                            <div>{bill.invoice_date}</div>
                            {bill.due_date && (
                              <div className={`text-[10.5px] font-semibold flex items-center gap-1 ${isOverdue ? 'text-rose-400 font-bold' : 'text-text-muted'}`}>
                                {isOverdue && <Clock size={11} />}
                                <span>Due: {bill.due_date} {isOverdue ? `(${bill.days_overdue}d overdue)` : ''}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-text-primary">
                            ₹{totalRupees}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-400">
                            ₹{paidRupees}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-sm">
                            {isPaid ? (
                              <span className="text-emerald-400">₹0.00</span>
                            ) : (
                              <span className="text-rose-400">₹{outRupees}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isPaid ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Paid
                              </span>
                            ) : bill.paid_amount_paise > 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Partially Paid
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Unpaid
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!isPaid && (
                                <button
                                  onClick={() => handleOpenPaymentForSingleBill(bill)}
                                  className="px-2.5 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                >
                                  <DollarSign size={11} />
                                  <span>Pay Bill</span>
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedBillForHistory(bill)}
                                className="px-2 py-1 bg-surface-panel hover:bg-surface-hover text-text-secondary border border-border-subtle rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                title="View payment allocation history"
                              >
                                <History size={11} />
                                <span>History</span>
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

            {/* Multi-Select Floating Footer */}
            {selectedBillsArray.length > 0 && (
              <div className="p-3 bg-surface-panel border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-primary">
                    <strong>{selectedBillsArray.length}</strong> bill{selectedBillsArray.length !== 1 ? 's' : ''} selected
                  </span>
                  {isMultiSupplierSelected ? (
                    <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                      <AlertCircle size={13} /> Selected bills belong to different suppliers. Please select bills from one supplier to pay together.
                    </span>
                  ) : (
                    <span className="text-xs text-text-muted">
                      Supplier: <strong className="text-text-primary">{selectedBillsArray[0].supplier_company || selectedBillsArray[0].supplier_name}</strong>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedBillIds({})}
                    className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold transition-colors"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={handleOpenPaymentForSelectedBills}
                    disabled={isMultiSupplierSelected || selectedBillsArray.length === 0}
                    className="px-5 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/25 flex items-center gap-1.5"
                  >
                    <DollarSign size={13} />
                    <span>Pay Selected Bills (Double-Verified)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: GENERAL VOUCHER ENTRY                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'entry' && (
        <div className="flex-1 min-h-0 flex gap-5 overflow-hidden">
          <div className="w-full max-w-xl bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-elevation overflow-y-auto space-y-4">
            <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
              <DollarSign className="text-brand-400" size={16} />
              <span>Direct Voucher Entry (Payment / Receipt)</span>
            </h3>

            <div className="flex bg-surface-app p-1 rounded-xl border border-border-subtle">
              <button
                type="button"
                onClick={() => setDirection('payment')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  direction === 'payment' ? 'bg-rose-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <ArrowUpRight size={15} /> Payment (Money Out)
              </button>
              <button
                type="button"
                onClick={() => setDirection('receipt')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  direction === 'receipt' ? 'bg-emerald-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <ArrowDownLeft size={15} /> Receipt (Money In)
              </button>
            </div>

            <form onSubmit={handleSubmitVoucher} className="space-y-4">
              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Mode *</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'bank', 'upi', 'card'] as const).map(m => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`py-2 rounded-xl border text-xs font-bold uppercase transition-all ${
                        method === m ? 'bg-brand-500/10 border-brand-500 text-brand-400' : 'bg-surface-app border-border-subtle text-text-muted'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Amount (₹) *</label>
                  <input
                    ref={amountInputRef}
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amountRupees}
                    onChange={e => setAmountRupees(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-sm font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    required
                    className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Party / Category Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-text-secondary uppercase">
                    {partyMode === 'party' ? (direction === 'payment' ? 'Supplier *' : 'Customer *') : 'Category *'}
                  </label>
                  <div className="flex gap-2 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPartyMode('party')}
                      className={partyMode === 'party' ? 'text-brand-400 underline' : 'text-text-muted'}
                    >
                      Party Account
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setPartyMode('category')}
                      className={partyMode === 'category' ? 'text-brand-400 underline' : 'text-text-muted'}
                    >
                      General Category
                    </button>
                  </div>
                </div>

                {partyMode === 'party' ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={partySearch}
                      onChange={e => {
                        setPartySearch(e.target.value);
                        setIsPartyDropdownOpen(true);
                      }}
                      onFocus={() => setIsPartyDropdownOpen(true)}
                      placeholder={`Search ${direction === 'payment' ? 'supplier' : 'customer'}...`}
                      className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                    />
                    {isPartyDropdownOpen && matchingParties.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface-card border border-border-subtle rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                        {matchingParties.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectParty(p)}
                            className="p-2.5 hover:bg-surface-hover cursor-pointer border-b border-border-subtle/50 text-xs flex justify-between items-center"
                          >
                            <span className="font-bold text-text-primary">{p.name}</span>
                            <span className="font-mono text-rose-400">Bal: ₹{(p.balancePaise / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <select
                    value={customCategory}
                    onChange={e => setCustomCategory(e.target.value)}
                    className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="">Select Category</option>
                    {(direction === 'payment' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Narration */}
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Narration / Notes</label>
                <input
                  type="text"
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="Optional reference notes..."
                  className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle size={15} />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={recordPaymentMutation.isPending}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-2"
              >
                <span>{recordPaymentMutation.isPending ? 'Posting...' : 'Save & Print Voucher'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PAYMENT REGISTER & REVERSALS                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'register' && (
        <div className="flex-1 min-h-0 flex flex-col space-y-3 overflow-hidden">
          {/* Register Filter Strip */}
          <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={registerSearch}
                  onChange={e => setRegisterSearch(e.target.value)}
                  placeholder="Search voucher number, party or narration..."
                  className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <select
                value={registerDirection}
                onChange={e => setRegisterDirection(e.target.value)}
                className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              >
                <option value="all">All Directions</option>
                <option value="payment">Payments Only (Out)</option>
                <option value="receipt">Receipts Only (In)</option>
              </select>

              <select
                value={registerMethod}
                onChange={e => setRegisterMethod(e.target.value)}
                className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
              >
                <option value="all">All Modes</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs bg-surface-panel border border-border-subtle rounded-xl px-3 py-1">
                <Calendar size={13} className="text-text-muted" />
                <input
                  type="date"
                  value={registerStartDate}
                  onChange={e => setRegisterStartDate(e.target.value)}
                  className="bg-transparent text-text-primary font-mono outline-none"
                />
                <span className="text-text-muted">to</span>
                <input
                  type="date"
                  value={registerEndDate}
                  onChange={e => setRegisterEndDate(e.target.value)}
                  className="bg-transparent text-text-primary font-mono outline-none"
                />
              </div>
            </div>
          </div>

          {/* Register Table */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
            {isRegisterLoading ? (
              <div className="p-12 text-center text-xs text-text-muted">Loading payment register...</div>
            ) : !registerData || registerData.vouchers.length === 0 ? (
              <div className="p-12 text-center space-y-2 my-auto">
                <History size={32} className="mx-auto text-text-muted/40" />
                <div className="text-sm font-bold text-text-secondary">No Vouchers Found</div>
                <p className="text-xs text-text-muted">No payment or receipt vouchers matched the selected period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-panel border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-3 px-3">VOUCHER #</th>
                      <th className="py-3 px-3">DATE</th>
                      <th className="py-3 px-3">TYPE</th>
                      <th className="py-3 px-3">PARTY / CATEGORY</th>
                      <th className="py-3 px-3">MODE</th>
                      <th className="py-3 px-3 text-right">AMOUNT</th>
                      <th className="py-3 px-3 text-center">STATUS</th>
                      <th className="py-3 pr-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50 font-medium">
                    {registerData.vouchers.map(v => {
                      const isReversed = v.is_reversed === 1;
                      const isReversalEntry = !!v.reversed_payment_id;
                      const amountRupees = (v.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

                      return (
                        <tr key={v.id} className={`hover:bg-surface-hover/50 transition-colors ${isReversed ? 'opacity-60 bg-surface-card/40' : ''}`}>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-brand-400">#{v.voucher_number}</span>
                            {v.narration && (
                              <div className="text-[10px] text-text-muted truncate max-w-[160px]">{v.narration}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-text-secondary text-xs">{v.payment_date}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.direction === 'payment' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {v.direction === 'payment' ? 'Payment' : 'Receipt'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-text-primary text-xs">{v.party_name || v.category || 'General'}</div>
                            {v.party_type && (
                              <div className="text-[10px] text-text-muted capitalize">{v.party_type}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 uppercase text-[10px] font-bold text-text-muted">{v.payment_method}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-sm text-text-primary">
                            {isReversalEntry ? <span className="text-rose-400">-₹{amountRupees}</span> : `₹${amountRupees}`}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isReversed ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Reversed
                              </span>
                            ) : isReversalEntry ? (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Reversal Entry
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit mx-auto">
                                <CheckCircle size={10} /> Active
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setSelectedVoucherForPrint(v)}
                                className="p-1.5 hover:bg-surface-panel text-text-secondary hover:text-text-primary rounded-lg transition-colors border border-border-subtle"
                                title="Print Voucher"
                              >
                                <Printer size={13} />
                              </button>
                              {!isReversed && !isReversalEntry && (
                                <button
                                  onClick={() => setSelectedVoucherForReversal(v)}
                                  className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-rose-500/20"
                                  title="Reverse this voucher"
                                >
                                  <RotateCcw size={11} />
                                  <span>Reverse</span>
                                </button>
                              )}
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
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODALS                                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isBillPaymentModalOpen && (
        <BillPaymentModal
          supplierId={paymentModalSupplierId}
          supplierName={paymentModalSupplierName}
          selectedBills={paymentModalSelectedBills}
          isOpen={isBillPaymentModalOpen}
          onClose={() => {
            setIsBillPaymentModalOpen(false);
            refetchBills();
          }}
          onPaymentComplete={(voucher) => {
            setSelectedBillIds({});
            refetchBills();
            setSelectedVoucherForPrint(voucher);
          }}
        />
      )}

      {selectedBillForHistory && (
        <BillHistoryModal
          bill={selectedBillForHistory}
          onClose={() => setSelectedBillForHistory(null)}
          onPaymentReversed={() => {
            refetchBills();
            refetchRegister();
          }}
        />
      )}

      {selectedVoucherForReversal && (
        <PaymentReversalModal
          voucher={selectedVoucherForReversal}
          onClose={() => setSelectedVoucherForReversal(null)}
          onSuccess={() => {
            refetchBills();
            refetchRegister();
          }}
        />
      )}

      {selectedVoucherForPrint && (
        <VoucherPrintModal
          isOpen={!!selectedVoucherForPrint}
          onClose={() => setSelectedVoucherForPrint(null)}
          voucher={selectedVoucherForPrint}
        />
      )}

      {isContraOpen && (
        <ContraTransferModal
          isOpen={isContraOpen}
          onClose={() => setIsContraOpen(false)}
        />
      )}
    </div>
  );
}
