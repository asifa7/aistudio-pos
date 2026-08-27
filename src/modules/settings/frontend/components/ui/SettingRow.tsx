import React from 'react';

interface SettingRowProps {
  label: string;
  description?: string;
  badge?: string;
  badgeVariant?: 'default' | 'brand' | 'warning' | 'info';
  children: React.ReactNode;
  align?: 'center' | 'start';
  className?: string;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  badge,
  badgeVariant = 'default',
  children,
  align = 'center',
  className = '',
}) => {
  const badgeClasses = {
    default: 'bg-surface-card text-text-muted border-border-subtle',
    brand: 'bg-brand-500/10 text-brand-500 border-brand-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-${align} justify-between gap-4 py-3.5 border-b border-border-subtle/50 last:border-b-0 ${className}`}
    >
      <div className="space-y-1 flex-1 pr-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-text-primary tracking-tight">{label}</label>
          {badge && (
            <span
              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider font-mono ${badgeClasses[badgeVariant]}`}
            >
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-text-muted leading-relaxed font-normal">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center justify-end">{children}</div>
    </div>
  );
};
