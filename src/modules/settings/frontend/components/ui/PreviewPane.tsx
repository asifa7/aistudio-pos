import React from 'react';
import { Eye } from 'lucide-react';

interface PreviewPaneProps {
  title?: string;
  badge?: string;
  children: React.ReactNode;
  footerNote?: string;
}

export const PreviewPane: React.FC<PreviewPaneProps> = ({
  title = 'Live Preview',
  badge = 'REAL-TIME',
  children,
  footerNote,
}) => {
  return (
    <aside
      aria-label="Live Setting Preview"
      className="w-96 xl:w-[420px] h-full bg-surface-panel border-l border-border-subtle flex flex-col flex-shrink-0 select-none overflow-hidden"
    >
      {/* Preview Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between flex-shrink-0 bg-surface-card/30">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-brand-500" />
          <span className="text-xs font-black font-outfit uppercase tracking-wider text-text-primary">
            {title}
          </span>
        </div>
        {badge && (
          <span className="text-[9px] font-black font-mono uppercase px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
            {badge}
          </span>
        )}
      </div>

      {/* Preview Interactive Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col items-center justify-start">
        <div className="w-full">{children}</div>
      </div>

      {/* Footer Note */}
      {footerNote && (
        <div className="px-4 py-2.5 bg-surface-card/40 border-t border-border-subtle flex-shrink-0 text-center">
          <p className="text-[10px] text-text-muted">{footerNote}</p>
        </div>
      )}
    </aside>
  );
};
