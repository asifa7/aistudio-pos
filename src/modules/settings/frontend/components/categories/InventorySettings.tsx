import React from 'react';
import { Boxes, AlertTriangle, Scale } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { SwitchControl } from '../ui/SwitchControl';
import { SegmentedControl } from '../ui/SegmentedControl';
import { NumberStepper } from '../ui/NumberStepper';
import { SelectControl } from '../ui/SelectControl';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const InventorySettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsDraftStore();
  const inv = draftConfig.inventory;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Stock Safeguards Card */}
      <SettingCard
        title="Stock Safeguards & Negative Selling"
        description="Safeguards to prevent checkout blockage while maintaining audit accuracy"
        icon={<Boxes size={16} />}
      >
        <SettingRow
          label="Enable Real-Time Inventory Tracking"
          description="Maintain real-time ledger entries on purchases, sales, and wastage"
        >
          <SwitchControl
            checked={inv?.trackingEnabled ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), trackingEnabled: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Allow Selling Past Zero Stock (Overselling)"
          description="Allows checkout without interruption during peak rush; automatically logs shortfall to oversold buffer"
          badge="SAFEGUARD"
        >
          <SwitchControl
            checked={inv?.allowNegativeStock ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), allowNegativeStock: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Alert on Low Stock"
          description="Display warning badges on product catalog tiles when quantity dips below threshold"
        >
          <SwitchControl
            checked={inv?.alertLowStock ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), alertLowStock: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Default Low Stock Threshold (kg/pcs)"
          description="Default quantity floor before low-stock alert triggers"
        >
          <NumberStepper
            value={inv?.defaultLowStockThreshold ?? 5}
            min={1}
            max={100}
            step={1}
            unit="kg"
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), defaultLowStockThreshold: val },
              }))
            }
          />
        </SettingRow>
      </SettingCard>

      {/* Valuation & Batch Management */}
      <SettingCard
        title="Valuation & Fresh Batch Tracking"
        description="Accounting valuation model and FIFO procurement queueing"
        icon={<Scale size={16} />}
      >
        <SettingRow
          label="Inventory Valuation Method"
          description="FIFO (First-In, First-Out) or Weighted Moving Average for Cost of Goods Sold (COGS)"
        >
          <SegmentedControl<'FIFO' | 'Weighted_Average'>
            value={inv?.valuationMethod || 'FIFO'}
            options={[
              { value: 'FIFO', label: 'FIFO (Perishable Batches)' },
              { value: 'Weighted_Average', label: 'Weighted Average' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), valuationMethod: val },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Batch & Procurement Lot Tracking"
          description="Track incoming supplier purchase lots, vehicle numbers, and live bird counts"
        >
          <SwitchControl
            checked={inv?.batchTracking ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), batchTracking: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Freshness & Expiry Alerts"
          description="Highlight batches approaching shelf-life limits in cold storage"
        >
          <SwitchControl
            checked={inv?.expiryTracking ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), expiryTracking: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Default Measurement Unit"
          description="Standard unit assigned when creating new catalog products"
        >
          <SelectControl
            value={inv?.defaultUnit || 'kg'}
            options={[
              { value: 'kg', label: 'Kilograms (kg)' },
              { value: 'g', label: 'Grams (g)' },
              { value: 'piece', label: 'Pieces (pcs)' },
              { value: 'pack', label: 'Packs (pkt)' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                inventory: { ...(prev.inventory || {}), defaultUnit: val as any },
              }))
            }
            className="w-72"
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
