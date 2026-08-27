import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 1,
  unit,
  disabled = false,
}) => {
  const handleDecrement = () => {
    if (disabled) return;
    const next = Math.max(min, Math.round((value - step) * 100) / 100);
    onChange(next);
  };

  const handleIncrement = () => {
    if (disabled) return;
    const next = Math.min(max, Math.round((value + step) * 100) / 100);
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    } else if (e.target.value === '') {
      onChange(min);
    }
  };

  return (
    <div
      className={`inline-flex items-center bg-surface-card border border-border-subtle rounded-xl p-1 ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={handleDecrement}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-panel hover:bg-surface-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Minus size={13} />
      </button>

      <div className="flex items-center px-2 min-w-[56px] justify-center">
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          className="w-14 text-center bg-transparent text-xs font-black font-mono text-text-primary focus:outline-none"
        />
        {unit && <span className="text-[10px] font-bold text-text-muted ml-0.5">{unit}</span>}
      </div>

      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={handleIncrement}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface-panel hover:bg-surface-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Plus size={13} />
      </button>
    </div>
  );
};
