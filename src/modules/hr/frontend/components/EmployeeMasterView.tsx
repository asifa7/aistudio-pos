import { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Sliders, 
  Edit, 
  UserCheck, 
  UserX, 
  Phone, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';
import { useEmployees, useToggleEmployeeActive } from '../hooks/useHR';
import type { Employee } from '../types/hr.types';
import EmployeeModal from './EmployeeModal';
import SalaryStructureModal from './SalaryStructureModal';
import EmployeeDashboard360Modal from './EmployeeDashboard360Modal';

export default function EmployeeMasterView({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('Active');

  const { data: rawEmployees = [], isLoading, isError, error, refetch } = useEmployees({
    search: searchTerm,
    department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    includeInactive: statusFilter === 'ALL' || statusFilter === 'Inactive',
  });

  const toggleActiveMutation = useToggleEmployeeActive();

  // Modals state
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<Employee | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEmployeeForSalary, setSelectedEmployeeForSalary] = useState<Employee | null>(null);
  const [selectedEmployeeFor360, setSelectedEmployeeFor360] = useState<Employee | null>(null);

  const employees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set);
  }, [employees]);

  const activeCount = employees.filter(e => e.is_active === 1).length;
  const inactiveCount = employees.filter(e => e.is_active === 0).length;

  const handleToggleActive = async (emp: Employee) => {
    const newActiveState = emp.is_active !== 1;
    const confirmText = newActiveState 
      ? `Reactivate employee ${emp.full_name}? They will reappear in active attendance and billing lists.`
      : `Deactivate employee ${emp.full_name}? They will be removed from attendance marking while preserving all historical records.`;
    
    if (window.confirm(confirmText)) {
      await toggleActiveMutation.mutateAsync({ id: emp.id, isActive: newActiveState });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID (EMP-00001), mobile, role..."
              className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 font-bold"
            />
          </div>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Departments</option>
            <option value="Operations">Operations</option>
            <option value="Processing">Processing</option>
            <option value="Sales">Sales</option>
            <option value="Management">Management</option>
            <option value="Logistics">Logistics</option>
            <option value="Sanitation">Sanitation</option>
            {departments.filter(d => !['Operations', 'Processing', 'Sales', 'Management', 'Logistics', 'Sanitation'].includes(d)).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="Active">Active Staff ({activeCount})</option>
            <option value="Inactive">Inactive ({inactiveCount})</option>
            <option value="ALL">All Employees ({employees.length})</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
            title="Refresh Employees"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <UserPlus size={14} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Employees Table (Matching Stock Levels Layout) */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading employee master records...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2 text-rose-400">
            <AlertTriangle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load employee list</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Employees Found</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Click &quot;Add Employee&quot; above to register your shop staff, cutters, and cashiers.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">EMPLOYEE / ID</th>
                  <th className="py-3 px-4">ROLE & DEPT</th>
                  <th className="py-3 px-4">CONTACT</th>
                  <th className="py-3 px-4 text-center">SALARY TYPE</th>
                  <th className="py-3 px-4 text-right">BASIC SALARY</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {employees.map(emp => {
                  const isActive = emp.is_active === 1;
                  const basicRupees = (emp.basic_salary_paise || 0) / 100;
                  const payTypeLabel = emp.salary_type === 'Daily' ? 'Daily' : emp.salary_type === 'Hourly' ? 'Hourly' : 'Monthly';

                  return (
                    <tr 
                      key={emp.id} 
                      className={`hover:bg-surface-hover/30 transition-colors ${
                        !isActive ? 'opacity-60 bg-surface-app/40' : ''
                      }`}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isActive 
                              ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30' 
                              : 'bg-surface-panel text-text-muted border border-border-subtle'
                          }`}>
                            {emp.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-text-primary text-xs flex items-center gap-2">
                              <span>{emp.full_name}</span>
                              {!isActive && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-400 font-bold">
                                  Inactive
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-text-muted font-mono mt-0.5">
                              {emp.emp_code} • Joined {emp.joining_date}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Dept */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-text-primary">{emp.role}</div>
                        <div className="text-[10px] text-text-muted">{emp.department}</div>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-text-primary flex items-center gap-1">
                          <Phone size={11} className="text-text-muted" />
                          <span>{emp.mobile}</span>
                        </div>
                        {emp.emergency_contact_phone && (
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">
                            Emg: {emp.emergency_contact_phone} ({emp.emergency_contact_name || 'Relative'})
                          </div>
                        )}
                      </td>

                      {/* Salary Type */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          emp.salary_type === 'Daily'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : emp.salary_type === 'Hourly'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {payTypeLabel}
                        </span>
                      </td>

                      {/* Basic Salary */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                        ₹{basicRupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        <span className="text-[10px] font-normal text-text-muted ml-1">
                          /{emp.salary_type === 'Daily' ? 'day' : emp.salary_type === 'Hourly' ? 'hr' : 'mo'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}>
                          {isActive ? <UserCheck size={11} /> : <UserX size={11} />}
                          <span>{isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 360 Profile Dashboard */}
                          <button
                            onClick={() => setSelectedEmployeeFor360(emp)}
                            className="p-1.5 bg-surface-panel hover:bg-cyan-500/15 text-text-muted hover:text-cyan-400 border border-border-subtle rounded-lg text-xs font-semibold transition-all"
                            title="Open Employee 360 Dashboard"
                          >
                            <Users size={13} />
                          </button>

                          {/* Salary Structure Rules Button */}
                          <button
                            onClick={() => setSelectedEmployeeForSalary(emp)}
                            className="p-1.5 bg-surface-panel hover:bg-emerald-500/15 text-text-muted hover:text-emerald-400 border border-border-subtle rounded-lg text-xs font-semibold transition-all"
                            title="Configure Salary Structure Rules"
                          >
                            <Sliders size={13} />
                          </button>

                          {/* Edit Profile Button */}
                          <button
                            onClick={() => setSelectedEmployeeForEdit(emp)}
                            className="p-1.5 bg-surface-panel hover:bg-brand-500/15 text-text-muted hover:text-brand-400 border border-border-subtle rounded-lg text-xs font-semibold transition-all"
                            title="Edit Employee Master Profile"
                          >
                            <Edit size={13} />
                          </button>

                          {/* Deactivate / Reactivate Toggle */}
                          <button
                            onClick={() => handleToggleActive(emp)}
                            className={`p-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              isActive
                                ? 'bg-surface-panel hover:bg-rose-500/15 text-text-muted hover:text-rose-400 border-border-subtle'
                                : 'bg-green-500/15 text-green-400 hover:bg-green-500/25 border-green-500/30'
                            }`}
                            title={isActive ? 'Deactivate Employee (Preserves History)' : 'Reactivate Employee'}
                          >
                            {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Employee 360 Dashboard Modal */}
      {selectedEmployeeFor360 && (
        <EmployeeDashboard360Modal
          employeeId={selectedEmployeeFor360.id}
          onClose={() => setSelectedEmployeeFor360(null)}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Add / Edit Employee Modal */}
      {(isAddModalOpen || selectedEmployeeForEdit) && (
        <EmployeeModal
          employee={selectedEmployeeForEdit}
          onClose={() => {
            setIsAddModalOpen(false);
            setSelectedEmployeeForEdit(null);
          }}
        />
      )}

      {/* Salary Structure Rules Modal */}
      {selectedEmployeeForSalary && (
        <SalaryStructureModal
          employee={selectedEmployeeForSalary}
          onClose={() => setSelectedEmployeeForSalary(null)}
        />
      )}
    </div>
  );
}
