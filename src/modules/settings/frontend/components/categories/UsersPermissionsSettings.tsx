import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Shield } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { PermissionMatrix } from '../ui/PermissionMatrix';
import { TextField } from '../ui/TextField';
import { SelectControl } from '../ui/SelectControl';
import { IPC_CHANNELS } from '../../../../../core/ipc/channels';

export const UsersPermissionsSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER'>('CASHIER');
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Query Users
  const usersQuery = useQuery({
    queryKey: ['settings:users'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.SETTINGS.GET_USERS);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch users');
      return res.data || [];
    },
  });

  // 2. Query Permissions Matrix
  const permissionsQuery = useQuery({
    queryKey: ['settings:permissions'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.SETTINGS.GET_PERMISSIONS);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch permissions');
      return res.data || { ADMIN: {}, MANAGER: {}, CASHIER: {} };
    },
  });

  // 3. Update Permission Mutation
  const updatePermMutation = useMutation({
    mutationFn: async (payload: { role: string; permissionKey: string; allowed: boolean }) => {
      const res = await window.api.invoke(IPC_CHANNELS.SETTINGS.UPDATE_PERMISSION, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to update permission');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings:permissions'] });
    },
  });

  // 4. Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async (payload: { username: string; passwordPlain: string; role: 'ADMIN' | 'MANAGER' | 'CASHIER' }) => {
      const res = await window.api.invoke(IPC_CHANNELS.SETTINGS.SAVE_USER, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create user');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings:users'] });
      setShowAddModal(false);
      setNewUsername('');
      setNewPassword('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message);
    },
  });

  // 5. Toggle User Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (payload: { userId: number; isActive: number }) => {
      const res = await window.api.invoke(IPC_CHANNELS.SETTINGS.TOGGLE_USER_ACTIVE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to toggle user status');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings:users'] });
    },
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      setFormError('Please enter username and PIN/password');
      return;
    }
    createUserMutation.mutate({
      username: newUsername.trim(),
      passwordPlain: newPassword.trim(),
      role: newRole,
    });
  };

  const usersList = usersQuery.data || [];
  const permissionsData = permissionsQuery.data || { ADMIN: {}, MANAGER: {}, CASHIER: {} };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Users Directory Card */}
      <SettingCard
        title="Active POS Operators & Users"
        description="Cashier terminals, managers, and administrative accounts"
        icon={<Users size={16} />}
        headerAction={
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <UserPlus size={13} />
            <span>Add User</span>
          </button>
        }
      >
        {/* Users Table */}
        <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-card mt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-panel border-b border-border-subtle text-[10px] font-black uppercase text-text-muted">
                <th className="p-3 pl-4">Operator Code</th>
                <th className="p-3">Username</th>
                <th className="p-3">Role Tier</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 font-medium">
              {usersList.map((u: any) => (
                <tr key={u.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="p-3 pl-4 font-mono font-bold text-text-muted">{u.code}</td>
                  <td className="p-3 font-bold text-text-primary">{u.username}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono border ${
                        u.role === 'ADMIN'
                          ? 'bg-brand-500/10 text-brand-500 border-brand-500/20'
                          : u.role === 'MANAGER'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold ${
                        u.is_active ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {u.is_active ? '● Active' : '○ Disabled'}
                    </span>
                  </td>
                  <td className="p-3 text-right pr-4">
                    {u.role !== 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() =>
                          toggleActiveMutation.mutate({
                            userId: u.id,
                            isActive: u.is_active ? 0 : 1,
                          })
                        }
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          u.is_active
                            ? 'text-rose-400 border-rose-500/20 hover:bg-rose-500/10'
                            : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10'
                        }`}
                      >
                        {u.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingCard>

      {/* Role Permission Matrix Card */}
      <SettingCard
        title="Role Access Matrix & Security Policy"
        description="Fine-grained capability controls enforced across UI registers and Electron IPC handlers"
        icon={<Shield size={16} />}
      >
        <PermissionMatrix
          permissions={permissionsData}
          onToggle={(role, permissionKey, allowed) => {
            updatePermMutation.mutate({ role, permissionKey, allowed });
          }}
        />
      </SettingCard>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-black font-outfit text-text-primary flex items-center gap-2">
                <UserPlus size={16} className="text-brand-500" />
                <span>Create POS Operator</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-text-muted">Username / Cashier ID</label>
                <TextField
                  value={newUsername}
                  onChange={setNewUsername}
                  placeholder="e.g. cashier2 or rajesh"
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-text-muted">PIN / Password</label>
                <TextField
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="e.g. 1234"
                  className="w-full font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-text-muted">Role Tier</label>
                <SelectControl
                  value={newRole}
                  options={[
                    { value: 'CASHIER', label: 'CASHIER (Fast Billing)' },
                    { value: 'MANAGER', label: 'MANAGER (Overrides & Shifts)' },
                    { value: 'ADMIN', label: 'ADMIN (Full Access)' },
                  ]}
                  onChange={(val) => setNewRole(val as any)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-1.5 rounded-xl border border-border-subtle text-text-secondary text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary px-5 py-1.5 rounded-xl text-xs font-bold"
                >
                  {createUserMutation.isPending ? 'Saving...' : 'Create Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
