import React from 'react';
import { Keyboard, Zap } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';
import { formatKeyLabel } from '../../../../billing/frontend/hooks/usePOSShortcutsStore';

export const KeyboardVisualizerPreview: React.FC = () => {
  const { draftShortcuts } = useSettingsDraftStore();

  const keymaps = [
    { label: 'Instant Pay', key: draftShortcuts.checkout, desc: 'Trigger checkout modal' },
    { label: 'Cash Tender', key: draftShortcuts.cash, desc: 'Quick cash settlement' },
    { label: 'UPI / Digital', key: draftShortcuts.upi, desc: 'Quick UPI QR modal' },
    { label: 'Card Payment', key: draftShortcuts.card, desc: 'Credit/Debit swipe' },
    { label: 'Split Tender', key: draftShortcuts.split, desc: 'Multi-tender payment' },
    { label: 'Store Credit', key: draftShortcuts.credit, desc: 'Record khata sale' },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Keyboard Matrix Preview */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Active Keycap Map
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
            RAPID CHECKOUT
          </span>
        </div>

        {/* Keycaps Grid */}
        <div className="grid grid-cols-2 gap-2">
          {keymaps.map((km) => (
            <div
              key={km.label}
              className="p-2.5 rounded-xl bg-surface-panel border border-border-subtle flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary">{km.label}</span>
                <kbd className="px-2 py-0.5 rounded bg-surface-card border border-border-subtle text-[11px] font-mono font-black text-brand-500 shadow-sm">
                  {formatKeyLabel(km.key) || '—'}
                </kbd>
              </div>
              <p className="text-[9px] text-text-muted mt-1 leading-tight">{km.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-surface-card/60 border border-border-subtle text-[11px] text-text-muted flex items-center gap-2">
        <Zap size={14} className="text-amber-500 flex-shrink-0" />
        <span>Shortcuts function globally across the billing register screen.</span>
      </div>
    </div>
  );
};
