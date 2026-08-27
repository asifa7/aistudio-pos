import React from 'react';
import { Check, X } from 'lucide-react';

export interface PermissionDefinition {
  key: string;
  name: string;
  category: string;
  description: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'create_bill', name: 'Create Invoices / Checkout', category: 'Billing', description: 'Can add items to cart and complete checkout' },
  { key: 'cancel_bill', name: 'Void / Cancel Invoice', category: 'Billing', description: 'Can cancel completed bills' },
  { key: 'refund', name: 'Process Sales Returns & Refunds', category: 'Billing', description: 'Can issue cash/credit refunds for returned meat items' },
  { key: 'apply_discount', name: 'Apply Manual Discounts', category: 'Billing', description: 'Can enter line item or bill percentage discount' },
  { key: 'change_selling_price', name: 'Override Selling Price', category: 'Billing', description: 'Can alter rate per kg on the fly' },
  { key: 'edit_inventory', name: 'Stock Adjustment & Wastage', category: 'Inventory', description: 'Can record stock corrections, write-offs and bird cuts' },
  { key: 'create_purchase', name: 'Procurement / Inward Stock', category: 'Inventory', description: 'Can record livestock and meat supplier purchases' },
  { key: 'create_expense', name: 'Cash Box Movements & Expenses', category: 'Finance', description: 'Can record cash deposits and petty expenses' },
  { key: 'modify_cashbox', name: 'Cash Box Reconciliation & Shift Close', category: 'Finance', description: 'Can close shift sessions and reconcile denominations' },
  { key: 'view_reports', name: 'View Sales & Profit Reports', category: 'Reports', description: 'Can access financial and margin reports' },
  { key: 'change_settings', name: 'Change POS Settings', category: 'System', description: 'Can alter store profile, printer, and tax rules' },
];

interface PermissionMatrixProps {
  permissions: Record<string, Record<string, boolean>>;
  onToggle: (role: string, permissionKey: string, allowed: boolean) => void;
  disabled?: boolean;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  permissions,
  onToggle,
  disabled = false,
}) => {
  const roles = ['ADMIN', 'MANAGER', 'CASHIER'];

  return (
    <div className="w-full overflow-hidden border border-border-subtle rounded-xl bg-surface-card">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-surface-panel border-b border-border-subtle text-[11px] font-black uppercase text-text-muted">
            <th className="p-3 pl-4">Permission</th>
            <th className="p-3 hidden sm:table-cell">Area</th>
            {roles.map((r) => (
              <th key={r} className="p-3 text-center w-24">
                <span className="font-mono">{r}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle/50 text-xs">
          {PERMISSION_DEFINITIONS.map((perm) => (
            <tr key={perm.key} className="hover:bg-surface-hover/40 transition-colors">
              <td className="p-3 pl-4">
                <p className="font-bold text-text-primary">{perm.name}</p>
                <p className="text-[10px] text-text-muted leading-tight">{perm.description}</p>
              </td>
              <td className="p-3 hidden sm:table-cell text-[10px] font-bold text-text-muted uppercase">
                {perm.category}
              </td>
              {roles.map((role) => {
                const isAllowed = permissions[role]?.[perm.key] ?? false;
                const isAdmin = role === 'ADMIN';
                return (
                  <td key={role} className="p-3 text-center">
                    <button
                      type="button"
                      disabled={disabled || isAdmin}
                      onClick={() => !isAdmin && onToggle(role, perm.key, !isAllowed)}
                      className={`w-7 h-7 inline-flex items-center justify-center rounded-lg border transition-all ${
                        isAllowed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-500 opacity-60'
                      } ${isAdmin ? 'cursor-default opacity-90' : 'cursor-pointer hover:scale-105'}`}
                    >
                      {isAllowed ? <Check size={14} className="stroke-[3]" /> : <X size={14} className="stroke-[3]" />}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
