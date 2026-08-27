import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface SelectControlProps<T extends string | number = string> {
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function SelectControl<T extends string | number = string>({
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  id,
}: SelectControlProps<T>) {
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const val = typeof value === 'number' ? Number(e.target.value) : e.target.value;
          onChange(val as T);
        }}
        className="appearance-none bg-surface-card border border-border-subtle rounded-xl px-3.5 py-2 pr-9 text-xs font-bold text-text-primary focus:outline-none focus:border-brand-500 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value} className="bg-surface-panel text-text-primary">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );
}
