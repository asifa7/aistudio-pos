import React from 'react';
import { Percent, Calculator } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const TaxCalculationPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const tax = draftConfig.tax;

  const gstEnabled = tax?.gstEnabled ?? true;
  const pricingMode = tax?.pricingMode ?? 'exclusive';
  const defaultRate = tax?.defaultGstPercent ?? 5;

  const sampleBasePrice = 300; // e.g. ₹300/kg
  let netPayable = sampleBasePrice;
  let taxAmount = 0;
  let baseCalculated = sampleBasePrice;

  if (gstEnabled) {
    if (pricingMode === 'exclusive') {
      taxAmount = Math.round((sampleBasePrice * defaultRate) / 100 * 100) / 100;
      netPayable = sampleBasePrice + taxAmount;
      baseCalculated = sampleBasePrice;
    } else {
      // Inclusive
      baseCalculated = Math.round((sampleBasePrice / (1 + defaultRate / 100)) * 100) / 100;
      taxAmount = Math.round((sampleBasePrice - baseCalculated) * 100) / 100;
      netPayable = sampleBasePrice;
    }
  }

  const cgst = Math.round((taxAmount / 2) * 100) / 100;
  const sgst = Math.round((taxAmount - cgst) * 100) / 100;

  return (
    <div className="w-full space-y-4">
      {/* Interactive Calculation Card */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Calculator size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Sample Calculation
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20 uppercase">
            {pricingMode} GST
          </span>
        </div>

        {/* Item Simulation */}
        <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-text-primary">1.000 kg Chicken Curry Cut</span>
            <span className="font-mono font-black text-text-primary">₹{sampleBasePrice.toFixed(2)}</span>
          </div>
          <p className="text-[10px] text-text-muted">
            Pricing mode: <strong className="text-text-secondary uppercase">{pricingMode}</strong> (GST {gstEnabled ? `${defaultRate}%` : 'Disabled'})
          </p>
        </div>

        {/* Breakdown details */}
        <div className="space-y-2 text-xs border-t border-border-subtle pt-3">
          <div className="flex justify-between text-text-muted">
            <span>Taxable Value (Base):</span>
            <span className="font-mono font-bold text-text-primary">₹{baseCalculated.toFixed(2)}</span>
          </div>

          {gstEnabled ? (
            <>
              <div className="flex justify-between text-text-muted">
                <span>CGST ({(defaultRate / 2).toFixed(1)}%):</span>
                <span className="font-mono font-bold text-text-primary">₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>SGST ({(defaultRate / 2).toFixed(1)}%):</span>
                <span className="font-mono font-bold text-text-primary">₹{sgst.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-amber-500 text-[11px]">
              <span>Tax Exemption:</span>
              <span className="font-bold font-mono">₹0.00</span>
            </div>
          )}

          <div className="flex justify-between text-sm font-black text-brand-500 border-t border-border-subtle pt-2">
            <span>Customer Final Total:</span>
            <span className="font-mono font-black text-base">₹{netPayable.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-surface-card/60 border border-border-subtle text-[11px] text-text-muted space-y-1">
        <p className="font-bold text-text-secondary flex items-center gap-1">
          <Percent size={12} className="text-brand-500" /> Active GST Slabs:
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1 font-mono">
          {(tax?.rates || [0, 5, 12, 18, 28]).map((r) => (
            <span
              key={r}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                r === defaultRate
                  ? 'bg-brand-500 text-white border-brand-500'
                  : 'bg-surface-panel text-text-secondary border-border-subtle'
              }`}
            >
              {r}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
