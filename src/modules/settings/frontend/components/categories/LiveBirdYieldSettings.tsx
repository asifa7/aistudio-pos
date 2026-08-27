import React from 'react';
import { Drumstick, Sparkles } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { NumberStepper } from '../ui/NumberStepper';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const LiveBirdYieldSettings: React.FC = () => {
  const { draftYieldRatios, updateDraftYieldRatios } = useSettingsDraftStore();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Poultry Ratios */}
      <SettingCard
        title="Chicken Carcass & Boneless Yield Ratios"
        description="Standard live weight conversion ratios for processing whole cuts and boneless fillets"
        icon={<Drumstick size={16} />}
      >
        <SettingRow
          label="Whole Chicken Ratio (Live kg / 1 kg Dressed)"
          description="Default: 1.60 (e.g. 1.60 kg live bird yields ~1.00 kg whole dressed meat)"
        >
          <NumberStepper
            value={draftYieldRatios.chickenWholeRatio}
            min={1.0}
            max={3.5}
            step={0.05}
            unit="x"
            onChange={(val) =>
              updateDraftYieldRatios((prev) => ({
                ...prev,
                chickenWholeRatio: val,
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Boneless Chicken Ratio (Live kg / 1 kg Boneless)"
          description="Default: 1.90 (e.g. 1.90 kg live bird yields ~1.00 kg breast & thigh boneless meat)"
        >
          <NumberStepper
            value={draftYieldRatios.chickenBonelessRatio}
            min={1.0}
            max={4.5}
            step={0.05}
            unit="x"
            onChange={(val) =>
              updateDraftYieldRatios((prev) => ({
                ...prev,
                chickenBonelessRatio: val,
              }))
            }
          />
        </SettingRow>
      </SettingCard>

      {/* Goat / Mutton Yield */}
      <SettingCard
        title="Goat / Mutton Live to Dressed Meat Yield"
        description="Carcass meat recovery percentage from live animal procurement"
        icon={<Sparkles size={16} />}
      >
        <SettingRow
          label="Live-to-Dressed Meat Yield Percentage (%)"
          description="Default: 58.0% (Average dressed meat carcass yield from live animal weight)"
        >
          <NumberStepper
            value={draftYieldRatios.goatLiveToDressedPercent}
            min={30.0}
            max={90.0}
            step={0.5}
            unit="%"
            onChange={(val) =>
              updateDraftYieldRatios((prev) => ({
                ...prev,
                goatLiveToDressedPercent: val,
              }))
            }
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
