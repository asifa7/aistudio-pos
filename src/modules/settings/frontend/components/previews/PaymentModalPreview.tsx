import React from 'react';
import { Banknote, Smartphone, CreditCard, SplitSquareVertical, CheckCircle2 } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const PaymentModalPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const pay = draftConfig.payments;
  const enabled = pay?.enabledMethods || ['cash', 'upi', 'card', 'split'];
  const defaultMethod = pay?.defaultPaymentMethod || 'cash';

  const methodIcons: Record<string, { label: string; icon: React.ReactNode }> = {
    cash: { label: 'Cash Tender', icon: <Banknote size={15} /> },
    upi: { label: 'UPI / QR', icon: <Smartphone size={15} /> },
    card: { label: 'Card / POS', icon: <CreditCard size={15} /> },
    split: { label: 'Split Tender', icon: <SplitSquareVertical size={15} /> },
    credit: { label: 'Store Credit / AR', icon: <CheckCircle2 size={15} /> },
    bank_transfer: { label: 'Bank Transfer', icon: <CreditCard size={15} /> },
  };

  return (
    <div className="w-full space-y-4">
      {/* Interactive Payment Dialog Mockup */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
            Checkout Tender Dialog
          </h4>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            DUE: ₹450.00
          </span>
        </div>

        {/* Enabled Methods Grid */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-text-muted uppercase">Select Payment Mode:</p>
          <div className="grid grid-cols-2 gap-2">
            {enabled.map((methodKey) => {
              const info = methodIcons[methodKey] || { label: methodKey, icon: <Banknote size={15} /> };
              const isDefault = defaultMethod === methodKey;
              return (
                <div
                  key={methodKey}
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all ${
                    isDefault
                      ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                      : 'bg-surface-panel text-text-secondary border-border-subtle'
                  }`}
                >
                  <span className="flex-shrink-0">{info.icon}</span>
                  <span className="truncate">{info.label}</span>
                  {isDefault && <span className="text-[9px] ml-auto uppercase bg-white/20 px-1 rounded font-mono">DEF</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Fast Cash Stepper Preview */}
        <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle space-y-2">
          <p className="text-[10px] font-bold text-text-muted uppercase">Quick Tender Buttons:</p>
          <div className="grid grid-cols-4 gap-1.5 font-mono text-xs font-black">
            <button type="button" className="p-2 rounded-lg bg-surface-card border border-border-subtle text-text-primary text-center">₹450</button>
            <button type="button" className="p-2 rounded-lg bg-surface-card border border-border-subtle text-text-primary text-center">₹500</button>
            <button type="button" className="p-2 rounded-lg bg-surface-card border border-border-subtle text-text-primary text-center">₹1000</button>
            <button type="button" className="p-2 rounded-lg bg-surface-card border border-border-subtle text-text-primary text-center">₹2000</button>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        {pay?.allowSplit ? '✓ Split payments enabled' : '✕ Split payments disabled'} ·{' '}
        {pay?.allowCredit ? '✓ Credit allowed' : '✕ Credit disabled'}
      </p>
    </div>
  );
};
