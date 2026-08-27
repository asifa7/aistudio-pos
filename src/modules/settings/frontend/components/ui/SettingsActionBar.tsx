import React from 'react';
import { RotateCcw, Check, Save, AlertCircle, Loader2 } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

interface SettingsActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  onResetCategory: () => void;
  categoryLabel: string;
}

export const SettingsActionBar: React.FC<SettingsActionBarProps> = ({
  onSave,
  onCancel,
  onResetCategory,
  categoryLabel,
}) => {
  const { isDirty, saveStatus, errorMessage } = useSettingsDraftStore();

  return (
    <footer
      aria-label="Settings Actions"
      className="h-14 bg-surface-panel border-t border-border-subtle px-6 flex items-center justify-between flex-shrink-0 z-20 shadow-elevation"
    >
      {/* Left: Unsaved Changes Status Indicator */}
      <div className="flex items-center gap-2.5">
        {saveStatus === 'saving' ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-500 animate-pulse">
            <Loader2 size={15} className="animate-spin" />
            <span>Saving changes to disk...</span>
          </div>
        ) : saveStatus === 'saved' ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <Check size={15} className="stroke-[3]" />
            <span>All settings successfully saved!</span>
          </div>
        ) : saveStatus === 'error' ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
            <AlertCircle size={15} />
            <span>{errorMessage || 'Failed to save settings'}</span>
          </div>
        ) : isDirty ? (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs font-bold text-amber-500">
              Unsaved changes in draft
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-muted">
            <Check size={14} className="text-emerald-500" />
            <span>Configuration up to date</span>
          </div>
        )}
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onResetCategory}
          className="px-3.5 py-1.5 rounded-xl border border-border-subtle bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary text-xs font-bold transition-all flex items-center gap-1.5"
          title={`Reset ${categoryLabel} to default values`}
        >
          <RotateCcw size={13} />
          <span>Reset {categoryLabel}</span>
        </button>

        {isDirty && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-xl border border-border-subtle hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-400 text-xs font-bold transition-all"
          >
            Discard
          </button>
        )}

        <button
          type="button"
          disabled={!isDirty || saveStatus === 'saving'}
          onClick={onSave}
          className={`px-5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md ${
            isDirty
              ? 'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white cursor-pointer hover:scale-105'
              : 'bg-surface-card text-text-muted border border-border-subtle opacity-50 cursor-not-allowed'
          }`}
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
