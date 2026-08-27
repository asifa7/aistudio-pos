import React, { useState, useEffect } from 'react';
import { Zap, Banknote, Smartphone, CreditCard, SplitSquareVertical, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { KeyBindingRow } from '../ui/KeyBindingRow';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';
import { POSShortcuts } from '../../../../billing/frontend/hooks/usePOSShortcutsStore';

export const KeyboardShortcutsSettings: React.FC = () => {
  const { draftShortcuts, updateDraftShortcuts } = useSettingsDraftStore();
  const [listeningAction, setListeningAction] = useState<keyof POSShortcuts | null>(null);

  useEffect(() => {
    if (!listeningAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const combo: string[] = [];
      if (e.ctrlKey) combo.push('ctrl');
      if (e.altKey) combo.push('alt');
      if (e.shiftKey) combo.push('shift');
      combo.push(e.key === ' ' ? 'Space' : e.key.toLowerCase());

      const keyString = combo.join('+');

      updateDraftShortcuts((prev) => ({
        ...prev,
        [listeningAction]: keyString,
      }));

      setListeningAction(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [listeningAction, updateDraftShortcuts]);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Rapid Checkout Hotkeys */}
      <SettingCard
        title="Checkout & Payment Hotkeys"
        description="Single-key or modifier combinations to complete checkout in seconds"
        icon={<Zap size={16} />}
      >
        <div className="space-y-2">
          <KeyBindingRow
            actionName="Checkout / Tender Modal"
            description="Opens the tender settlement modal"
            icon={<ShoppingCart size={15} className="text-brand-500" />}
            currentKey={draftShortcuts.checkout}
            isListening={listeningAction === 'checkout'}
            onStartListening={() => setListeningAction('checkout')}
          />

          <KeyBindingRow
            actionName="Cash Tender Checkout"
            description="Selects cash mode and triggers fast checkout"
            icon={<Banknote size={15} className="text-emerald-500" />}
            currentKey={draftShortcuts.cash}
            isListening={listeningAction === 'cash'}
            onStartListening={() => setListeningAction('cash')}
          />

          <KeyBindingRow
            actionName="UPI / QR Code Checkout"
            description="Selects UPI QR code transaction mode"
            icon={<Smartphone size={15} className="text-blue-500" />}
            currentKey={draftShortcuts.upi}
            isListening={listeningAction === 'upi'}
            onStartListening={() => setListeningAction('upi')}
          />

          <KeyBindingRow
            actionName="Card Terminal Checkout"
            description="Selects card machine swipe transaction mode"
            icon={<CreditCard size={15} className="text-purple-500" />}
            currentKey={draftShortcuts.card}
            isListening={listeningAction === 'card'}
            onStartListening={() => setListeningAction('card')}
          />

          <KeyBindingRow
            actionName="Split Tender Mode"
            description="Opens split payment calculator dialog"
            icon={<SplitSquareVertical size={15} className="text-amber-500" />}
            currentKey={draftShortcuts.split}
            isListening={listeningAction === 'split'}
            onStartListening={() => setListeningAction('split')}
          />

          <KeyBindingRow
            actionName="Customer Credit / Khata (A/R)"
            description="Direct customer credit ledger billing"
            icon={<CheckCircle2 size={15} className="text-teal-500" />}
            currentKey={draftShortcuts.credit}
            isListening={listeningAction === 'credit'}
            onStartListening={() => setListeningAction('credit')}
          />
        </div>
      </SettingCard>
    </div>
  );
};
