import React, { useState, useRef } from 'react';
import { Trash2, Save, Building2, DollarSign, Clock, CheckCircle2, AlertCircle, Paperclip } from 'lucide-react';
import {
  useSuppliersProfile,
  useRecordQuickPurchase,
  useSupplierSnapshot,
  usePassbookLedger,
  useEditPurchaseRecord,
} from '../../hooks/useSupplierProcurement';
import { useActiveRates } from '../../../../billing/frontend/hooks/useActiveRates';
import { formatPaise, formatDate, PassbookLedgerEntry } from '../../types/supplier.types';
import { QuickPurchaseSchema } from '../../validation/supplier_procurement.schema';
import InvoiceTemplateModal, { InvoiceTemplateData } from './InvoiceTemplateModal';
import { useQuickPurchaseStore } from '../../hooks/useQuickPurchaseStore';
import { IPC_CHANNELS } from '../../../../../core/ipc/channels';



import SearchableSupplierCombobox from '../suppliers/SearchableSupplierCombobox';
import SpreadsheetProductSelector from './SpreadsheetProductSelector';
import SupplierForm from '../suppliers/SupplierForm';

export default function QuickPurchaseEntry() {

  const { data: suppliers, refetch: refetchSuppliers } = useSuppliersProfile();
  const { data: variants } = useActiveRates();
  const recordQuickPurchase = useRecordQuickPurchase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State and persisted Draft session (Zustand)
  const { draft, setDraftField, setItems, resetDraft } = useQuickPurchaseStore();
  const { supplierId, receivedDate, billNumber, notes, billPhotoPath, paymentMethod, editingInvoiceId, items } = draft;

  const setSupplierId = (val: string) => setDraftField('supplierId', val);
  const setReceivedDate = (val: string) => setDraftField('receivedDate', val);
  const setNotes = (val: string) => setDraftField('notes', val);
  const setBillPhotoPath = (val: string | null) => setDraftField('billPhotoPath', val);
  const setPaymentMethod = (val: 'cash' | 'credit') => setDraftField('paymentMethod', val);

  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [showNotesInput, setShowNotesInput] = useState(false);
  
  // Note toggle sync
  React.useEffect(() => {
    if (notes) {
      setShowNotesInput(true);
    }
  }, [notes]);

  // Password confirmation for edits
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [editReason, setEditReason] = useState('');

  const editPurchaseRecord = useEditPurchaseRecord();

  // Auto-initialize items with at least one blank row on mount
  React.useEffect(() => {
    if (items.length === 0) {
      setItems([
        {
          product_variant_id: '',
          quantity: '',
          unit_type: 'weight',
          unit_price: '',
          subtotal: 0
        }
      ]);
    }
  }, []);

  const [errorMsg, setErrorMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [invoiceModalData, setInvoiceModalData] = useState<InvoiceTemplateData | null>(null);
  const todayCleanDate = (receivedDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9]/g, '').slice(0, 8);
  const [nextRefNum, setNextRefNum] = useState<string>(`PUR-${todayCleanDate}-001`);

  React.useEffect(() => {
    let active = true;
    const fetchRef = async () => {
      try {
        const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_NEXT_PURCHASE_REF, { receivedDate });
        if (res.success && active) {
          setNextRefNum(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch next purchase ref:', err);
      }
    };
    
    if (editingInvoiceId !== null) {
      setNextRefNum(`PUR-[ID: ${editingInvoiceId}]`);
    } else {
      fetchRef();
    }
    
    return () => { active = false; };
  }, [receivedDate, editingInvoiceId]);

  // Sidebar queries
  const selectedSupplierIdNum = supplierId ? Number(supplierId) : undefined;
  const { data: supplierSnapshot } = useSupplierSnapshot(selectedSupplierIdNum);
  const { data: ledgerData } = usePassbookLedger({
    supplierId: selectedSupplierIdNum,
  });

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      alert('Only JPG, PNG, and PDF files are allowed.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setBillPhotoPath((file as any).path);
  };

  const handleRemoveCommittedItem = (index: number) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const calculatedItemsTotal = items.reduce((acc, cur) => acc + cur.subtotal, 0);
  const totalQty = items.reduce((acc, cur) => acc + (parseFloat(cur.quantity) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setValidationErrors({});

    if (!supplierId) {
      setErrorMsg('Please select a supplier');
      return;
    }

    const itemsMapped = items
      .filter(item => item.product_variant_id && item.quantity)
      .map(item => ({
        product_variant_id: parseInt(item.product_variant_id),
        quantity: parseFloat(item.quantity) || 0,
        unit_type: item.unit_type,
        unit_price_paise: Math.round((parseFloat(item.unit_price) || 0) * 100),
        subtotal_paise: item.subtotal,
      }));

    if (itemsMapped.length === 0) {
      setErrorMsg('Please add at least one valid item');
      return;
    }

    const payload = {
      supplier_id: parseInt(supplierId),
      received_date: receivedDate,
      bill_amount_paise: calculatedItemsTotal,
      bill_number: billNumber || undefined,
      notes: notes || undefined,
      bill_photo_path: billPhotoPath || undefined,
      payment_method: paymentMethod,
      items: itemsMapped,
    };

    const parsed = QuickPurchaseSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setValidationErrors(errors);
      setErrorMsg('Please correct validation errors below');
      return;
    }

    if (editingInvoiceId !== null) {
      // In Edit Mode, trigger password override modal before mutate
      setShowPasswordPrompt(true);
      return;
    }

    try {
      const result = await recordQuickPurchase.mutateAsync(payload);

      setSuccessMsg('Quick Purchase entry saved successfully! Stock and Supplier Ledger updated.');

      // Auto-open printable invoice
      const supp = suppliers?.find(s => String(s.id) === supplierId);
      setInvoiceModalData({
        invoiceNumber: result?.invoice?.supplier_invoice_number || billNumber || `BILL-${Date.now()}`,
        invoiceDate: receivedDate,
        poNumber: result?.invoice?.purchase_ref_number || `PUR-${result?.invoice?.id}`,
        fromName: supp?.company_name || 'Supplier',
        billToName: 'Meat Shop Store',
        items: itemsMapped.map(i => {
          const v = variants?.find((x: any) => x.id === i.product_variant_id);
          return {
            qty: i.quantity,
            description: v ? `${v.product_name} (${v.variant_name})` : `Item #${i.product_variant_id}`,
            unitPricePaise: i.unit_price_paise,
            amountPaise: i.subtotal_paise,
          };
        }),
        subtotalPaise: payload.bill_amount_paise,
        totalPaise: payload.bill_amount_paise,
      });

      // Reset form
      resetDraft();
      if (fileInputRef.current) fileInputRef.current.value = '';
      setItems([
        {
          product_variant_id: '',
          quantity: '',
          unit_type: 'weight',
          unit_price: '',
          subtotal: 0
        }
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record purchase entry');
    }
  };

  const handleSaveEditConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!passwordInput.trim()) {
      alert('Please enter your password.');
      return;
    }
    if (!editReason.trim()) {
      alert('Please enter a mandatory reason for this correction.');
      return;
    }

    try {
      // 1. Verify password via IPC
      const verifyRes = await window.api.invoke(IPC_CHANNELS.AUTH.VERIFY_PASSWORD, { password: passwordInput });
      if (!verifyRes.success || !verifyRes.data) {
        alert('Invalid password. Authentication failed.');
        return;
      }

      // 2. Map items and build payload
      const itemsMapped = items
        .filter(item => item.product_variant_id && item.quantity)
        .map(item => ({
          product_variant_id: parseInt(item.product_variant_id),
          quantity: parseFloat(item.quantity) || 0,
          unit_type: item.unit_type,
          unit_price_paise: Math.round((parseFloat(item.unit_price) || 0) * 100),
          subtotal_paise: item.subtotal,
        }));

      const payload = {
        supplier_id: parseInt(supplierId),
        received_date: receivedDate,
        bill_amount_paise: calculatedItemsTotal,
        bill_number: billNumber || undefined,
        notes: notes || undefined,
        bill_photo_path: billPhotoPath || undefined,
        payment_method: paymentMethod,
        items: itemsMapped,
      };

      await editPurchaseRecord.mutateAsync({
        invoiceId: editingInvoiceId!,
        updateData: payload,
        reason: editReason.trim()
      });

      setShowPasswordPrompt(false);
      setPasswordInput('');
      setEditReason('');
      
      setSuccessMsg('Purchase invoice corrected and audited successfully!');
      
      // Auto-open print layout
      const supp = suppliers?.find(s => String(s.id) === supplierId);
      setInvoiceModalData({
        invoiceNumber: billNumber || `BILL-${Date.now()}`,
        invoiceDate: receivedDate,
        poNumber: `PUR-${editingInvoiceId}`,
        fromName: supp?.company_name || 'Supplier',
        billToName: 'Meat Shop Store',
        items: itemsMapped.map(i => {
          const v = variants?.find((x: any) => x.id === i.product_variant_id);
          return {
            qty: i.quantity,
            description: v ? `${v.product_name} (${v.variant_name})` : `Item #${i.product_variant_id}`,
            unitPricePaise: i.unit_price_paise,
            amountPaise: i.subtotal_paise,
          };
        }),
        subtotalPaise: payload.bill_amount_paise,
        totalPaise: payload.bill_amount_paise,
      });

      resetDraft();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      alert(err.message || 'Failed to save audit correction');
    }
  };

  const handleRecentRowClick = (entry: PassbookLedgerEntry) => {
    const invData: InvoiceTemplateData = {
      invoiceNumber: entry.supplier_bill_number || `INV-${entry.ref_id}`,
      invoiceDate: entry.entry_date,
      poNumber: entry.purchase_ref_number,
      fromName: entry.supplier_name,
      billToName: 'Meat Shop Store',
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
    setInvoiceModalData(invData);
  };

  const recentPurchases = ledgerData?.entries?.filter(e => e.type === 'IN').slice(0, 10) || [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-app p-4 sm:p-6 text-text-primary overflow-hidden">
      {/* Page Title */}
      <div className="mb-2 shrink-0">
        <h2 className="text-sm font-bold font-outfit text-text-primary uppercase tracking-wide">Quick Purchase Entry</h2>
      </div>

      {/* 2-Column Workspace Layout */}
      <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0 overflow-hidden">
        
        {/* LEFT COLUMN: Main Form (~75% width) */}
        <div className="w-full xl:w-[75%] flex flex-col min-h-0 overflow-hidden">
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-sm flex-1 flex flex-col min-h-0">
            
            {errorMsg && (
              <div className="bg-red-950/40 border border-red-800/60 text-red-300 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-green-950/40 border border-green-800/60 text-green-300 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
              {/* Edit Mode Banner */}
              {editingInvoiceId !== null && (
                <div className="bg-amber-950/40 border border-amber-800/60 text-amber-300 p-3 rounded-lg text-xs font-semibold flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Editing Purchase Record (ID: #{editingInvoiceId}) — Original Bill Ref: {billNumber}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      resetDraft();
                      setSuccessMsg('');
                      setErrorMsg('');
                    }}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded text-[10px]"
                  >
                    Cancel Edit
                  </button>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
                {/* Supplier (1.5x - 2x wider) */}
                <div className="sm:col-span-2 md:col-span-2">
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Supplier Name *
                  </label>
                  <SearchableSupplierCombobox
                    suppliers={suppliers || []}
                    selectedSupplierId={supplierId ? Number(supplierId) : null}
                    onSelectSupplier={(id) => setSupplierId(String(id))}
                    onAddNewSupplier={() => setShowAddSupplierModal(true)}
                  />
                  {validationErrors.supplier_id && (
                    <span className="text-[10px] text-red-400 font-semibold">{validationErrors.supplier_id}</span>
                  )}
                </div>

                {/* Received Date */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Received Date *
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={e => setReceivedDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2.5 text-xs text-text-primary focus:outline-none focus:border-brand-500 min-h-[46px] font-medium"
                  />
                  {validationErrors.received_date && (
                    <span className="text-[10px] text-red-400 font-semibold">{validationErrors.received_date}</span>
                  )}
                </div>

                {/* Invoice Auto Number (Read Only) */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Invoice No.
                  </label>
                  <div className="w-full bg-surface-panel border border-border-subtle/60 text-text-primary rounded-xl px-3 py-2.5 text-xs font-mono font-bold select-all min-h-[46px] flex items-center box-border">
                    {nextRefNum || `PUR-${todayCleanDate}-001`}
                  </div>
                </div>

                {/* Payment Option */}
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as 'cash' | 'credit')}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-500"
                  >
                    <option value="credit">Credit (Outstanding)</option>
                    <option value="cash">Cash (Immediate Pay)</option>
                  </select>
                </div>
              </div>

              {/* Attach Bill & Notes Actions Row (Compact) */}
              <div className="flex flex-wrap items-center gap-4 shrink-0 border-t border-border-subtle pt-3 text-xs font-semibold text-text-primary">
                {/* Attach Bill Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-lg text-xs font-bold text-text-primary flex items-center gap-1.5 transition-all shrink-0"
                  >
                    <Paperclip size={14} className="text-brand-500" />
                    <span>{billPhotoPath ? billPhotoPath.split('\\').pop()?.split('/').pop() : 'Attach Purchase Bill'}</span>
                  </button>
                  {billPhotoPath && (
                    <button
                      type="button"
                      onClick={() => setBillPhotoPath(null)}
                      className="text-text-muted hover:text-red-400 text-xs font-bold px-1"
                      title="Remove Attachment"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Notes Toggle Button */}
                <div className="flex items-center gap-2">
                  {!showNotesInput ? (
                    <button
                      type="button"
                      onClick={() => setShowNotesInput(true)}
                      className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-lg text-xs font-bold text-text-primary flex items-center gap-1.5 transition-all shrink-0"
                    >
                      + Add Note / Batch Info
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. Morning fresh stock batch"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-brand-500 w-[240px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setNotes('');
                          setShowNotesInput(false);
                        }}
                        className="text-text-muted hover:text-red-400 text-xs font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Received Items Entry */}
              <div className="border-t border-border-subtle pt-4 space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary shrink-0">
                  Item Received
                </h3>

                <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm bg-surface-panel/5 flex-1 flex flex-col min-h-0">
                  {/* Dense Headers */}
                  <div className="grid grid-cols-[60px_3fr_1.2fr_85px_1.2fr_1.5fr_60px] items-center gap-2 bg-surface-panel border-b border-border-subtle text-[10px] uppercase font-bold text-text-muted py-2 px-3 select-none shrink-0">
                    <div className="text-center">#</div>
                    <div>Item Variant</div>
                    <div className="text-right">Quantity</div>
                    <div className="text-center">Unit</div>
                    <div className="text-right">Rate (₹)</div>
                    <div className="text-right">Subtotal (₹)</div>
                    <div className="text-center">Action</div>
                  </div>

                  {/* Committed Items List - Inline Editable */}
                  <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border-subtle bg-surface-card/30">
                    {items.length === 0 ? (
                      <div className="py-8 text-center text-text-muted text-xs select-none">
                        No items entered yet. Click "+ Add Item Row" below to get started.
                      </div>
                    ) : (
                      items.map((item, idx) => {
                        const unitLabel = item.unit_type === 'weight' ? 'Kg' : (item.unit_type === 'live_dual' ? 'Kg/Pcs' : 'Pcs');

                        return (
                          <div
                            key={idx}
                            className="item-row grid grid-cols-[60px_3fr_1.2fr_85px_1.2fr_1.5fr_60px] items-center gap-2 py-2 px-3 hover:bg-surface-hover/20 transition-colors"
                          >
                            {/* Row Index */}
                            <div className="text-center text-xs text-text-muted font-mono select-none">{idx + 1}</div>
                            
                            {/* Product Selector */}
                            <div className="h-9 relative bg-surface-card border border-border-subtle rounded-lg overflow-visible">
                              <SpreadsheetProductSelector
                                variants={variants || []}
                                selectedVariantId={item.product_variant_id ? Number(item.product_variant_id) : null}
                                onSelectVariant={(variant) => {
                                  const updated = [...items];
                                  updated[idx] = {
                                    ...updated[idx],
                                    product_variant_id: variant ? String(variant.id) : '',
                                    unit_type: variant ? variant.unit_type : 'weight',
                                    unit_price: variant ? String(variant.current_rate_paise_per_unit / 100) : '',
                                  };
                                  const qty = parseFloat(updated[idx].quantity) || 0;
                                  const rate = parseFloat(updated[idx].unit_price) || 0;
                                  updated[idx].subtotal = Math.round(qty * rate * 100);
                                  setItems(updated);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const rowEl = (e.target as HTMLElement).closest('.item-row');
                                    const qtyInput = rowEl?.querySelector('.qty-input') as HTMLInputElement;
                                    qtyInput?.focus();
                                    qtyInput?.select();
                                  }
                                }}
                                inputRef={() => {}}
                              />
                            </div>

                            {/* Quantity Input */}
                            <div className="h-9 bg-surface-card border border-border-subtle rounded-lg overflow-hidden">
                              <input
                                type="number"
                                step="0.001"
                                placeholder="0.00"
                                value={item.quantity}
                                onChange={e => {
                                  const updated = [...items];
                                  updated[idx] = {
                                    ...updated[idx],
                                    quantity: e.target.value
                                  };
                                  const qty = parseFloat(updated[idx].quantity) || 0;
                                  const rate = parseFloat(updated[idx].unit_price) || 0;
                                  updated[idx].subtotal = Math.round(qty * rate * 100);
                                  setItems(updated);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const rowEl = e.currentTarget.closest('.item-row');
                                    const rateInput = rowEl?.querySelector('.rate-input') as HTMLInputElement;
                                    rateInput?.focus();
                                    rateInput?.select();
                                  }
                                }}
                                className="qty-input w-full h-full bg-transparent px-3 text-xs font-mono text-text-primary text-right focus:outline-none focus:bg-brand-500/5 focus:ring-1 focus:ring-brand-500"
                              />
                            </div>

                            {/* Unit */}
                            <div className="text-center text-xs text-text-muted font-bold select-none">
                              {item.product_variant_id ? unitLabel : '-'}
                            </div>

                            {/* Rate Input */}
                            <div className="h-9 bg-surface-card border border-border-subtle rounded-lg overflow-hidden">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={item.unit_price}
                                onChange={e => {
                                  const updated = [...items];
                                  updated[idx] = {
                                    ...updated[idx],
                                    unit_price: e.target.value
                                  };
                                  const qty = parseFloat(updated[idx].quantity) || 0;
                                  const rate = parseFloat(updated[idx].unit_price) || 0;
                                  updated[idx].subtotal = Math.round(qty * rate * 100);
                                  setItems(updated);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const isLastRow = idx === items.length - 1;
                                    if (isLastRow) {
                                      setItems(prev => [
                                        ...prev,
                                        {
                                          product_variant_id: '',
                                          quantity: '',
                                          unit_type: 'weight',
                                          unit_price: '',
                                          subtotal: 0
                                        }
                                      ]);
                                      setTimeout(() => {
                                        const allRows = document.querySelectorAll('.item-row');
                                        const lastRow = allRows[allRows.length - 1];
                                        const productInput = lastRow?.querySelector('input[type="text"]') as HTMLInputElement;
                                        productInput?.focus();
                                      }, 50);
                                    } else {
                                      const allRows = document.querySelectorAll('.item-row');
                                      const nextRow = allRows[idx + 1];
                                      const productInput = nextRow?.querySelector('input[type="text"]') as HTMLInputElement;
                                      productInput?.focus();
                                    }
                                  }
                                }}
                                className="rate-input w-full h-full bg-transparent px-3 text-xs font-mono text-text-primary text-right focus:outline-none focus:bg-brand-500/5 focus:ring-1 focus:ring-brand-500"
                              />
                            </div>

                            {/* Subtotal */}
                            <div className="text-right px-3 font-mono text-xs font-bold text-brand-400 select-none">
                              ₹{((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2)}
                            </div>

                            {/* Delete Action */}
                            <div className="text-center select-none">
                              <button
                                type="button"
                                onClick={() => handleRemoveCommittedItem(idx)}
                                className="text-text-muted hover:text-red-400 p-1 transition-opacity"
                                title="Remove Item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Row Button Row */}
                  <div className="p-3 bg-surface-panel/10 border-t border-border-subtle shrink-0 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setItems(prev => [
                          ...prev,
                          {
                            product_variant_id: '',
                            quantity: '',
                            unit_type: 'weight',
                            unit_price: '',
                            subtotal: 0
                          }
                        ]);
                      }}
                      className="px-3 py-1.5 bg-surface-card hover:bg-surface-hover border border-border-subtle text-xs font-bold text-brand-500 rounded-lg flex items-center gap-1.5 transition-all w-fit"
                    >
                      + Add Item Row
                    </button>
                  </div>

                  {/* Live Totals Row */}
                  {items.length > 0 && (
                    <div className="grid grid-cols-[60px_3fr_1.2fr_85px_1.2fr_1.5fr_60px] items-center gap-2 bg-surface-panel border-t border-border-subtle font-bold text-xs text-text-primary py-2 px-3 select-none shrink-0">
                      <div className="text-center"></div>
                      <div className="text-right text-text-muted uppercase text-[9px] tracking-wider font-extrabold">Total</div>
                      <div className="text-right font-mono">{totalQty.toFixed(2)}</div>
                      <div></div>
                      <div></div>
                      <div className="text-right font-mono text-brand-400 text-sm">
                        ₹{(calculatedItemsTotal / 100).toFixed(2)}
                      </div>
                      <div></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border-subtle shrink-0">
                <div className="text-xs">
                  <span className="text-text-muted">Purchase Total: </span>
                  <span className="font-mono font-bold text-text-primary text-sm">
                    {formatPaise(calculatedItemsTotal)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={recordQuickPurchase.isPending}
                  className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                >
                  <Save size={16} />
                  {recordQuickPurchase.isPending ? 'Saving...' : 'Submit Quick Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Sidebar Dashboard Panel (~25% width, Sticky) */}
        <div className="w-full xl:w-[25%] space-y-5 xl:sticky xl:top-6 self-start">
          
          {/* 1. Selected Supplier Snapshot */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Building2 size={14} className="text-brand-500" />
              Selected Supplier Snapshot
            </h3>

            {supplierSnapshot ? (
              <div className="space-y-2.5 text-xs">
                <div className="bg-surface-card p-3 rounded-lg border border-border-subtle flex justify-between items-center">
                  <span className="text-text-muted">Outstanding Owed:</span>
                  <span className="font-mono font-bold text-rose-400 text-sm">
                    {formatPaise(supplierSnapshot.outstanding_balance_paise)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-surface-card p-2.5 rounded-lg border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">Last Purchase</span>
                    <span className="font-bold text-text-primary block mt-0.5">
                      {supplierSnapshot.last_purchase_date ? formatDate(supplierSnapshot.last_purchase_date) : '-'}
                    </span>
                    <span className="font-mono text-brand-400">
                      {supplierSnapshot.last_purchase_amount_paise ? formatPaise(supplierSnapshot.last_purchase_amount_paise) : '-'}
                    </span>
                  </div>

                  <div className="bg-surface-card p-2.5 rounded-lg border border-border-subtle">
                    <span className="text-text-muted block text-[10px]">Last Payment</span>
                    <span className="font-bold text-text-primary block mt-0.5">
                      {supplierSnapshot.last_payment_date ? formatDate(supplierSnapshot.last_payment_date) : '-'}
                    </span>
                    <span className="font-mono text-green-400">
                      {supplierSnapshot.last_payment_amount_paise ? formatPaise(supplierSnapshot.last_payment_amount_paise) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-surface-card border border-border-subtle rounded-lg text-center text-text-muted text-xs font-medium">
                Select a supplier above to see their live outstanding balance and purchase history.
              </div>
            )}
          </div>

          {/* 2. This Month at a Glance */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <DollarSign size={14} className="text-green-400" />
              This Month at a Glance
            </h3>

            {ledgerData?.summary && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-surface-card p-2.5 rounded-lg border border-border-subtle">
                  <span className="text-[10px] text-text-muted block">Purchased</span>
                  <span className="font-mono font-bold text-text-primary mt-0.5 block">
                    {formatPaise(ledgerData.summary.total_purchased_paise)}
                  </span>
                </div>

                <div className="bg-surface-card p-2.5 rounded-lg border border-border-subtle">
                  <span className="text-[10px] text-text-muted block">Paid</span>
                  <span className="font-mono font-bold text-green-400 mt-0.5 block">
                    {formatPaise(ledgerData.summary.total_paid_paise)}
                  </span>
                </div>

                <div className="bg-surface-card p-2.5 rounded-lg border border-border-subtle">
                  <span className="text-[10px] text-text-muted block">Total Outstanding</span>
                  <span className="font-mono font-bold text-rose-400 mt-0.5 block">
                    {formatPaise(ledgerData.summary.total_outstanding_paise)}
                  </span>
                </div>
              </div>
            )}
          </div>
            {/* 3. Recent Purchases List */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-brand-400" />
                Recent Purchases
              </span>
              <span className="text-[10px] text-text-muted lowercase font-normal">(click to view)</span>
            </h3>

            {recentPurchases.length === 0 ? (
              <div className="p-3 text-center text-text-muted text-xs">No recent purchases recorded.</div>
            ) : (
              <div className="space-y-2 text-xs max-h-[320px] overflow-y-auto pr-1">
                {recentPurchases.slice(0, 10).map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => handleRecentRowClick(entry)}
                    className="p-2.5 bg-surface-card hover:bg-surface-hover/80 border border-border-subtle rounded-lg cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-text-primary flex items-center gap-1.5">
                        <span>{entry.supplier_name}</span>
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-2">
                        <span>{formatDate(entry.entry_date)}</span>
                        <span>•</span>
                        <span className="font-mono text-brand-400">{entry.purchase_ref_number}</span>
                      </div>
                    </div>

                    <div className="text-right font-mono font-bold text-text-primary text-xs">
                      {formatPaise(entry.amount_paise)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Printable Invoice Modal */}
      {invoiceModalData && (
        <InvoiceTemplateModal
          data={invoiceModalData}
          onClose={() => setInvoiceModalData(null)}
        />
      )}

      {/* Audit Edit Password Confirmation Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl text-text-primary">
            <div>
              <h3 className="text-base font-bold font-outfit text-amber-400 flex items-center gap-2">
                ⚠️ Authorize Purchase Corrections
              </h3>
              <p className="text-xs text-text-muted mt-1">
                A manager or admin password is required to save modifications to this purchase record. All changes are logged in the audit trail.
              </p>
            </div>

            <form onSubmit={handleSaveEditConfirm} className="space-y-4 text-xs font-semibold">
              <div>
                <label className="block text-text-secondary mb-1">Audit Edit Reason (Mandatory) *</label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="e.g. Corrected quantity typo from physical bill"
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Confirm Manager/Admin Password *</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setPasswordInput('');
                    setEditReason('');
                  }}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-lg text-text-secondary font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-lg flex items-center gap-1.5"
                >
                  Confirm & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline Add New Supplier Modal */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <SupplierForm
              onSuccess={(newSupp) => {
                setShowAddSupplierModal(false);
                refetchSuppliers();
                if (newSupp?.id) setSupplierId(String(newSupp.id));
              }}
              onCancel={() => setShowAddSupplierModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
