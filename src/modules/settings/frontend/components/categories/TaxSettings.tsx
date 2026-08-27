import React from 'react';
import { Percent } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { SwitchControl } from '../ui/SwitchControl';
import { SegmentedControl } from '../ui/SegmentedControl';
import { SelectControl } from '../ui/SelectControl';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const TaxSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsDraftStore();
  const tax = draftConfig.tax;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* GST Master Switch */}
      <SettingCard
        title="Tax Engine Rules"
        description="Configure tax calculations, rate slabs, and invoice breakdowns"
        icon={<Percent size={16} />}
      >
        <SettingRow
          label="Enable GST Calculations"
          description="Master toggle for applying tax computation to billed items"
        >
          <SwitchControl
            checked={tax?.gstEnabled ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                tax: { ...(prev.tax || {}), gstEnabled: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Catalog Price Calculation Mode"
          description="Inclusive (tax already baked into sticker rate) or Exclusive (tax added on checkout total)"
        >
          <SegmentedControl<'inclusive' | 'exclusive'>
            value={tax?.pricingMode || 'exclusive'}
            disabled={!tax?.gstEnabled}
            options={[
              { value: 'inclusive', label: 'Tax Inclusive (MRP)' },
              { value: 'exclusive', label: 'Tax Exclusive (+GST)' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                tax: { ...(prev.tax || {}), pricingMode: val },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Default GST Tax Slab"
          description="Standard rate applied when adding new products or cuts"
        >
          <SelectControl
            value={tax?.defaultGstPercent ?? 5}
            disabled={!tax?.gstEnabled}
            options={[
              { value: 0, label: '0% (Exempt Fresh Meat)' },
              { value: 5, label: '5% (Standard Processed Meat)' },
              { value: 12, label: '12% (Packaged / Cured Meat)' },
              { value: 18, label: '18% (Value-Added / Ready-to-Eat)' },
              { value: 28, label: '28% (Luxury / Special Goods)' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                tax: { ...(prev.tax || {}), defaultGstPercent: Number(val) },
              }))
            }
            className="w-72"
          />
        </SettingRow>

        <SettingRow
          label="Tax Rounding Strategy"
          description="Rounding rule applied to paise decimal totals"
        >
          <SegmentedControl<'none' | 'nearest' | 'up' | 'down'>
            value={tax?.taxRounding || 'nearest'}
            disabled={!tax?.gstEnabled}
            options={[
              { value: 'nearest', label: 'Nearest ₹' },
              { value: 'up', label: 'Always Up' },
              { value: 'down', label: 'Always Down' },
              { value: 'none', label: 'Exact Paise' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                tax: { ...(prev.tax || {}), taxRounding: val },
              }))
            }
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
