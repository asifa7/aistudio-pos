import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const ReturnsDialogPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const ret = draftConfig.returns;

  return (
    <div className="w-full space-y-4">
      {/* Return Dialog Simulation */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Sales Return Policy
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
            {ret?.returnsEnabled ? `${ret?.returnPeriodDays || 7} DAYS WINDOW` : 'RETURNS DISABLED'}
          </span>
        </div>

        {/* Dialog Summary */}
        <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle space-y-2 text-xs">
          <div className="flex justify-between items-center text-text-secondary">
            <span>Partial Item Return:</span>
            <span className="font-bold text-text-primary">{ret?.allowPartialReturn ? 'Allowed' : 'Disabled'}</span>
          </div>

          <div className="flex justify-between items-center text-text-secondary">
            <span>Item Replacement / Exchange:</span>
            <span className="font-bold text-text-primary">{ret?.allowExchange ? 'Allowed' : 'Disabled'}</span>
          </div>

          <div className="flex justify-between items-center text-text-secondary">
            <span>Mandatory Return Reason:</span>
            <span className="font-bold text-text-primary">{ret?.requireReturnReason ? 'Required' : 'Optional'}</span>
          </div>

          <div className="flex justify-between items-center text-text-secondary">
            <span>Auto Restock to Ledger:</span>
            <span className="font-bold text-emerald-500">{ret?.autoRestock ? 'Enabled' : 'Manual'}</span>
          </div>
        </div>

        {/* Refund Modes Active */}
        <div className="space-y-1.5 border-t border-border-subtle pt-3">
          <p className="text-[10px] font-bold text-text-muted uppercase">Allowed Refund Modes:</p>
          <div className="flex flex-wrap gap-1.5">
            {ret?.refundToOriginal && (
              <span className="px-2 py-0.5 rounded-lg bg-surface-panel border border-border-subtle text-[10px] font-bold text-text-primary">
                Original Tender
              </span>
            )}
            {ret?.cashRefund && (
              <span className="px-2 py-0.5 rounded-lg bg-surface-panel border border-border-subtle text-[10px] font-bold text-text-primary">
                Instant Cash
              </span>
            )}
            {ret?.storeCredit && (
              <span className="px-2 py-0.5 rounded-lg bg-surface-panel border border-border-subtle text-[10px] font-bold text-text-primary">
                Store Credit / AR
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Configures the return window and whether returned goods automatically reverse the inventory stock ledger.
      </p>
    </div>
  );
};
