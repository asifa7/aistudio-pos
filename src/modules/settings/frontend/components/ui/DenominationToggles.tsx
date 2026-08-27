import React from 'react';

interface DenominationTogglesProps {
  denominations: number[];
  onChange: (denoms: number[]) => void;
  disabled?: boolean;
}

const ALL_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export const DenominationToggles: React.FC<DenominationTogglesProps> = ({
  denominations,
  onChange,
  disabled = false,
}) => {
  const toggleDenom = (denom: number) => {
    if (disabled) return;
    if (denominations.includes(denom)) {
      // Must keep at least one
      if (denominations.length <= 1) return;
      onChange(denominations.filter((d) => d !== denom));
    } else {
      onChange([...denominations, denom].sort((a, b) => b - a));
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ALL_DENOMINATIONS.map((d) => {
        const isActive = denominations.includes(d);
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => toggleDenom(d)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black font-mono border transition-all ${
              isActive
                ? 'bg-brand-500 text-white border-brand-500 shadow-sm'
                : 'bg-surface-card text-text-muted border-border-subtle hover:text-text-primary'
            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            ₹{d}
          </button>
        );
      })}
    </div>
  );
};
