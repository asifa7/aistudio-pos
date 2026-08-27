import React from 'react';
import { Drumstick } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const YieldCalculatorPreview: React.FC = () => {
  const { draftYieldRatios } = useSettingsDraftStore();
  const wholeRatio = draftYieldRatios.chickenWholeRatio || 1.60;
  const bonelessRatio = draftYieldRatios.chickenBonelessRatio || 1.90;
  const goatPercent = draftYieldRatios.goatLiveToDressedPercent || 58.0;

  // Simulation: If shop sells 10 kg dressed meat
  const wholeLiveKg = Math.round(10 * wholeRatio * 10) / 10;
  const bonelessLiveKg = Math.round(10 * bonelessRatio * 10) / 10;
  const goatDressedFrom20kg = Math.round(20 * (goatPercent / 100) * 10) / 10;

  return (
    <div className="w-full space-y-4">
      {/* Live Ratio Simulation Card */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Drumstick size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Yield Estimation Model
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
            SIMULATION
          </span>
        </div>

        {/* Live Chicken Model */}
        <div className="p-3.5 rounded-xl bg-surface-panel border border-border-subtle space-y-2">
          <p className="text-xs font-bold text-text-primary flex items-center justify-between">
            <span>Chicken Whole Cut (Ratio {wholeRatio.toFixed(2)})</span>
          </p>
          <div className="flex justify-between text-xs text-text-muted">
            <span>For 10.0 kg Dressed Meat:</span>
            <span className="font-mono font-bold text-brand-500">~{wholeLiveKg} kg Live Bird</span>
          </div>
        </div>

        {/* Boneless Chicken Model */}
        <div className="p-3.5 rounded-xl bg-surface-panel border border-border-subtle space-y-2">
          <p className="text-xs font-bold text-text-primary flex items-center justify-between">
            <span>Chicken Boneless (Ratio {bonelessRatio.toFixed(2)})</span>
          </p>
          <div className="flex justify-between text-xs text-text-muted">
            <span>For 10.0 kg Boneless Meat:</span>
            <span className="font-mono font-bold text-brand-500">~{bonelessLiveKg} kg Live Bird</span>
          </div>
        </div>

        {/* Goat Mutton Model */}
        <div className="p-3.5 rounded-xl bg-surface-panel border border-border-subtle space-y-2">
          <p className="text-xs font-bold text-text-primary flex items-center justify-between">
            <span>Goat / Mutton Dressed Yield ({goatPercent.toFixed(1)}%)</span>
          </p>
          <div className="flex justify-between text-xs text-text-muted">
            <span>From a 20.0 kg Live Goat:</span>
            <span className="font-mono font-bold text-brand-500">~{goatDressedFrom20kg} kg Meat Carcass</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Ratios automatically calculate procurement weight conversions and wastage percentages in the Yield Processing workspace.
      </p>
    </div>
  );
};
