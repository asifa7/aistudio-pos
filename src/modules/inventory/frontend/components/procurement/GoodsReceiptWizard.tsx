import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, ClipboardCheck, Info } from 'lucide-react';
import {
  useSuppliersProfile,
  usePurchaseOrders,
  usePurchaseOrderDetails,
  useCreateGoodsReceipt
} from '../../hooks/useSupplierProcurement';
import { useActiveRates } from '../../../../billing/frontend/hooks/useActiveRates';
import { GoodsReceiptSchema } from '../../validation/supplier_procurement.schema';

interface GoodsReceiptWizardProps {
  onCancel: () => void;
  onSuccess?: () => void;
}

interface ReceiptItemInput {
  purchase_order_item_id?: number;
  product_variant_id: string;
  variant_name?: string; // Display helper
  unit_type: 'weight' | 'piece' | 'live_dual';
  quantity_ordered_display?: string; // Display helper
  quantity_accepted: string;
  quantity_rejected: string;
  rejection_reason: string;
  batch_number: string;
  expiry_date: string;
}

export default function GoodsReceiptWizard({ onCancel, onSuccess }: GoodsReceiptWizardProps) {
  const { data: suppliers } = useSuppliersProfile();
  const { data: activeRates } = useActiveRates();
  const { data: allPos } = usePurchaseOrders();
  const createGrnMutation = useCreateGoodsReceipt();

  // Form Header State
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Items State
  const [items, setItems] = useState<ReceiptItemInput[]>([
    { product_variant_id: '', unit_type: 'weight', quantity_accepted: '', quantity_rejected: '0', rejection_reason: '', batch_number: '', expiry_date: '' }
  ]);

  const [errorMsg, setErrorMsg] = useState('');

  // Fetch PO items when a purchase order is selected
  const { data: poDetails, isLoading: isLoadingPoDetails } = usePurchaseOrderDetails(
    purchaseOrderId ? parseInt(purchaseOrderId) : undefined
  );

  // Filter approved POs for the selected supplier
  const supplierPos = allPos?.filter(po => po.supplier_id === parseInt(supplierId) && (po.status === 'approved' || po.status === 'submitted')) || [];

  // When PO Details change, pre-populate receipt items
  useEffect(() => {
    if (poDetails?.items) {
      const mappedItems: ReceiptItemInput[] = poDetails.items.map(item => {
        const qtyOrderedDisplay = item.unit_type === 'weight'
          ? (item.quantity_ordered / 1000).toFixed(3)
          : String(item.quantity_ordered);

        return {
          purchase_order_item_id: item.id,
          product_variant_id: String(item.product_variant_id),
          variant_name: activeRates?.find((v: any) => v.id === item.product_variant_id)?.product_name || `Variant #${item.product_variant_id}`,
          unit_type: item.unit_type,
          quantity_ordered_display: qtyOrderedDisplay,
          quantity_accepted: qtyOrderedDisplay, // Default accept all
          quantity_rejected: '0',
          rejection_reason: '',
          batch_number: '',
          expiry_date: '',
        };
      });
      setItems(mappedItems);
    } else {
      // Reset items if PO is deselected
      setItems([{ product_variant_id: '', unit_type: 'weight', quantity_accepted: '', quantity_rejected: '0', rejection_reason: '', batch_number: '', expiry_date: '' }]);
    }
  }, [poDetails, activeRates]);

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { product_variant_id: '', unit_type: 'weight', quantity_accepted: '', quantity_rejected: '0', rejection_reason: '', batch_number: '', expiry_date: '' }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof ReceiptItemInput, value: string) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'product_variant_id') {
        target.product_variant_id = value;
        const matchingVariant = activeRates?.find((v: any) => String(v.id) === value);
        if (matchingVariant) {
          target.unit_type = matchingVariant.unit_type;
        }
      } else {
        (target as any)[field] = value;
      }

      copy[index] = target;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier');
      return;
    }

    // Map fields
    const grnItemsMapped = items
      .filter(item => item.product_variant_id && item.quantity_accepted)
      .map(item => {
        const acceptQty = parseFloat(item.quantity_accepted);
        const rejectQty = parseFloat(item.quantity_rejected) || 0;

        return {
          purchase_order_item_id: item.purchase_order_item_id || null,
          product_variant_id: parseInt(item.product_variant_id),
          quantity_accepted: item.unit_type === 'weight' ? Math.round(acceptQty * 1000) : Math.round(acceptQty),
          quantity_rejected: item.unit_type === 'weight' ? Math.round(rejectQty * 1000) : Math.round(rejectQty),
          rejection_reason: item.rejection_reason.trim() || null,
          batch_number: item.batch_number.trim() || null,
          expiry_date: item.expiry_date || null,
        };
      });

    if (grnItemsMapped.length === 0) {
      setErrorMsg('Goods receipt must contain at least one valid item');
      return;
    }

    const payload = {
      purchase_order_id: purchaseOrderId ? parseInt(purchaseOrderId) : null,
      supplier_id: parseInt(supplierId),
      delivery_note_number: deliveryNoteNumber.trim() || null,
      received_date: receivedDate,
      notes: notes.trim() || null,
      items: grnItemsMapped,
    };

    const parsed = GoodsReceiptSchema.safeParse(payload);
    if (!parsed.success) {
      setErrorMsg('Validation failed. Please correct Goods Receipt rows.');
      return;
    }

    try {
      await createGrnMutation.mutateAsync(parsed.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save goods receipt note');
    }
  };

  return (
    <div className="bg-surface-panel rounded-xl border border-border-subtle overflow-hidden flex flex-col h-full shadow-sm max-h-[85vh]">
      {/* Header */}
      <div className="border-b border-border-subtle p-4 flex items-center justify-between bg-surface-app/40 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold font-outfit text-text-secondary flex items-center gap-1.5">
            <ClipboardCheck size={16} className="text-accent" />
            <span>Generate Goods Receipt Note (GRN)</span>
          </h3>
          <p className="text-[10px] text-text-muted">Perform stock verification, log rejections, and commit stock balances.</p>
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
                setPurchaseOrderId(''); // Reset PO when supplier changes
              }}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-semibold"
            >
              <option value="">Select Supplier...</option>
              {suppliers?.map(s => (
                <option key={s.id} value={s.id}>{s.company_name}</option>
              ))}
            </select>
          </div>

          {/* Reference PO */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
              <span>Linked Purchase Order</span>
              <span className="text-[8px] text-text-muted">(Optional)</span>
            </label>
            <select
              disabled={!supplierId}
              value={purchaseOrderId}
              onChange={e => setPurchaseOrderId(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent disabled:opacity-50 font-semibold"
            >
              <option value="">Direct Stock (No PO)...</option>
              {supplierPos.map(po => (
                <option key={po.id} value={po.id}>{po.po_number} ({new Date(po.order_date).toLocaleDateString()})</option>
              ))}
            </select>
          </div>

          {/* Delivery Note */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Challan / Delivery Note No.</label>
            <input
              type="text"
              placeholder="e.g. DEL/9091"
              value={deliveryNoteNumber}
              onChange={e => setDeliveryNoteNumber(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-semibold"
            />
          </div>

          {/* Received Date */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Stock Entry Date *</label>
            <input
              type="date"
              required
              value={receivedDate}
              onChange={e => setReceivedDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        {/* PO Reference hint */}
        {purchaseOrderId && (
          <div className="p-3 bg-accent/5 border border-accent/20 text-[10px] text-text-secondary/90 rounded-lg flex items-center gap-2 font-medium">
            <Info size={12} className="text-accent flex-shrink-0" />
            <span>Items have been prefilled based on approved PO reference. Unreceived quantities can be marked as rejected.</span>
          </div>
        )}

        {/* Receipt Line Items */}
        <div className="flex-1 min-h-[220px] border border-border-subtle rounded-xl overflow-hidden flex flex-col bg-surface-app/30">
          <div className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle p-3 flex">
            <div className="w-[30%]">Product Variant</div>
            {purchaseOrderId && <div className="w-[10%] text-right pr-2">PO Qty</div>}
            <div className="w-[12%] text-right pr-2">Accepted Qty</div>
            <div className="w-[12%] text-right pr-2">Rejected Qty</div>
            <div className="w-[15%]">Reject Reason</div>
            <div className="w-[13%]">Batch No.</div>
            <div className="w-[13%]">Expiry Date</div>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/40 p-1">
            {isLoadingPoDetails ? (
              <p className="text-center text-xs text-text-muted py-8">Fetching PO contents...</p>
            ) : (
              items.map((item, idx) => (
                <div key={idx} className="flex py-2 px-2 items-center gap-2">
                  {/* Variant */}
                  <div className="w-[30%]">
                    {purchaseOrderId ? (
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

                  {/* PO Qty */}
                  {purchaseOrderId && (
                    <div className="w-[10%] text-right pr-2 font-mono text-xs text-text-muted font-bold">
                      {item.quantity_ordered_display} <span className="text-[9px] font-bold font-sans uppercase">{item.unit_type === 'weight' ? 'kg' : 'pcs'}</span>
                    </div>
                  )}

                  {/* Accepted Qty */}
                  <div className="w-[12%]">
                    <input
                      type="number"
                      step={item.unit_type === 'weight' ? '0.001' : '1'}
                      required
                      placeholder="0.0"
                      value={item.quantity_accepted}
                      onChange={e => handleItemFieldChange(idx, 'quantity_accepted', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary text-right p-1 text-xs font-mono rounded"
                    />
                  </div>

                  {/* Rejected Qty */}
                  <div className="w-[12%]">
                    <input
                      type="number"
                      step={item.unit_type === 'weight' ? '0.001' : '1'}
                      required
                      placeholder="0.0"
                      value={item.quantity_rejected}
                      onChange={e => handleItemFieldChange(idx, 'quantity_rejected', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary text-right p-1 text-xs font-mono rounded"
                    />
                  </div>

                  {/* Rejection Reason */}
                  <div className="w-[15%]">
                    <input
                      type="text"
                      placeholder="Reason..."
                      value={item.rejection_reason}
                      onChange={e => handleItemFieldChange(idx, 'rejection_reason', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary p-1 text-xs rounded"
                    />
                  </div>

                  {/* Batch Number */}
                  <div className="w-[13%]">
                    <input
                      type="text"
                      placeholder="Batch ID"
                      value={item.batch_number}
                      onChange={e => handleItemFieldChange(idx, 'batch_number', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary p-1 text-xs font-mono rounded font-semibold"
                    />
                  </div>

                  {/* Expiry Date */}
                  <div className="w-[13%]">
                    <input
                      type="date"
                      value={item.expiry_date}
                      onChange={e => handleItemFieldChange(idx, 'expiry_date', e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle text-text-secondary p-1 text-xs font-mono rounded"
                    />
                  </div>

                  {/* Delete button (Only if direct receipt note) */}
                  <div className="w-8 text-center">
                    {!purchaseOrderId && (
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

          {/* Bottom info bar */}
          {!purchaseOrderId && (
            <div className="p-3 bg-surface-app/40 border-t border-border-subtle flex-shrink-0">
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
              >
                <Plus size={12} /> Add Item Row
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-text-muted">Audit Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Log details on quality inspection, temperature logs, or logistics anomalies..."
            className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Buttons */}
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
            disabled={createGrnMutation.isPending}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
          >
            <Save size={13} />
            {createGrnMutation.isPending ? 'Committing stock...' : 'Verify & Log GRN'}
          </button>
        </div>
      </form>
    </div>
  );
}
