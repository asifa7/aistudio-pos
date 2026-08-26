import React, { useState, useEffect } from 'react';
import { 
  X, 
  Undo2, 
  CheckCircle2, 
  Search, 
  RotateCcw, 
  Trash2, 
  ArrowLeft, 
  AlertCircle, 
  PackageCheck, 
  Calendar, 
  FileText,
  DollarSign
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import ProductQuickSearch from './ProductQuickSearch';
import type { ProductVariant } from '../types/billing.types';

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialInvoiceId?: number | null;
}

type ReturnMode = 'direct' | 'search';

interface DirectReturnItem {
  id: string;
  product_variant_id: number;
  product_name: string;
  is_weight: boolean;
  qty: string;
  rate: string;
}

export default function SalesReturnModal({ isOpen, onClose, initialInvoiceId }: SalesReturnModalProps) {
  const queryClient = useQueryClient();

  // Mode: Default to 'direct' unless an initialInvoiceId is passed
  const [mode, setMode] = useState<ReturnMode>(initialInvoiceId ? 'search' : 'direct');
  
  // Shared States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Core Question 1: What happened to the stock? (Static & permanently visible)
  const [stockResolution, setStockResolution] = useState<'discarded' | 'restored'>('discarded');
  
  // Core Question 2: Refund given? (Static & permanently visible)
  const [refundGiven, setRefundGiven] = useState(true);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_balance' | 'credit_note'>('cash');
  const [reason, setReason] = useState('');

  // Mode A: Direct Entry States
  const todayStr = new Date().toISOString().split('T')[0];
  const [directDate, setDirectDate] = useState(todayStr);
  const [directRef, setDirectRef] = useState('');
  const [directItems, setDirectItems] = useState<DirectReturnItem[]>([]);
  
  const [returnSelectedVariant, setReturnSelectedVariant] = useState<ProductVariant | null>(null);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');

  // Mode B: Search Past Bill States
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(initialInvoiceId || null);
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [billNumber, setBillNumber] = useState('');
  const [bills, setBills] = useState<any[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [searchReturnQty, setSearchReturnQty] = useState<Record<number, string>>({});

  // Reset modal on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
      setReason('');
      setStockResolution('discarded');
      setRefundGiven(true);
      setRefundMethod('cash');
      
      setDirectItems([]);
      setDirectDate(todayStr);
      setDirectRef('');
      
      if (initialInvoiceId) {
        setMode('search');
        setSelectedInvoiceId(initialInvoiceId);
      } else {
        setMode('direct');
        setSelectedInvoiceId(null);
      }
    }
  }, [isOpen, initialInvoiceId, todayStr]);

  // Query invoice details for Mode B
  const { data: invoiceDetail } = useQuery({
    queryKey: ['invoice-details-for-return', selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return null;
      const res = await window.api.invoke(IPC_CHANNELS.BILLING.GET_INVOICE, { invoice_id: selectedInvoiceId });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: !!selectedInvoiceId && isOpen && mode === 'search',
  });

  useEffect(() => {
    if (invoiceDetail && invoiceDetail.items) {
      const initMap: Record<number, string> = {};
      invoiceDetail.items.forEach((item: any) => {
        initMap[item.id] = '0';
      });
      setSearchReturnQty(initMap);
    }
  }, [invoiceDetail]);

  const fetchBills = async () => {
    setIsLoadingBills(true);
    try {
      const filter: any = { startDate, endDate, paymentStatus: 'all' };
      if (billNumber.trim()) filter.billNumber = billNumber.trim();

      const res = await window.api.invoke(IPC_CHANNELS.BILLING.SEARCH_INVOICES, filter);
      if (res.success) {
        setBills(res.data || []);
      }
    } catch (err: any) {
      console.warn('Failed to search bills:', err);
    } finally {
      setIsLoadingBills(false);
    }
  };

  useEffect(() => {
    if (!isOpen || selectedInvoiceId || mode !== 'search') return;
    const timer = setTimeout(() => fetchBills(), 200);
    return () => clearTimeout(timer);
  }, [startDate, endDate, billNumber, selectedInvoiceId, isOpen, mode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills();
  };

  // ----- Mode A Logic (Direct Return using ProductQuickSearch) -----
  const handleAddReturnProduct = async (
    variant: ProductVariant,
    quantityGrams: number | null,
    quantityUnits: number | null
  ) => {
    const isWeight = variant.unit_type === 'weight' || variant.unit_type === 'live_dual';
    const rateRupees = ((variant.current_rate_paise_per_unit || 0) / 100).toFixed(2);
    const fullName = `${variant.product_name} ${variant.variant_name && variant.variant_name !== 'Default' ? variant.variant_name : ''}`.trim();
    
    let qtyString = '1.000';
    if (isWeight && quantityGrams !== null) {
      qtyString = (quantityGrams / 1000).toFixed(3);
    } else if (!isWeight && quantityUnits !== null) {
      qtyString = String(quantityUnits);
    } else if (!isWeight) {
      qtyString = '1';
    }

    setDirectItems(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(7),
        product_variant_id: variant.id,
        product_name: fullName,
        is_weight: isWeight,
        qty: qtyString,
        rate: rateRupees,
      }
    ]);
  };

  const updateDirectItem = (id: string, field: 'qty' | 'rate', val: string) => {
    setDirectItems(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const removeDirectItem = (id: string) => {
    setDirectItems(prev => prev.filter(item => item.id !== id));
  };

  // ----- Calculate Totals and Build Payload with 100% Precision -----
  let totalRefundPaise = 0;
  const returnPayloadItems: any[] = [];

  if (mode === 'direct') {
    directItems.forEach(item => {
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      if (q > 0 && r > 0) {
        const lineRefundPaise = Math.round(q * r * 100);
        totalRefundPaise += lineRefundPaise;
        returnPayloadItems.push({
          product_variant_id: item.product_variant_id,
          quantity_grams: item.is_weight ? Math.round(q * 1000) : null,
          quantity_units: !item.is_weight ? Math.round(q) : null,
          unit_rate_paise: Math.round(r * 100),
          refund_total_paise: lineRefundPaise,
        });
      }
    });
  } else if (mode === 'search' && invoiceDetail?.items) {
    invoiceDetail.items.forEach((item: any) => {
      const isWeight = item.unit_type === 'weight' || item.quantity_grams !== null;
      const enteredQty = parseFloat(searchReturnQty[item.id] || '0');
      
      if (!isNaN(enteredQty) && enteredQty > 0) {
        const totalQty = isWeight ? (item.quantity_grams / 1000) : (item.quantity_units || 1);
        const ratePaisePerUnit = Math.round(item.line_subtotal_paise / totalQty);
        
        const lineRefundPaise = Math.round(enteredQty * ratePaisePerUnit);
        totalRefundPaise += lineRefundPaise;
        returnPayloadItems.push({
          invoice_item_id: item.id,
          product_variant_id: item.product_variant_id,
          quantity_grams: isWeight ? Math.round(enteredQty * 1000) : null,
          quantity_units: !isWeight ? Math.round(enteredQty) : null,
          unit_rate_paise: ratePaisePerUnit,
          refund_total_paise: lineRefundPaise,
        });
      }
    });
  }

  const handleSubmitReturn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (returnPayloadItems.length === 0) {
      setErrorMsg('Please enter valid quantities and rates for at least one item.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Reason for return is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        reason: reason.trim(),
        stock_resolution: stockResolution,
        refund_given: refundGiven,
        refund_method: refundGiven ? refundMethod : 'none',
        items: returnPayloadItems
      };

      if (mode === 'direct') {
        payload.date = directDate;
        if (directRef.trim()) payload.reference = directRef.trim();
      } else {
        payload.invoice_id = selectedInvoiceId;
      }

      const res = await window.api.invoke(IPC_CHANNELS.BILLING.RETURN_INVOICE, payload);
      if (!res.success) throw new Error(res.error.message);

      setSuccessMsg('Sales return processed successfully!');
      queryClient.invalidateQueries({ queryKey: ['stock-status'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cashbox-current-session'] });
      queryClient.invalidateQueries({ queryKey: ['passbook-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });

      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process customer return');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div id="sales-return-modal-overlay" className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
      {/* Spacious, large-format modal card */}
      <div 
        id="sales-return-modal-card" 
        className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-5xl h-[820px] max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Top Header Bar */}
        <div id="sales-return-header" className="h-16 px-6 border-b border-border-subtle shrink-0 bg-surface-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <RotateCcw size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-text-primary tracking-tight">
                {mode === 'direct' ? 'Customer Sales Return' : 'Return from Specific Bill'}
              </h2>
              <p className="text-xs text-text-muted">
                {mode === 'direct' 
                  ? 'Direct entry — deduct from sales, refund customer, and resolve inventory' 
                  : 'Search past invoices to process an item return'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {mode === 'direct' ? (
              <button 
                id="btn-switch-to-search-mode"
                type="button"
                onClick={() => setMode('search')}
                className="text-xs font-bold text-brand-500 hover:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Search size={13} /> Return from specific bill &rarr;
              </button>
            ) : (
              <button 
                id="btn-switch-to-direct-mode"
                type="button"
                onClick={() => {
                  setMode('direct');
                  setSelectedInvoiceId(null);
                }}
                className="text-xs font-bold text-brand-500 hover:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={13} /> Back to Direct Entry
              </button>
            )}
            <button 
              id="btn-close-sales-return-modal"
              onClick={onClose} 
              className="p-2 rounded-xl hover:bg-surface-app text-text-muted hover:text-text-primary transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Static Header Strip (Return Date & Original Bill Space — ALWAYS static and never hidden) */}
        <div className="px-6 py-3 bg-surface-card/60 border-b border-border-subtle shrink-0">
          {mode === 'direct' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar size={12} className="text-brand-500" /> Return Date
                </label>
                <input
                  id="input-direct-return-date"
                  type="date"
                  value={directDate}
                  onChange={e => setDirectDate(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText size={12} className="text-brand-500" /> Original Bill # (Optional Space)
                </label>
                <input
                  id="input-direct-return-ref"
                  type="text"
                  value={directRef}
                  onChange={e => setDirectRef(e.target.value)}
                  placeholder="e.g. Bill #1042 / Cash memo"
                  className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-mono font-bold"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">Search Filters:</span>
                <span className="font-mono text-text-secondary bg-surface-app px-2 py-1 rounded-lg border border-border-subtle">
                  From: {startDate} to {endDate}
                </span>
                {billNumber && (
                  <span className="font-mono text-brand-400 bg-brand-500/10 px-2 py-1 rounded-lg border border-brand-500/20 font-bold">
                    Bill #{billNumber}
                  </span>
                )}
              </div>
              {selectedInvoiceId && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-primary">Selected Bill: #{invoiceDetail?.invoice?.invoice_number || selectedInvoiceId}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceId(null)}
                    className="text-[11px] text-brand-400 hover:underline font-semibold"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Main Body: 2-Column Split (Left = Product List / Search, Right = Static Resolution & Master Settings) */}
        <div id="sales-return-body" className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden p-6 gap-6">
          
          {/* LEFT COLUMN: Items Entry & List (Scrollable internally, never pushing outside headers) */}
          <div className="lg:col-span-7 flex flex-col min-h-0 gap-3">
            
            {mode === 'direct' && (
              <>
                {/* Product Quick Search Bar */}
                <div className="border border-border-subtle rounded-2xl overflow-hidden shadow-sm shrink-0">
                  <ProductQuickSearch
                    onAddProduct={handleAddReturnProduct}
                    selectedVariant={returnSelectedVariant}
                    onSelectVariant={setReturnSelectedVariant}
                    searchTerm={returnSearchTerm}
                    onSearchTermChange={setReturnSearchTerm}
                  />
                </div>

                {/* Items Table Container (Scrolls internally regardless of item count) */}
                <div className="flex-1 min-h-0 border border-border-subtle rounded-2xl bg-surface-card overflow-hidden flex flex-col shadow-sm">
                  <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-app/60 flex justify-between items-center shrink-0">
                    <span className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider">
                      Return Items ({directItems.length})
                    </span>
                    {directItems.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setDirectItems([])}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {directItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
                      <RotateCcw size={32} className="opacity-25 mb-2" />
                      <p className="text-sm font-bold text-text-secondary">No items added to return yet</p>
                      <p className="text-xs text-text-muted mt-0.5">Use the quick search box above to add products.</p>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-surface-panel z-10">
                          <tr className="border-b border-border-subtle text-text-muted font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-4">Item</th>
                            <th className="py-2.5 px-3 text-right">Return Qty</th>
                            <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                            <th className="py-2.5 px-4 text-right">Refund (₹)</th>
                            <th className="py-2.5 px-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                          {directItems.map(item => {
                            const q = parseFloat(item.qty) || 0;
                            const r = parseFloat(item.rate) || 0;
                            return (
                              <tr key={item.id} className="hover:bg-surface-hover/40 transition-colors">
                                <td className="py-2.5 px-4 font-bold text-text-primary">
                                  {item.product_name}
                                  <span className="ml-1.5 text-[9px] text-text-muted font-mono px-1.5 py-0.5 bg-surface-app rounded-md border border-border-subtle">
                                    {item.is_weight ? 'kg' : 'pcs'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step={item.is_weight ? '0.001' : '1'}
                                    min="0"
                                    value={item.qty}
                                    onChange={e => updateDirectItem(item.id, 'qty', e.target.value)}
                                    className="w-24 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1 text-right font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                                  />
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.rate}
                                    onChange={e => updateDirectItem(item.id, 'rate', e.target.value)}
                                    className="w-24 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1 text-right font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                                  />
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-extrabold text-amber-400 text-sm">
                                  ₹{(q * r).toFixed(2)}
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <button 
                                    type="button" 
                                    onClick={() => removeDirectItem(item.id)} 
                                    className="text-rose-500/70 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'search' && !selectedInvoiceId && (
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <form onSubmit={handleSearchSubmit} className="p-3.5 bg-surface-card border border-border-subtle rounded-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-text-muted mb-1">From Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2.5 py-1.5 bg-surface-app border border-border-subtle rounded-xl font-mono outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-text-muted mb-1">To Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2.5 py-1.5 bg-surface-app border border-border-subtle rounded-xl font-mono outline-none focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-extrabold text-text-muted mb-1">Bill Number</label>
                    <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="e.g. 101" className="w-full px-2.5 py-1.5 bg-surface-app border border-border-subtle rounded-xl font-mono font-bold outline-none focus:border-brand-500" />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2 px-3 text-xs font-bold flex-1">Search</button>
                    <button type="button" onClick={() => { setStartDate(todayStr); setEndDate(todayStr); setBillNumber(''); }} className="bg-surface-app hover:bg-surface-hover border border-border-subtle rounded-xl py-2 px-3 text-xs font-semibold">Reset</button>
                  </div>
                </form>

                <div className="flex-1 min-h-0 border border-border-subtle rounded-2xl bg-surface-card overflow-y-auto">
                  {isLoadingBills ? (
                    <div className="py-12 text-center text-xs text-text-muted">Searching bills...</div>
                  ) : bills.length === 0 ? (
                    <div className="py-12 text-center text-xs text-text-muted">No completed bills found matching filter criteria.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle font-bold text-text-muted text-[10px] uppercase z-10">
                        <tr>
                          <th className="p-3">Bill Number</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-right">Total</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/50">
                        {bills.map(b => (
                          <tr key={b.id} className="hover:bg-surface-hover/50">
                            <td className="p-3 font-mono font-bold text-brand-500">#{b.invoice_number || b.id}</td>
                            <td className="p-3 font-mono">{new Date(b.created_at).toLocaleDateString()}</td>
                            <td className="p-3 text-right font-mono font-bold">₹{(b.total_paise / 100).toFixed(2)}</td>
                            <td className="p-3 text-right">
                              <button 
                                type="button" 
                                onClick={() => setSelectedInvoiceId(b.id)} 
                                className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {mode === 'search' && selectedInvoiceId && invoiceDetail && (
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="p-3 bg-surface-card border border-border-subtle rounded-2xl flex justify-between items-center text-xs shrink-0">
                  <div>
                    <div className="font-bold text-text-primary">Bill #: <span className="font-mono text-brand-500">{invoiceDetail.invoice?.invoice_number || `#${selectedInvoiceId}`}</span></div>
                    <div className="text-[11px] text-text-muted mt-0.5">{new Date(invoiceDetail.invoice?.created_at).toLocaleString()}</div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedInvoiceId(null)} 
                    className="px-3 py-1.5 border border-border-subtle rounded-xl hover:bg-surface-hover text-xs font-semibold"
                  >
                    Change Bill
                  </button>
                </div>

                <div className="flex-1 min-h-0 bg-surface-card p-4 rounded-2xl border border-border-subtle flex flex-col">
                  <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider block mb-2 shrink-0">
                    Select Quantities to Return
                  </label>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-surface-panel z-10">
                        <tr className="border-b border-border-subtle text-text-muted font-bold text-[10px] uppercase">
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3 text-right">Sold Qty</th>
                          <th className="py-2 px-3 text-right">Return Qty</th>
                          <th className="py-2 px-3 text-right">Refund (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/50">
                        {invoiceDetail.items.map((it: any) => {
                          const isWeight = it.unit_type === 'weight' || it.quantity_grams !== null;
                          const maxQ = isWeight ? (it.quantity_grams / 1000) : (it.quantity_units || 1);
                          const enteredQ = parseFloat(searchReturnQty[it.id] || '0') || 0;
                          const ratePaise = Math.round(it.line_subtotal_paise / maxQ);
                          const lineRefundRupees = ((enteredQ * ratePaise) / 100).toFixed(2);

                          return (
                            <tr key={it.id} className="hover:bg-surface-hover/30">
                              <td className="py-2.5 px-3 font-bold">
                                {it.product_name_snapshot || it.product_name || 'Item'}
                                <span className="ml-1.5 text-[9px] text-text-muted">({isWeight ? 'kg' : 'pcs'})</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-text-muted">{maxQ}</td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  step={isWeight ? '0.001' : '1'}
                                  min="0" 
                                  max={maxQ}
                                  value={searchReturnQty[it.id] || '0'}
                                  onChange={e => setSearchReturnQty(p => ({ ...p, [it.id]: e.target.value }))}
                                  className="w-24 bg-surface-app border border-border-subtle rounded-lg px-2.5 py-1 text-right font-mono font-bold outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                                ₹{lineRefundRupees}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: Static Stock Resolution & Master Settings (Permanently visible at all times) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Stock Resolution Card (Always visible, never hidden) */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-4.5 space-y-3 shadow-sm">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <PackageCheck size={14} className="text-brand-500" /> Stock Resolution: What happened to items?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStockResolution('discarded')}
                  className={`p-3 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                    stockResolution === 'discarded'
                      ? 'border-rose-500/70 bg-rose-500/15 text-text-primary shadow-sm ring-1 ring-rose-500/40'
                      : 'border-border-subtle bg-surface-app hover:bg-surface-hover text-text-muted'
                  }`}
                >
                  <span className="text-xs font-black flex items-center gap-2 text-rose-400">
                    🗑️ Discarded / Spoilage
                  </span>
                  <span className="text-[11px] opacity-80 mt-1">Damaged, raw cut spoiled — do NOT add back to inventory.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStockResolution('restored')}
                  className={`p-3 rounded-xl border text-left flex flex-col transition-all cursor-pointer ${
                    stockResolution === 'restored'
                      ? 'border-emerald-500/70 bg-emerald-500/15 text-text-primary shadow-sm ring-1 ring-emerald-500/40'
                      : 'border-border-subtle bg-surface-app hover:bg-surface-hover text-text-muted'
                  }`}
                >
                  <span className="text-xs font-black flex items-center gap-2 text-emerald-400">
                    📦 Add Back to Stock
                  </span>
                  <span className="text-[11px] opacity-80 mt-1">Good resellable condition — restore inventory stock counts.</span>
                </button>
              </div>
            </div>

            {/* Refund Payout & Reason Settings (Always visible, never hidden) */}
            <div className="bg-surface-card border border-border-subtle rounded-2xl p-4.5 space-y-4 shadow-sm flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-brand-500" /> Refund Payout Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={refundGiven ? 'yes' : 'no'}
                      onChange={e => setRefundGiven(e.target.value === 'yes')}
                      className="bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-brand-500"
                    >
                      <option value="yes">Yes, refund</option>
                      <option value="no">No refund</option>
                    </select>

                    {refundGiven && (
                      <select
                        value={refundMethod}
                        onChange={e => setRefundMethod(e.target.value as any)}
                        className="bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-brand-500"
                      >
                        <option value="cash">💵 Cash Outflow</option>
                        <option value="credit_balance">👤 Store Credit (CRM)</option>
                        <option value="credit_note">🎟️ Credit Note</option>
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-text-muted mb-1.5">
                    Reason for Return *
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. Quality issue, customer requested return"
                    className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Status Messages */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer Bar (Static at bottom) */}
        <div id="sales-return-footer" className="h-18 px-6 border-t border-border-subtle bg-surface-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Total Refund Amount:</span>
            <span className="font-mono text-2xl font-black text-amber-400">
              ₹{(totalRefundPaise / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-surface-app transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-submit-sales-return"
              onClick={handleSubmitReturn}
              disabled={
                isSubmitting || 
                totalRefundPaise <= 0 || 
                (mode === 'search' && !selectedInvoiceId)
              }
              className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-black transition-all shadow-md flex items-center gap-2"
            >
              <Undo2 size={16} />
              {isSubmitting ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
