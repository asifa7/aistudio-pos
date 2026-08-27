import React from 'react';
import { Banknote } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const CashBoxShiftPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const cash = draftConfig.cashbox;
  const denoms = cash?.denominationsEnabled || [500, 200, 100, 50, 20, 10, 5, 2, 1];

  return (
    <div className="w-full space-y-4">
      {/* Shift Drawer Preview Card */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Banknote size={16} className="text-emerald-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Shift Closing Count
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            ACTIVE SESSION
          </span>
        </div>

        {/* Enabled Denominations Grid Mockup */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-text-muted uppercase">
            Active Denominations ({denoms.length}):
          </p>
          <div className="grid grid-cols-3 gap-2">
            {denoms.map((d) => (
              <div
                key={d}
                className="p-2 rounded-xl bg-surface-panel border border-border-subtle flex flex-col items-center justify-center font-mono"
              >
                <span className="text-xs font-black text-text-primary">₹{d}</span>
                <span className="text-[10px] text-text-muted">× 0 = ₹0</span>
              </div>
            ))}
          </div>
        </div>

        {/* Safeguards Summary */}
        <div className="space-y-2 border-t border-border-subtle pt-3 text-xs">
          <div className="flex items-center justify-between text-text-secondary">
            <span>Opening Cash Required:</span>
            <span className="font-bold text-text-primary">{cash?.requireOpeningCash ? 'Yes' : 'No'}</span>
          </div>

          <div className="flex items-center justify-between text-text-secondary">
            <span>Discrepancy Threshold:</span>
            <span className="font-bold font-mono text-text-primary">
              ₹{((cash?.discrepancyThresholdPaise || 50000) / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-text-secondary">
            <span>Manager Approval:</span>
            <span className="font-bold text-text-primary">{cash?.managerApprovalRequired ? 'Enforced' : 'Disabled'}</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Protects the physical till with audit-logged cash movements and reconciliation checks.
      </p>
    </div>
  );
};
