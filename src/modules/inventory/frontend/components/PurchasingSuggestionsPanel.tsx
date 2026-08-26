import { AlertTriangle, PackageCheck } from 'lucide-react';
import { useStockStatus } from '../hooks/useInventory';

export default function PurchasingSuggestionsPanel() {
  const { data: stocks, isLoading } = useStockStatus();

  if (isLoading) {
    return (
      <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation text-text-muted text-xs flex items-center justify-center">
        Checking current stock levels...
      </div>
    );
  }

  // Filter items that are low in stock (below their safety threshold or <= 0)
  const lowStockItems = (stocks || []).filter(s => {
    if (s.is_processed_cut === 1) return false; // Ignore processed cuts
    const isWeight = s.unit_type === 'weight' || s.unit_type === 'live_dual';
    const currentQty = isWeight ? (s.quantity_grams ?? 0) : (s.quantity_units ?? 0);
    const threshold = isWeight ? (s.safety_threshold_grams ?? 0) : (s.safety_threshold_units ?? 0);
    return currentQty <= threshold;
  });

  if (lowStockItems.length === 0) {
    return (
      <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <PackageCheck size={16} />
          <span>Stock Levels Optimal</span>
        </div>
        <p className="text-text-muted text-xs">
          All inventory items currently exceed their low-stock thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation space-y-4">
      {/* Header */}
      <div className="border-b border-border-subtle pb-3">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
          <AlertTriangle className="text-amber-500" size={16} />
          <span>Purchasing Reminder: Low Stock Items</span>
        </h3>
        <p className="text-text-muted text-[11px] mt-0.5">
          These items are at or below their safety threshold and should be reordered.
        </p>
      </div>

      {/* Suggestions List - Plain Text List */}
      <ul className="space-y-1 text-xs max-h-96 overflow-y-auto pr-1 list-disc list-inside text-text-secondary">
        {lowStockItems.map(s => {
          const isWeight = s.unit_type === 'weight' || s.unit_type === 'live_dual';
          const unitStr = isWeight ? 'kg' : 'pcs';
          const currentQty = isWeight ? ((s.quantity_grams ?? 0) / 1000).toFixed(2) : (s.quantity_units ?? 0);
          
          return (
            <li key={s.product_variant_id}>
              <strong className="text-text-primary">{s.product_name}</strong> {s.variant_name !== s.product_name && `(${s.variant_name})`}
              <span className="text-text-muted ml-2 font-mono">
                [Current: {currentQty} {unitStr}]
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
