import React from 'react';
import { SettingsCategoryId } from '../../hooks/useSettingsDraftStore';

interface SettingsCategoryProps {
  id: SettingsCategoryId;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export const SettingsCategory: React.FC<SettingsCategoryProps> = ({
  id,
  title,
  description,
  icon,
  children,
}) => {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className="flex-1 h-full min-h-0 flex flex-col overflow-hidden"
    >
      {/* Category Header */}
      <div className="px-6 py-4 border-b border-border-subtle bg-surface-panel/40 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-500 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-black font-outfit text-text-primary tracking-tight">{title}</h2>
            <p className="text-[11px] text-text-muted">{description}</p>
          </div>
        </div>
      </div>

      {/* Internal Controls Scroll View */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 pb-16">
        {children}
      </div>
    </div>
  );
};
