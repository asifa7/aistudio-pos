import React from 'react';

interface TextAreaFieldProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const TextAreaField: React.FC<TextAreaFieldProps> = ({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled = false,
  className = '',
  id,
}) => {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full bg-surface-card border border-border-subtle rounded-xl p-3 text-xs font-medium text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-brand-500 transition-colors resize-none ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    />
  );
};
