import React from 'react';
import { Check } from 'lucide-react';
import { ACCENT_COLORS, AccentColorId } from '../../../../../core/theme/palette';

interface AccentSwatchPickerProps {
  selectedColor: AccentColorId;
  onChange: (colorId: AccentColorId) => void;
  disabled?: boolean;
}

export const AccentSwatchPicker: React.FC<AccentSwatchPickerProps> = ({
  selectedColor,
  onChange,
  disabled = false,
}) => {
  return (
    <div
      role="radiogroup"
      aria-label="Select POS Accent Color"
      className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 w-full"
    >
      {ACCENT_COLORS.map((color: any) => {
        const isSelected = color.id === selectedColor;
        return (
          <button
            key={color.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={color.name}
            disabled={disabled}
            onClick={() => onChange(color.id)}
            className={`group relative flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
              isSelected
                ? 'bg-surface-panel border-brand-500 ring-2 ring-brand-500/20 shadow-sm'
                : 'bg-surface-card/60 border-border-subtle hover:border-text-muted/40 hover:bg-surface-card'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {/* Color Swatch Circle */}
            <div
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center shadow-inner transition-transform group-hover:scale-105"
              style={{ backgroundColor: color.hex }}
            >
              {isSelected && <Check size={13} className="text-white drop-shadow-md stroke-[3]" />}
            </div>

            {/* Color Details */}
            <div className="min-w-0 flex-1">
              <p
                className={`text-[11px] font-bold truncate leading-tight ${
                  isSelected ? 'text-brand-500' : 'text-text-primary'
                }`}
              >
                {color.name}
              </p>
              <p className="text-[9px] font-mono text-text-muted truncate uppercase tracking-tight">
                {color.hex}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
