import React from 'react';
import { Users, Shield, Key } from 'lucide-react';

export const RolePermissionsCardPreview: React.FC = () => {
  return (
    <div className="w-full space-y-4">
      {/* Role Hierarchy Mockup */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Role Access Hierarchy
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-500 border border-brand-500/20">
            3 TIERS
          </span>
        </div>

        {/* Roles Cards */}
        <div className="space-y-2.5">
          <div className="p-3 rounded-xl bg-surface-panel border border-brand-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-brand-500 flex items-center gap-1.5">
                <Shield size={14} /> ADMIN
              </span>
              <span className="text-[10px] font-mono bg-brand-500/10 text-brand-500 px-1.5 py-0.5 rounded">
                Full Access (11/11)
              </span>
            </div>
            <p className="text-[10px] text-text-muted">Master control over settings, users, voids, expenses, and ledger.</p>
          </div>

          <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                <Key size={14} className="text-amber-500" /> MANAGER
              </span>
              <span className="text-[10px] font-mono bg-surface-card text-text-secondary px-1.5 py-0.5 rounded">
                Operational (10/11)
              </span>
            </div>
            <p className="text-[10px] text-text-muted">Can approve price overrides, shifts, and review reports without system settings access.</p>
          </div>

          <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-text-primary flex items-center gap-1.5">
                <Users size={14} className="text-blue-500" /> CASHIER
              </span>
              <span className="text-[10px] font-mono bg-surface-card text-text-secondary px-1.5 py-0.5 rounded">
                Billing Only (2/11)
              </span>
            </div>
            <p className="text-[10px] text-text-muted">Fast checkout, weighing, and discounts. Restricted from voids and config.</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Permissions are enforced securely on both the React frontend and Electron IPC backend.
      </p>
    </div>
  );
};
