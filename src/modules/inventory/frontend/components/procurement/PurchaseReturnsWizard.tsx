import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, RotateCcw, Info } from 'lucide-react';
import {
  useSuppliersProfile,
  usePurchaseInvoices,
  usePurchaseInvoiceDetails,
  useCreatePurchaseReturn
} from '../../hooks/useSupplierProcurement';
import { useActiveRates } from '../../../../billing/frontend/hooks/useActiveRates';
import { formatPaise, formatDate } from '../../types/supplier.types';
import { PurchaseReturnSchema } from '../../validation/supplier_procurement.schema';

interface PurchaseReturnsWizardProps {
  onCancel: () => void;
  onSuccess?: () => void;
}

interface ReturnItemInput {
  product_variant_id: string;
  variant_name?: string; // Display helper
  unit_type: 'weight' | 'piece' | 'live_dual';
  quantity_invoiced_display?: string; // Display helper
  quantity: string;
  unit_price: string;
  gst_amount: string;
  total: number; // calculated paise
}

export default function PurchaseReturnsWizard({ onCancel, onSuccess }: PurchaseReturnsWizardProps) {
  const { data: suppliers } = useSuppliersProfile();
  const { data: activeRates } = useActiveRates();
  const { data: invoices } = usePurchaseInvoices();
  const createReturnMutation = useCreatePurchaseReturn();

  // Header State
  const [supplierId, setSupplierId] = useState('');
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [resolvedVia, setResolvedVia] = useState<'refund' | 'replacement' | 'debit_note'>('debit_note');
  const [reason, setReason] = useState('');

  // Items State
  const [items, setItems] = useState<ReturnItemInput[]>([
    { product_variant_id: '', unit_type: 'weight', quantity: '', unit_price: '', gst_amount: '0', total: 0 }
  ]);

  const [errorMsg, setErrorMsg] = useState('');

  // Fetch invoice details when linked invoice is selected
  const { data: invoiceDetails, isLoading: isLoadingInvDetails } = usePurchaseInvoiceDetails(
    purchaseInvoiceId ? parseInt(purchaseInvoiceId) : undefined
  );

  // Filter invoices by selected supplier
  const supplierInvoices = invoices?.filter(inv => inv.supplier_id === parseInt(supplierId)) || [];

  // Populating return rows when invoice details load
  useEffect(() => {
    if (invoiceDetails?.items) {
      const mappedItems: ReturnItemInput[] = invoiceDetails.items.map(item => {
        const qtyDisplay = String(item.quantity);
        return {
          product_variant_id: String(item.product_variant_id),
          variant_name: activeRates?.find((v: any) => v.id === item.product_variant_id)?.product_name || `Variant #${item.product_variant_id}`,
          unit_type: 'piece', // Defaulting unit type
          quantity_invoiced_display: qtyDisplay,
          quantity: qtyDisplay, // Default return all
          unit_price: String(item.unit_price_paise / 100),
          gst_amount: String((item.gst_amount_paise || 0) / 100),
          total: item.total_amount_paise,
        };
      });
      setItems(mappedItems);
    } else {
      setItems([{ product_variant_id: '', unit_type: 'weight', quantity: '', unit_price: '', gst_amount: '0', total: 0 }]);
    }
  }, [invoiceDetails, activeRates]);

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { product_variant_id: '', unit_type: 'weight', quantity: '', unit_price: '', gst_amount: '0', total: 0 }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof ReturnItemInput, value: string) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'product_variant_id') {
        target.product_variant_id = value;
         const matchingVariant = activeRates?.find((v: any) => String(v.id) === value);
        if (matchingVariant) {
          target.unit_type = matchingVariant.unit_type;
          target.unit_price = String(matchingVariant.current_rate_paise_per_unit / 100);
        }
      } else {
        (target as any)[field] = value;
      }

      // Calculate total
      const qty = parseFloat(target.quantity) || 0;
      const rate = parseFloat(target.unit_price) || 0;
      const gst = parseFloat(target.gst_amount) || 0;
      target.total = Math.round((qty * rate + gst) * 100);

      copy[index] = target;
      return copy;
    });
  };

  // Grand Total Calculation
  const totalRefundAmountPaise = items.reduce((acc, curr) => acc + curr.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier');
      return;
    }

    const returnItemsMapped = items
      .filter(item => item.product_variant_id && item.quantity)
      .map(item => {
        const qty = parseFloat(item.quantity);
        const pricePaise = Math.round(parseFloat(item.unit_price) * 100);
        const gstPaise = Math.round(parseFloat(item.gst_amount) * 100);

        return {
          product_variant_id: parseInt(item.product_variant_id),
          quantity: item.unit_type === 'weight' ? Math.round(qty * 1000) : Math.round(qty),
          unit_price_paise: pricePaise,
          gst_amount_paise: gstPaise,
          total_amount_paise: item.total,
        };
      });

    if (returnItemsMapped.length === 0) {
      setErrorMsg('Return note must contain at least one line item');
      return;
    }

    const payload = {
      purchase_invoice_id: purchaseInvoiceId ? parseInt(purchaseInvoiceId) : null,
      supplier_id: parseInt(supplierId),
      return_date: returnDate,
      reason: reason.trim() || null,
      total_refund_amount_paise: totalRefundAmountPaise,
      resolved_via: resolvedVia,
      items: returnItemsMapped,
    };

    const parsed = PurchaseReturnSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorMsg('Validation failed. Ensure all items have positive quantities.');
      return;
    }

    try {
      await createReturnMutation.mutateAsync(parsed.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save purchase return log');
    }
  };

  return (
    <div className="bg-surface-panel rounded-xl border border-border-subtle overflow-hidden flex flex-col h-full shadow-sm max-h-[85vh]">
      {/* Header */}
      <div className="border-b border-border-subtle p-4 flex items-center justify-between bg-surface-app/40 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold font-outfit text-text-secondary flex items-center gap-1.5">
            <RotateCcw size={16} className="text-accent" />
            <span>Process Purchase Return</span>
          </h3>
          <p className="text-[10px] text-text-muted">Draft Debit Notes and return damaged/excess stock shipments back to vendors.</p>
        </div>
        <button onClick={onCancel} className="text-text-muted hover:text-text-secondary transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col min-h-0">
        {errorMsg && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/50 text-rose-400 rounded-lg text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Supplier */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Supplier *</label>
            <select
              value={supplierId}
              onChange={e => {
                setSupplierId(e.target.value);
                setPurchaseInvoiceId('');
              }}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-semibold"
            >
              <option value="">Select Supplier...</option>
              {suppliers?.map(s => (
                <option key={s.id} value={s.id}>{s.company_name}</option>
              ))}
            </select>
          </div>

          {/* Linked Invoice */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
              <span>Linked Invoice</span>
              <span className="text-[8px] text-text-muted">(Optional)</span>
            </label>
            <select
              disabled={!supplierId}
              value={purchaseInvoiceId}
              onChange={e => setPurchaseInvoiceId(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent disabled:opacity-50 font-semibold"
            >
              <option value="">Select Invoice...</option>
              {supplierInvoices.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.invoice_number} ({formatDate(inv.invoice_date)})</option>
              ))}
            </select>
          </div>

          {/* Resolution Mode */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Resolution Mode *</label>
            <select
              value={resolvedVia}
              onChange={e => setResolvedVia(e.target.value as any)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-semibold"
            >
              <option value="debit_note">Debit Note (Deduct Owed Balance)</option>
              <option value="refund">Cash Refund</option>
              <option value="replacement">Goods Replacement</option>
            </select>
          </div>

          {/* Return Date */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Return Date *</label>
            <input
              type="date"
              required
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        {/* Invoice linked hint */}
        {purchaseInvoiceId && (
          <div className="p-3 bg-accent/5 border border-accent/20 text-[10px] text-text-secondary/90 rounded-lg flex items-center gap-2 font-medium">
            <Info size={12} className="text-accent flex-shrink-0" />
            <span>Items have been prefilled based on linked invoice. Modify quantities to return partial lots.</span>
          </div>
        )}

        {/* Line items container */}
        <div className="flex-1 min-h-[220px] border border-border-subtle rounded-xl overflow-hidden flex flex-col bg-surface-app/30">
          <div className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle p-3 flex">
            <div className="w-[30%]">Product Variant</div>
            {purchaseInvoiceId && <div className="w-[10%] text-right pr-2">Invoiced Qty</div>}
            <div className="w-[12%] text-right pr-2">Return Qty</div>
            <div className="w-[15%] text-right pr-2">Unit Price (₹)</div>
            <div className="w-[12%] text-right pr-2">Tax (₹)</div>
            <div className="w-[15%] text-right pr-4">Total Refund</div>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/40 p-1">
            {isLoadingInvDetails ? (
              <p className="text-center text-xs text-text-muted py-8">Fetching invoice details...</p>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="flex py-2 px-2 items-center gap-2">
                  {/* Variant Selector */}
                  <div className="w-[30%]">
                    {purchaseInvoiceId ? (
                      <span className="text-xs text-text-secondary font-bold truncate block">{item.variant_name}</span>
                    ) : (
                      <select
                        value={item.product_variant_id}
                        onChange={e => handleItemFieldChange(idx, 'product_variant_id', e.target.value)}
                        className="w-full bg-surface-panel border border-border-subtle text-text-secondary rounded p-1 text-xs outline-none"
                      >
                        <option value="">Select Variant...</option>
                        {activeRates?.map((v: any) => (
                          <option key={v.id} value={v.id}>{v.product_name} ({v.variant_name})</option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Invoiced Qty display */}
                  {purchaseInvoiceId && (
                    <div className="w-[10%] text-right pr-2 font-mono text-xs text-text-muted font-bold">
                      {item.quantity_invoiced_display}
                    </div>
                  )}

                  {/* Return Qty */}
                  <div className="w-[12%]">
                    <input
                      type="number"
                      step={item.unit_type === 'weight' ? '0.001' : '1'}
                      required
                      placeholder="0.0"
                      value={item.quantity}
                      onChange={e => handleItemFieldChange(idx, 'quantity', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary text-right p-1 text-xs font-mono rounded"
                    />
                  </div>

                  {/* Unit price */}
                  <div className="w-[15%]">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={item.unit_price}
                      onChange={e => handleItemFieldChange(idx, 'unit_price', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary text-right p-1 text-xs font-mono rounded"
                    />
                  </div>

                  {/* Tax */}
                  <div className="w-[12%]">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={item.gst_amount}
                      onChange={e => handleItemFieldChange(idx, 'gst_amount', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary text-right p-1 text-xs font-mono rounded"
                    />
                  </div>

                  {/* Total display */}
                  <div className="w-[15%] text-right pr-4 font-mono font-bold text-brand-500">
                    {formatPaise(item.total)}
                  </div>

                  {/* Delete row */}
                  <div className="w-8 text-center">
                    {!purchaseInvoiceId && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        disabled={items.length <= 1}
                        className="text-text-muted hover:text-rose-400 p-1"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom row summary */}
          <div className="p-3 bg-surface-app/40 border-t border-border-subtle flex justify-between items-center flex-shrink-0">
            {!purchaseInvoiceId ? (
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
              >
                <Plus size={12} /> Add Item Row
              </button>
            ) : (
              <div></div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-text-muted">Total Credit Refund:</span>
              <span className="font-mono text-xs font-bold text-brand-500">{formatPaise(totalRefundAmountPaise)}</span>
            </div>
          </div>
        </div>

        {/* Reason / Notes */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-text-muted">Reason for Return</label>
          <textarea
            rows={2}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Add comments justifying this return (e.g. cold chain temperature breach, quality decay)..."
            className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border-subtle text-text-muted hover:text-text-secondary hover:bg-surface-app text-xs font-bold rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createReturnMutation.isPending}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
          >
            <RotateCcw size={13} />
            {createReturnMutation.isPending ? 'Logging Return...' : 'Commit Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
