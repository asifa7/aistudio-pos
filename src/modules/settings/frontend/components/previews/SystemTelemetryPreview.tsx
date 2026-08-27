import React from 'react';
import { ShieldCheck, Database } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const SystemTelemetryPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();

  return (
    <div className="w-full space-y-4">
      {/* System Telemetry Mockup */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Database & Storage
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            HEALTHY
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">Storage Engine:</span>
              <span className="font-bold font-mono text-text-primary">SQLite 3 (WAL Mode)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Target Environment:</span>
              <span className="font-bold text-text-primary uppercase font-mono">{draftConfig.env}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Auto-Backup on Close:</span>
              <span className="font-bold text-emerald-500">
                {draftConfig.backup?.autoBackupOnClose ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Max Retained Backups:</span>
              <span className="font-bold font-mono text-text-primary">
                {draftConfig.backup?.maxBackupsToKeep || 7} snapshots
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500" />
            <div>
              <p className="font-bold text-text-primary">WAL Journal Mode</p>
              <p className="text-[10px] text-text-muted">Atomic crash safety & zero data loss</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-500">ACTIVE</span>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Automatic rolling database snapshots and one-click data migration exports.
      </p>
    </div>
  );
};
