import React from 'react';

interface SettingCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SettingCard: React.FC<SettingCardProps> = ({
  title,
  description,
  icon,
  headerAction,
  children,
  className = '',
}) => {
  return (
    <section
      className={`bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-sm space-y-3 ${className}`}
    >
      {(title || icon || headerAction) && (
        <div className="flex items-center justify-between border-b border-border-subtle/80 pb-3">
          <div className="flex items-center gap-2.5">
            {icon && <div className="text-brand-500 flex-shrink-0">{icon}</div>}
            <div>
              {title && <h3 className="text-xs font-black uppercase tracking-wider text-text-primary">{title}</h3>}
              {description && <p className="text-[10px] text-text-muted mt-0.5">{description}</p>}
            </div>
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </section>
  );
};
