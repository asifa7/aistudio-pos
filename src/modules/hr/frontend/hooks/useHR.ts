import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { 
  Employee, 
  SalaryStructure, 
  MonthAttendanceGridData, 
  HRLeaveType, 
  EmployeeLeave, 
  LeaveBalance, 
  HRRole,
  AttendanceStatus,
  FixedAllowance,
  DeductionRule,
  PayType,
  PayrollRun,
  PayrollItem,
  EmployeeSummary360,
  HRPayrollReportSummary,
  HRAuditLog,
  PayrollPeriodInput
} from '../types/hr.types';

// ─── Employee Master Hooks ──────────────────────────────────────────────────

export function useEmployees(filters?: { search?: string; department?: string; role?: string; status?: string; includeInactive?: boolean }) {
  return useQuery<Employee[]>({
    queryKey: ['hr', 'employees', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_EMPLOYEES, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch employees');
      return res.data || [];
    },
  });
}

export function useEmployee(id: number | null) {
  return useQuery<Employee>({
    queryKey: ['hr', 'employee', id],
    queryFn: async () => {
      if (!id) throw new Error('No employee ID provided');
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_EMPLOYEE, { id });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch employee');
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Employee> & { basic_salary?: number }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_EMPLOYEE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create employee');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-balances'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<Employee> }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.UPDATE_EMPLOYEE, { id, input });
      if (!res.success) throw new Error(res.error?.message || 'Failed to update employee');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'salary-structure', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
}

export function useToggleEmployeeActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.TOGGLE_EMPLOYEE_ACTIVE, { id, isActive });
      if (!res.success) throw new Error(res.error?.message || 'Failed to update employee status');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
}

// ─── Salary Structure Hooks ─────────────────────────────────────────────────

export function useSalaryStructure(employeeId: number | null) {
  return useQuery<SalaryStructure>({
    queryKey: ['hr', 'salary-structure', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee ID provided');
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_SALARY_STRUCTURE, { employeeId });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch salary structure');
      return res.data;
    },
    enabled: Boolean(employeeId),
  });
}

export function useUpdateSalaryStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      pay_type: PayType;
      basic_salary_paise: number;
      fixed_allowances: FixedAllowance[];
      overtime_rate_paise?: number;
      incentive_rule_ref?: string | null;
      attendance_based_salary?: boolean;
      deduction_rules?: DeductionRule[];
      effective_from?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.UPDATE_SALARY_STRUCTURE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to update salary structure');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'salary-structure', variables.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', variables.employee_id] });
    },
  });
}

// ─── Roles Hooks ────────────────────────────────────────────────────────────

export function useHRRoles() {
  return useQuery<HRRole[]>({
    queryKey: ['hr', 'roles'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_ROLES);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch roles');
      return res.data || [];
    },
  });
}

export function useCreateHRRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_ROLE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create role');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'roles'] });
    },
  });
}

// ─── Attendance Hooks ───────────────────────────────────────────────────────

export function useMonthAttendance(monthYear?: string) {
  return useQuery<MonthAttendanceGridData>({
    queryKey: ['hr', 'attendance', monthYear],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_MONTH_ATTENDANCE, { monthYear });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch attendance grid');
      return res.data;
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      date: string;
      status: AttendanceStatus;
      working_hours?: number;
      overtime_hours?: number;
      notes?: string;
      modified_reason?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.MARK_ATTENDANCE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to record attendance');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
}

export function useMarkBulkPresentToday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date?: string) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.MARK_BULK_PRESENT_TODAY, { date });
      if (!res.success) throw new Error(res.error?.message || 'Failed to bulk mark present');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
}

// ─── Leave Management Hooks ─────────────────────────────────────────────────

export function useLeaveTypes() {
  return useQuery<HRLeaveType[]>({
    queryKey: ['hr', 'leave-types'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_LEAVE_TYPES);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch leave types');
      return res.data || [];
    },
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; code: string; default_days_per_year: number; is_paid: boolean }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_LEAVE_TYPE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create leave type');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-balances'] });
    },
  });
}

export function useLeaves(filters?: { employeeId?: number; status?: string; year?: number }) {
  return useQuery<EmployeeLeave[]>({
    queryKey: ['hr', 'leaves', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_LEAVES, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch leave requests');
      return res.data || [];
    },
  });
}

export function useApplyLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      leave_type_id?: number;
      leave_type: string;
      start_date: string;
      end_date: string;
      reason: string;
      is_paid?: boolean;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.APPLY_LEAVE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to apply leave');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-balances'] });
    },
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { leave_id: number; status: 'Approved' | 'Rejected'; rejection_reason?: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.APPROVE_LEAVE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to process leave approval');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'leaves'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'leave-balances'] });
    },
  });
}

export function useLeaveBalances(employeeId?: number, year?: number) {
  return useQuery<LeaveBalance[]>({
    queryKey: ['hr', 'leave-balances', employeeId, year],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_LEAVE_BALANCES, { employeeId, year });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch leave balances');
      return res.data || [];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 HOOKS: LEDGER, ADVANCES, EXPENSES, INCENTIVES, OVERTIME, DEDUCTIONS
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EmployeeLedgerEntry,
  EmployeeAdvance,
  EmployeeExpense,
  ExpenseFlag,
  IncentiveRule,
  EmployeeIncentive,
  EmployeeOvertime,
  EmployeeDeduction,
  DeductionType
} from '../../shared/hr.types';

export function useEmployeeLedger(employeeId: number | null, dateRange?: { start?: string; end?: string }) {
  return useQuery<EmployeeLedgerEntry[]>({
    queryKey: ['hr', 'ledger', employeeId, dateRange],
    queryFn: async () => {
      if (!employeeId) return [];
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_LEDGER, { employeeId, dateRange });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch employee ledger');
      return res.data || [];
    },
    enabled: Boolean(employeeId),
  });
}

export function useAdvances(filters?: { employeeId?: number; status?: string }) {
  return useQuery<EmployeeAdvance[]>({
    queryKey: ['hr', 'advances', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_ADVANCES, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch advances');
      return res.data || [];
    },
  });
}

export function useCreateAdvance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      amount_paise: number;
      advance_date: string;
      payment_mode?: 'cash' | 'bank' | 'upi';
      reason: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_ADVANCE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create advance');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'advances'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
    },
  });
}

export function useEmployeeExpenses(filters?: { employeeId?: number; category?: string; flag?: string }) {
  return useQuery<EmployeeExpense[]>({
    queryKey: ['hr', 'expenses', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_EXPENSES, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch employee expenses');
      return res.data || [];
    },
  });
}

export function useCreateEmployeeExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      expense_date?: string;
      amount_paise: number;
      category: string;
      description: string;
      flag: ExpenseFlag;
      receipt_url?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_EXPENSE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to record expense');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'expenses'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employee_id] });
    },
  });
}

export function useIncentiveRules() {
  return useQuery<IncentiveRule[]>({
    queryKey: ['hr', 'incentive-rules'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_INCENTIVE_RULES);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch incentive rules');
      return res.data || [];
    },
  });
}

export function useCreateIncentiveRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      rule_name: string;
      rule_type: string;
      target_value: number;
      reward_amount_paise: number;
      description?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_INCENTIVE_RULE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create incentive rule');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'incentive-rules'] });
    },
  });
}

export function useIncentives(filters?: { employeeId?: number; monthYear?: string }) {
  return useQuery<EmployeeIncentive[]>({
    queryKey: ['hr', 'incentives', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_INCENTIVES, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch incentives');
      return res.data || [];
    },
  });
}

export function useCreateManualIncentive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      amount_paise: number;
      incentive_date?: string;
      reason: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_MANUAL_INCENTIVE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to award incentive');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'incentives'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employee_id] });
    },
  });
}

export function useEvaluateRuleIncentives() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (monthYear: string) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.EVALUATE_RULE_INCENTIVES, { monthYear });
      if (!res.success) throw new Error(res.error?.message || 'Failed to evaluate rule incentives');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'incentives'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger'] });
    },
  });
}

export function useOvertimeRecords(filters?: { employeeId?: number; monthYear?: string }) {
  return useQuery<EmployeeOvertime[]>({
    queryKey: ['hr', 'overtime', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_OVERTIME_RECORDS, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch overtime records');
      return res.data || [];
    },
  });
}

export function useRecordOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      date: string;
      normal_hours?: number;
      ot_hours: number;
      ot_rate_paise?: number;
      notes?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.RECORD_OVERTIME, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to record overtime');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
}

export function useDeductions(filters?: { employeeId?: number; deductionType?: string; advanceId?: number }) {
  return useQuery<EmployeeDeduction[]>({
    queryKey: ['hr', 'deductions', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.GET_DEDUCTIONS, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch deductions');
      return res.data || [];
    },
  });
}

export function useCreateDeduction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      deduction_type: DeductionType;
      advance_id?: number | null;
      amount_paise: number;
      deduction_date?: string;
      reason: string;
      approved_by_name?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.CREATE_DEDUCTION, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to create deduction');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'deductions'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'advances'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employee_id] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 HOOKS: PAYROLL ENGINE, STATEMENTS, PAYMENTS, 360, REPORTS, AUDIT
// ─────────────────────────────────────────────────────────────────────────────

export function usePayrollRun(monthYear: string) {
  return useQuery<PayrollRun | null>({
    queryKey: ['hr', 'payroll-run', monthYear],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_GET_RUN, { monthYear });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch payroll run');
      return res.data || null;
    },
    enabled: Boolean(monthYear),
  });
}

export function usePayrollItems(monthYear: string, filters?: { employeeId?: number; department?: string; status?: string; salaryType?: string }) {
  return useQuery<PayrollItem[]>({
    queryKey: ['hr', 'payroll-items', monthYear, filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_GET_ITEMS, { monthYear, filters });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch payroll items');
      return res.data || [];
    },
    enabled: Boolean(monthYear),
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { monthYear?: string; forceRecalculate?: boolean; periodInput?: PayrollPeriodInput } | PayrollPeriodInput) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_GENERATE, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to generate payroll');
      return res.data;
    },
    onSuccess: (_, variables) => {
      const my = (variables as any).monthYear || (variables as any).periodInput?.monthYear || (variables as any).startDate?.slice(0, 7);
      if (my) {
        queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', my] });
        queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', my] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run'] });
        queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items'] });
      }
      queryClient.invalidateQueries({ queryKey: ['hr', 'reports-summary'] });
    },
  });
}

export function useSettleEmployeeRelieving() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: number;
      relieving_date: string;
      reason: string;
      payment_method?: 'cash' | 'bank' | 'upi' | 'cheque';
      payment_reference?: string;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.EMPLOYEE_SETTLE_RELIEVING, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to settle employee relieving');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'employee', variables.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employee_id] });
    },
  });
}

export function useOverridePayrollItemNet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemId: number; newNetSalaryPaise: number; reason: string; monthYear: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_OVERRIDE_NET, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to override net salary');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'audit-logs'] });
    },
  });
}

export function useApprovePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (monthYear: string) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_APPROVE_RUN, { monthYear });
      if (!res.success) throw new Error(res.error?.message || 'Failed to approve payroll');
      return res.data;
    },
    onSuccess: (_, monthYear) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', monthYear] });
    },
  });
}

export function usePayPayrollItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      itemId: number;
      paymentMethod: 'cash' | 'bank' | 'upi' | 'cheque';
      paymentDate?: string;
      paymentReference?: string;
      monthYear: string;
      employeeId: number;
    }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_PAY_ITEM, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to record salary payment');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
    },
  });
}

export function useReversePayrollItemPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemId: number; reason: string; monthYear: string; employeeId: number }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_REVERSE_ITEM, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to reverse salary payment');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'ledger', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['cashbox'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'audit-logs'] });
    },
  });
}

export function useLockPayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { monthYear: string; notes?: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_LOCK_RUN, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to lock payroll');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'month-locked', variables.monthYear] });
    },
  });
}

export function useReopenPayrollRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { monthYear: string; reason: string }) => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_REOPEN_RUN, payload);
      if (!res.success) throw new Error(res.error?.message || 'Failed to reopen payroll');
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-run', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payroll-items', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'month-locked', variables.monthYear] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'audit-logs'] });
    },
  });
}

export function useEmployeePayrollHistory(employeeId: number | null) {
  return useQuery<PayrollItem[]>({
    queryKey: ['hr', 'payroll-history', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const res = await window.api.invoke(IPC_CHANNELS.HR.PAYROLL_GET_HISTORY, { employeeId });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch payroll history');
      return res.data || [];
    },
    enabled: Boolean(employeeId),
  });
}

export function useEmployeeSummary360(employeeId: number | null) {
  return useQuery<EmployeeSummary360>({
    queryKey: ['hr', 'employee-360', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee ID provided');
      const res = await window.api.invoke(IPC_CHANNELS.HR.EMPLOYEE_GET_360, { employeeId });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch employee 360 summary');
      return res.data;
    },
    enabled: Boolean(employeeId),
  });
}

export function usePayrollSummaryReport(monthYear?: string, year?: number) {
  return useQuery<HRPayrollReportSummary>({
    queryKey: ['hr', 'reports-payroll-summary', monthYear, year],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.REPORTS_PAYROLL_SUMMARY, { monthYear, year });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch payroll summary report');
      return res.data;
    },
  });
}

export function useHRAuditLogs(filters?: { entityType?: string; entityId?: number; limit?: number }) {
  return useQuery<HRAuditLog[]>({
    queryKey: ['hr', 'audit-logs', filters],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.HR.AUDIT_LOGS_GET, filters);
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch HR audit logs');
      return res.data || [];
    },
  });
}


