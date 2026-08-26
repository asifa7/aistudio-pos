import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  RotateCcw,
  Check,
  AlertCircle,
  Banknote,
  Smartphone,
  CreditCard,
  SplitSquareVertical,
  Shield,
  Zap,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
  usePOSShortcutsStore,
  DEFAULT_POS_SHORTCUTS,
  formatKeyLabel,
  isKeyMatch,
  type POSShortcuts,
} from '../../../billing/frontend/hooks/usePOSShortcutsStore';
import { useBillingSettingsStore } from '../../../billing/frontend/hooks/useBillingSettingsStore';

interface ShortcutRowConfig {
  id: keyof POSShortcuts;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
}

export default function POSShortcutSettings() {
  const { shortcuts, updateShortcut, resetShortcuts } = usePOSShortcutsStore();
  const {
    skipPaymentConfirmation,
    setSkipPaymentConfirmation,
  } = useBillingSettingsStore();

  const [activeListeningAction, setActiveListeningAction] = useState<keyof POSShortcuts | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [lastTestedKey, setLastTestedKey] = useState<string | null>(null);
  const [lastTestedAction, setLastTestedAction] = useState<string | null>(null);

  // Define the payment methods list
  const paymentMethodRows: ShortcutRowConfig[] = [
    {
      id: 'cash',
      name: 'Cash Payment',
      description: 'Selects cash mode and triggers fast tender checkout',
      icon: <Banknote size={18} className="text-emerald-500" />,
      iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      id: 'upi',
      name: 'UPI / Digital Payment',
      description: 'Selects UPI QR / PhonePe / GPay transaction mode',
      icon: <Smartphone size={18} className="text-blue-500" />,
      iconBg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      id: 'card',
      name: 'Card / POS Machine',
      description: 'Selects debit / credit card EDC machine payment',
      icon: <CreditCard size={18} className="text-purple-500" />,
      iconBg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      id: 'split',
      name: 'Split Payment',
      description: 'Opens multi-tender payment breakdown modal',
      icon: <SplitSquareVertical size={18} className="text-amber-500" />,
      iconBg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 'credit',
      name: 'Credit (Customer Ledger)',
      description: 'Adds balance to registered customer credit account',
      icon: <Shield size={18} className="text-indigo-500" />,
      iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    },
  ];

  // Key Recording Listener
  useEffect(() => {
    if (!activeListeningAction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      let capturedKey = e.key;

      if (e.code === 'Space' || capturedKey === ' ') {
        capturedKey = 'Space';
      } else if (capturedKey === 'Escape') {
        setActiveListeningAction(null);
        return;
      } else if (capturedKey === 'Enter') {
        capturedKey = 'Enter';
      } else if (capturedKey === 'Tab') {
        capturedKey = 'Tab';
      } else if (capturedKey.length === 1) {
        capturedKey = capturedKey.toLowerCase();
      }

      updateShortcut(activeListeningAction, capturedKey);
      setActiveListeningAction(null);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeListeningAction, updateShortcut]);

  // Test Area Key Listener
  const handleTestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pressed = e.key;
    setLastTestedKey(pressed === ' ' ? 'Space' : pressed);

    // Identify which action matched
    const mockEvent = {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
    } as KeyboardEvent;

    let matched: string | null = null;
    if (isKeyMatch(mockEvent, shortcuts.checkout)) {
      matched = 'Quick Checkout & Print Bill';
    } else if (isKeyMatch(mockEvent, shortcuts.cash)) {
      matched = 'Cash Payment';
    } else if (isKeyMatch(mockEvent, shortcuts.upi)) {
      matched = 'UPI Payment';
    } else if (isKeyMatch(mockEvent, shortcuts.card)) {
      matched = 'Card Payment';
    } else if (isKeyMatch(mockEvent, shortcuts.split)) {
      matched = 'Split Payment';
    } else if (isKeyMatch(mockEvent, shortcuts.credit)) {
      matched = 'Credit Account';
    }

    setLastTestedAction(matched);
  };

  // Find duplicate shortcuts
  const keyUsages: Record<string, string[]> = {};
  Object.entries(shortcuts).forEach(([action, key]) => {
    const norm = (key || '').toLowerCase();
    if (!keyUsages[norm]) keyUsages[norm] = [];
    keyUsages[norm].push(action);
  });
  const conflicts = Object.entries(keyUsages).filter(([_, actions]) => actions.length > 1);

  const handleReset = () => {
    resetShortcuts();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="bg-surface-app text-text-primary h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle pb-4 gap-3">
        <div>
          <h2 className="text-2xl font-black font-outfit text-text-primary flex items-center gap-2">
            <Keyboard className="text-brand-500" size={24} />
            <span>POS Keyboard Shortcuts & Hotkeys</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">
            Customize single-key shortcuts for instant payment selection, billing speed, and the quick print key.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedToast && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold animate-fade-in">
              <Check size={14} /> Saved & Applied Live!
            </div>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 hover:text-text-primary"
            title="Reset all keys to default settings (Space, C, V, B, N, R)"
          >
            <RotateCcw size={13} /> Reset to Defaults
          </button>
        </div>
      </div>

      {/* Duplicate Warning if any */}
      {conflicts.length > 0 && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>
            Duplicate shortcut detected: Key &quot;{conflicts[0][0].toUpperCase()}&quot; is assigned to multiple actions ({conflicts[0][1].join(', ')}). Consider setting unique keys for each action.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Primary Key Settings */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. Main Action: Quick Checkout & Bill Print Key (Spacebar) */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-elevation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">
                    Quick Checkout & Bill Print Key
                  </h3>
                  <p className="text-text-muted text-xs mt-0.5">
                    The single primary key to instant-print or jump to checkout on the billing screen
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/30 uppercase">
                Primary Hotkey
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface-card border border-border-subtle rounded-xl">
              <div>
                <p className="text-xs font-extrabold text-text-primary">Current Checkout Key</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Default is <span className="font-mono font-bold text-text-primary">Spacebar</span>. You can change it to <span className="font-mono font-bold text-text-primary">Enter</span>, <span className="font-mono font-bold text-text-primary">F9</span>, or any custom key.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {activeListeningAction === 'checkout' ? (
                  <div className="px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-black animate-pulse flex items-center gap-2 shadow-elevation">
                    <span>Press any key now...</span>
                    <span className="text-[10px] opacity-80">(Esc to cancel)</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveListeningAction('checkout')}
                    className="group px-5 py-2.5 bg-surface-panel hover:bg-surface-hover border-2 border-brand-500/40 hover:border-brand-500 rounded-xl transition-all flex items-center gap-3 shadow-subtle"
                  >
                    <span className="text-xs font-bold text-text-secondary group-hover:text-text-primary">Assigned:</span>
                    <kbd className="px-3 py-1 bg-surface-card border border-border-subtle rounded-lg font-mono font-black text-sm text-brand-500 group-hover:scale-105 transition-transform shadow-sm min-w-[50px] text-center">
                      {formatKeyLabel(shortcuts.checkout)}
                    </kbd>
                    <span className="text-[11px] font-bold text-brand-500 underline ml-1">Change</span>
                  </button>
                )}
              </div>
            </div>

            {/* Print speed toggle */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3 bg-surface-card border border-border-subtle rounded-xl cursor-pointer hover:bg-surface-hover transition-colors">
                <input
                  type="checkbox"
                  id="skipPaymentConfToggle"
                  checked={skipPaymentConfirmation}
                  onChange={(e) => setSkipPaymentConfirmation(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-brand-500 focus:ring-brand-500 accent-brand-500 cursor-pointer"
                />
                <div className="space-y-0.5 select-none">
                  <span className="text-xs font-black text-text-primary block">
                    Instant Print Mode (Print without confirming payment dialog)
                  </span>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    When enabled, pressing <kbd className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-surface-panel border border-border-subtle font-bold text-brand-500">{formatKeyLabel(shortcuts.checkout)}</kbd> immediately prints the bill in 1 touch using default cash/card.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Payment Method Shortcuts Table */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-6 shadow-elevation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                  <Zap size={16} className="text-amber-400" />
                  <span>Payment Method Direct Shortcuts</span>
                </h3>
                <p className="text-text-muted text-xs mt-0.5">
                  Single-key hotkeys on the billing cart to select or process payment methods
                </p>
              </div>
              <span className="text-[10px] text-text-muted">Click any key to remap</span>
            </div>

            <div className="space-y-2.5">
              {paymentMethodRows.map((row) => {
                const assignedKey = shortcuts[row.id];
                const isListening = activeListeningAction === row.id;
                const isDefault = assignedKey.toLowerCase() === DEFAULT_POS_SHORTCUTS[row.id].toLowerCase();

                return (
                  <div
                    key={row.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                      isListening
                        ? 'bg-brand-500/10 border-brand-500 shadow-elevation ring-2 ring-brand-500/30'
                        : 'bg-surface-card border-border-subtle hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border flex-shrink-0 ${row.iconBg}`}>
                        {row.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-text-primary">{row.name}</span>
                          {isDefault && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-surface-app text-text-muted border border-border-subtle">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">{row.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isListening ? (
                        <div className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-black animate-pulse flex items-center gap-1.5 shadow-sm">
                          <span>Press key...</span>
                          <span className="text-[9px] opacity-75">(Esc)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveListeningAction(row.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle hover:border-brand-500 rounded-lg transition-all text-xs group"
                          title={`Click to assign a new key for ${row.name}`}
                        >
                          <span className="text-[11px] font-bold text-text-muted group-hover:text-text-secondary">Key:</span>
                          <kbd className="px-2.5 py-0.5 bg-surface-card border border-border-subtle rounded font-mono font-black text-xs text-brand-500 group-hover:border-brand-500 group-hover:scale-105 transition-all min-w-[28px] text-center shadow-xs">
                            {formatKeyLabel(assignedKey)}
                          </kbd>
                          <span className="text-[10px] font-bold text-brand-500 underline ml-0.5">Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Live Interactive Test Box & Quick Reference */}
        <div className="lg:col-span-4 space-y-6">
          {/* Interactive Keyboard Test Pad */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-primary flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-500" />
                <span>Live Hotkey Test Pad</span>
              </h3>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Interactive
              </span>
            </div>

            <p className="text-[11px] text-text-muted leading-relaxed">
              Click inside this box and tap any key on your physical keyboard to verify your customized shortcuts work instantly:
            </p>

            <div className="space-y-3">
              <input
                type="text"
                readOnly
                placeholder="Click here and press a key..."
                onKeyDown={handleTestKeyDown}
                className="w-full bg-surface-card border-2 border-dashed border-border-subtle hover:border-brand-500 focus:border-brand-500 rounded-xl px-3 py-3 text-xs font-mono text-center text-text-primary outline-none cursor-pointer transition-colors placeholder:text-text-muted"
              />

              {lastTestedKey && (
                <div className="p-3 bg-surface-card border border-border-subtle rounded-xl text-center space-y-1 animate-fade-in">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] text-text-muted">Detected Key:</span>
                    <kbd className="px-2 py-0.5 bg-surface-panel border border-border-subtle rounded font-mono font-black text-xs text-text-primary">
                      {lastTestedKey}
                    </kbd>
                  </div>
                  {lastTestedAction ? (
                    <p className="text-xs font-black text-emerald-500 flex items-center justify-center gap-1 pt-1">
                      <Check size={14} /> Action: {lastTestedAction}
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-text-muted pt-1">
                      (No POS action assigned to this key)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Hotkey Cheat Sheet */}
          <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-3">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-primary border-b border-border-subtle pb-2 flex items-center gap-1.5">
              <span>Quick Reference Map</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-text-secondary font-medium">Complete & Print Bill</span>
                <kbd className="font-mono font-bold text-[10px] bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-brand-500">
                  {formatKeyLabel(shortcuts.checkout)}
                </kbd>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-text-secondary font-medium">Cash Payment</span>
                <kbd className="font-mono font-bold text-[10px] bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-emerald-500">
                  {formatKeyLabel(shortcuts.cash)}
                </kbd>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-text-secondary font-medium">UPI / Digital QR</span>
                <kbd className="font-mono font-bold text-[10px] bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-blue-500">
                  {formatKeyLabel(shortcuts.upi)}
                </kbd>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-text-secondary font-medium">Card / POS Swipe</span>
                <kbd className="font-mono font-bold text-[10px] bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-purple-500">
                  {formatKeyLabel(shortcuts.card)}
                </kbd>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-border-subtle/40">
                <span className="text-text-secondary font-medium">Split Multi-Payment</span>
                <kbd className="font-mono font-bold text-[10px] bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-amber-500">
                  {formatKeyLabel(shortcuts.split)}
                </kbd>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-text-secondary font-medium">Credit Account</span>
                <kbd className="font-mono font-bold text-[10px] bg-surface-card border border-border-subtle px-2 py-0.5 rounded text-indigo-500">
                  {formatKeyLabel(shortcuts.credit)}
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
