import React, { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { useSuppliersProfile, useCreatePurchaseOrder } from '../../hooks/useSupplierProcurement';
import { useActiveRates } from '../../../../billing/frontend/hooks/useActiveRates';
import { formatPaise } from '../../types/supplier.types';
import { CreatePurchaseOrderSchema } from '../../validation/supplier_procurement.schema';

interface PurchaseOrderWizardProps {
  onCancel: () => void;
  onSuccess?: () => void;
}

interface PurchaseItemInput {
  product_variant_id: string;
  quantity_ordered: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  unit_price: string;
  subtotal: number;
}

export default function PurchaseOrderWizard({ onCancel, onSuccess }: PurchaseOrderWizardProps) {
  const { data: suppliers } = useSuppliersProfile();
  const { data: variants } = useActiveRates();
  const createPoMutation = useCreatePurchaseOrder();

  // PO Header State
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');

  // PO Items State
  const [items, setItems] = useState<PurchaseItemInput[]>([
    { product_variant_id: '', quantity_ordered: '', unit_type: 'weight', unit_price: '', subtotal: 0 }
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Add Item Row
  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      { product_variant_id: '', quantity_ordered: '', unit_type: 'weight', unit_price: '', subtotal: 0 }
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Handle Item Field Change
  const handleItemFieldChange = (index: number, field: keyof PurchaseItemInput, value: string) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'product_variant_id') {
        target.product_variant_id = value;
        // Auto fill unit type and price if matching variant is found
        const variant = variants?.find((v: any) => String(v.id) === value);
        if (variant) {
          target.unit_type = variant.unit_type;
          target.unit_price = String(variant.current_rate_paise_per_unit / 100);
        }
      } else {
        (target as any)[field] = value;
      }

      // Calculate subtotal
      const qty = parseFloat(target.quantity_ordered) || 0;
      const rate = parseFloat(target.unit_price) || 0;
      target.subtotal = Math.round(qty * rate * 100);

      copy[index] = target;
      return copy;
    });
  };

  // Grand Total Calculation
  const grandTotalPaise = items.reduce((acc, curr) => acc + curr.subtotal, 0);

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setValidationErrors({});

    if (!supplierId) {
      setErrorMsg('Please select a supplier');
      return;
    }

    // Map wizard state to API contract
    const poItemsMapped = items
      .filter(item => item.product_variant_id && item.quantity_ordered)
      .map(item => {
        const qty = parseFloat(item.quantity_ordered);
        const pricePaise = Math.round(parseFloat(item.unit_price) * 100);
        return {
          product_variant_id: parseInt(item.product_variant_id),
          quantity_ordered: item.unit_type === 'weight' ? Math.round(qty * 1000) : Math.round(qty),
          unit_type: item.unit_type,
          unit_price_paise: pricePaise,
        };
      });

    if (poItemsMapped.length === 0) {
      setErrorMsg('Purchase order must contain at least one valid item');
      return;
    }

    const payload = {
      supplier_id: parseInt(supplierId),
      order_date: orderDate,
      expected_delivery_date: expectedDeliveryDate || null,
      notes: notes.trim() || null,
      items: poItemsMapped,
    };

    // Zod Validation
    const parsed = CreatePurchaseOrderSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrs: Record<string, string> = {};
      parsed.error.errors.forEach((err: any) => {
        if (err.path[0] === 'items') {
          fieldErrs['items'] = 'Invalid items. Ensure all fields are filled with positive numbers.';
        } else if (err.path[0]) {
          fieldErrs[String(err.path[0])] = err.message;
        }
      });
      setValidationErrors(fieldErrs);
      setErrorMsg('Validation failed. Please correct order entries.');
      return;
    }

    try {
      await createPoMutation.mutateAsync(parsed.data);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save purchase order');
    }
  };

  return (
    <div className="bg-surface-panel rounded-xl border border-border-subtle overflow-hidden flex flex-col h-full shadow-sm">
      {/* Header */}
      <div className="border-b border-border-subtle p-4 flex items-center justify-between bg-surface-app/40 flex-shrink-0">
        <div>
          <h3 className="text-sm font-bold font-outfit text-text-secondary">Draft Purchase Order (PO)</h3>
          <p className="text-[10px] text-text-muted">Generate order contracts for inventory procurement.</p>
        </div>
        <button onClick={onCancel} className="text-text-muted hover:text-text-secondary transition-colors p-1">
          <X size={16} />
        </button>
      </div>

      {/* Main Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col min-h-0">
        {errorMsg && (
          <div className="p-3 bg-rose-950/20 border border-rose-900/50 text-rose-400 rounded-lg text-xs font-semibold flex items-center gap-2">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PO Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Supplier *</label>
            <select
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              className={`w-full px-3 py-1.5 bg-surface-app border ${validationErrors.supplier_id ? 'border-rose-500' : 'border-border-subtle'} text-text-secondary rounded-lg text-xs font-semibold outline-none focus:border-accent`}
            >
              <option value="">Select Supplier...</option>
              {suppliers?.map(s => (
                <option key={s.id} value={s.id}>{s.company_name} ({s.code})</option>
              ))}
            </select>
            {validationErrors.supplier_id && <p className="text-[9px] text-rose-400 font-semibold">{validationErrors.supplier_id}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Order Date *</label>
            <input
              type="date"
              required
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs font-mono outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-text-muted">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={e => setExpectedDeliveryDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs font-mono outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* PO Line Items Section */}
        <div className="flex-1 min-h-[200px] border border-border-subtle rounded-xl overflow-hidden flex flex-col bg-surface-app/30">
          <div className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle p-3 flex">
            <div className="w-[40%]">Product Variant</div>
            <div className="w-[15%] text-right pr-2">Quantity</div>
            <div className="w-[12%]">Unit</div>
            <div className="w-[18%] text-right pr-2">Unit Price (₹)</div>
            <div className="w-[15%] text-right pr-4">Subtotal</div>
            <div className="w-8"></div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/40 p-1">
            {items.map((item, idx) => (
              <div key={idx} className="flex py-2 px-2 items-center gap-2">
                {/* Variant Selector */}
                <div className="w-[40%]">
                  <select
                    value={item.product_variant_id}
                    onChange={e => handleItemFieldChange(idx, 'product_variant_id', e.target.value)}
                    className="w-full bg-surface-panel border border-border-subtle text-text-secondary rounded p-1 text-xs outline-none focus:border-accent"
                  >
                    <option value="">Select Variant...</option>
                    {variants?.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.product_name} ({v.variant_name})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity input */}
                <div className="w-[15%]">
                  <input
                    type="number"
                    step={item.unit_type === 'weight' ? '0.001' : '1'}
                    required
                    placeholder="0.0"
                    value={item.quantity_ordered}
                    onChange={e => handleItemFieldChange(idx, 'quantity_ordered', e.target.value)}
                    className="w-full bg-surface-panel border border-border-subtle text-text-secondary text-right p-1 text-xs font-mono rounded"
                  />
                </div>

                {/* Unit Type display */}
                <div className="w-[12%] text-text-muted text-xs uppercase font-bold pl-2 select-none">
                  {item.unit_type === 'weight' ? 'kg' : 'pcs'}
                </div>

                {/* Unit Price input */}
                <div className="w-[18%]">
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

                {/* Subtotal Display */}
                <div className="w-[15%] text-right pr-4 font-mono font-bold text-text-secondary">
                  {formatPaise(item.subtotal)}
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleRemoveItemRow(idx)}
                  disabled={items.length <= 1}
                  className="text-text-muted hover:text-rose-400 p-1 disabled:opacity-30"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Add item row trigger */}
          <div className="p-3 bg-surface-app/40 border-t border-border-subtle flex justify-between items-center flex-shrink-0">
            <button
              type="button"
              onClick={handleAddItemRow}
              className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
            >
              <Plus size={12} /> Add Line Item
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-text-muted">Total Cost:</span>
              <span className="font-mono text-xs font-bold text-accent">{formatPaise(grandTotalPaise)}</span>
            </div>
          </div>
        </div>

        {/* PO Notes */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-bold text-text-muted font-outfit">Special instructions / Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add any specific requirements for this purchase order contract..."
            className="w-full px-3 py-1.5 bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-border-subtle text-text-muted hover:text-text-secondary hover:bg-surface-app text-xs font-bold rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createPoMutation.isPending}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Save size={13} />
            {createPoMutation.isPending ? 'Generating PO...' : 'Create Draft PO'}
          </button>
        </div>
      </form>
    </div>
  );
}
