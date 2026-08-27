import React from 'react';
import { formatKeyLabel } from '../../../../billing/frontend/hooks/usePOSShortcutsStore';

interface KeyBindingRowProps {
  actionName: string;
  description: string;
  icon?: React.ReactNode;
  currentKey: string;
  isListening: boolean;
  onStartListening: () => void;
  onClear?: () => void;
  disabled?: boolean;
}

export const KeyBindingRow: React.FC<KeyBindingRowProps> = ({
  actionName,
  description,
  icon,
  currentKey,
  isListening,
  onStartListening,
  onClear,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-card/60 border border-border-subtle hover:border-text-muted/30 transition-all">
      <div className="flex items-center gap-3">
        {icon && <div className="text-text-muted">{icon}</div>}
        <div>
          <p className="text-xs font-bold text-text-primary">{actionName}</p>
          <p className="text-[10px] text-text-muted">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onStartListening}
          className={`min-w-[70px] px-3 py-1.5 rounded-lg border text-xs font-black font-mono shadow-sm transition-all text-center ${
            isListening
              ? 'bg-amber-500 text-white border-amber-500 animate-pulse'
              : 'bg-surface-panel text-text-primary border-border-subtle hover:border-brand-500'
          }`}
        >
          {isListening ? 'Press key…' : formatKeyLabel(currentKey) || 'Unassigned'}
        </button>

        {onClear && currentKey && !isListening && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-text-muted hover:text-rose-500 font-bold px-1.5 py-1"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
