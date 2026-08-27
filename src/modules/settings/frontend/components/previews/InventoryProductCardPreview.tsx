import React from 'react';
import { Boxes, AlertTriangle, Layers, Calendar } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const InventoryProductCardPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const inv = draftConfig.inventory;

  const lowStockThreshold = inv?.defaultLowStockThreshold ?? 5;
  const currentStock = 3.5; // Trigger low stock
  const isLowStock = currentStock <= lowStockThreshold;

  return (
    <div className="w-full space-y-4">
      {/* Product Tile Simulation */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Boxes size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Live Product Card
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20 uppercase">
            {inv?.valuationMethod || 'FIFO'}
          </span>
        </div>

        {/* Mock Product Card */}
        <div className="p-4 rounded-xl bg-surface-panel border border-border-subtle space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h5 className="font-bold text-xs text-text-primary">Chicken Curry Cut (Fresh)</h5>
              <p className="text-[10px] font-mono text-text-muted">SKU: PROD-CHK-001 · Unit: {inv?.defaultUnit || 'kg'}</p>
            </div>
            <span className="text-sm font-black font-mono text-brand-500">₹320.00</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-black text-text-primary">
                {currentStock.toFixed(3)} {inv?.defaultUnit || 'kg'}
              </span>
              <span className="text-[10px] text-text-muted">available</span>
            </div>

            {inv?.alertLowStock && isLowStock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold">
                <AlertTriangle size={11} /> Low Stock (≤{lowStockThreshold})
              </span>
            )}
          </div>
        </div>

        {/* Inventory Rules Summary */}
        <div className="space-y-2 text-xs border-t border-border-subtle pt-3">
          <div className="flex justify-between text-text-muted">
            <span>Negative Stock Sales:</span>
            <span className={`font-bold ${inv?.allowNegativeStock ? 'text-emerald-500' : 'text-rose-500'}`}>
              {inv?.allowNegativeStock ? 'Allowed (Auto-Backlogged)' : 'Blocked'}
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Batch & FIFO Tracking:</span>
            <span className="font-bold text-text-primary">
              {inv?.batchTracking ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between text-text-muted">
            <span>Expiry Alerts:</span>
            <span className="font-bold text-text-primary">
              {inv?.expiryTracking ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Controls valuation calculations, automatic batch FIFO deductions, and oversold flags.
      </p>
    </div>
  );
};
