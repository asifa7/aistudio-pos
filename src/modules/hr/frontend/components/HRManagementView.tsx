import { useState } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  CreditCard, 
  Receipt, 
  Gift, 
  Hourglass, 
  MinusCircle, 
  BookOpen, 
  Calculator,
  BarChart3
} from 'lucide-react';
import EmployeeMasterView from './EmployeeMasterView';
import DailyAttendanceGrid from './DailyAttendanceGrid';
import LeaveManagementView from './LeaveManagementView';
import AdvancesView from './AdvancesView';
import EmployeeExpensesView from './EmployeeExpensesView';
import IncentivesView from './IncentivesView';
import OvertimeView from './OvertimeView';
import DeductionsView from './DeductionsView';
import MonthlyPayrollView from './MonthlyPayrollView';
import EmployeeLedgerView from './EmployeeLedgerView';
import HRReportsView from './HRReportsView';
import { ErrorBoundary } from '../../../../core/shared/ErrorBoundary';

export type HRTab = 
  | 'employees' 
  | 'attendance' 
  | 'leaves' 
  | 'advances' 
  | 'expenses' 
  | 'incentives' 
  | 'overtime' 
  | 'deductions' 
  | 'payroll'
  | 'ledger'
  | 'reports';

export default function HRManagementView() {
  const [activeTab, setActiveTab] = useState<HRTab>('payroll');

  const tabs: { key: HRTab; label: string; icon: any }[] = [
    { key: 'payroll', label: 'Payroll & Slips', icon: Calculator },
    { key: 'employees', label: 'Employees', icon: Users },
    { key: 'attendance', label: 'Attendance', icon: Clock },
    { key: 'leaves', label: 'Leaves', icon: Calendar },
    { key: 'advances', label: 'Advances', icon: CreditCard },
    { key: 'expenses', label: 'Expenses', icon: Receipt },
    { key: 'incentives', label: 'Incentives', icon: Gift },
    { key: 'overtime', label: 'Overtime', icon: Hourglass },
    { key: 'deductions', label: 'Deductions', icon: MinusCircle },
    { key: 'ledger', label: 'Master Ledger', icon: BookOpen },
    { key: 'reports', label: 'Reports & Audit', icon: BarChart3 },
  ];

  return (
    <ErrorBoundary fallbackTitle="Error loading HR Management">
      <div className="flex flex-col h-full bg-surface-app text-text-primary p-4 space-y-3 overflow-hidden">
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-2.5 gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
              <Users size={20} />
            </div>
            <div>
              <h1 className="text-base font-black text-text-primary flex items-center gap-2">
                <span>HR & Payroll Suite</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                  Full Suite Active (Phase 1–3)
                </span>
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Automated Payroll Engine, Statements, Salary Slips, Cash Box Integration, Ledger & Reports.
              </p>
            </div>
          </div>

          {/* Sub-Tabs Switcher Bar */}
          <div className="flex items-center bg-surface-panel p-1 rounded-2xl border border-border-subtle overflow-x-auto max-w-full">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-card'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab View Container */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'payroll' && <MonthlyPayrollView />}
          {activeTab === 'employees' && <EmployeeMasterView onNavigateTab={(t) => setActiveTab(t as HRTab)} />}
          {activeTab === 'attendance' && <DailyAttendanceGrid />}
          {activeTab === 'leaves' && <LeaveManagementView />}
          {activeTab === 'advances' && <AdvancesView />}
          {activeTab === 'expenses' && <EmployeeExpensesView />}
          {activeTab === 'incentives' && <IncentivesView />}
          {activeTab === 'overtime' && <OvertimeView />}
          {activeTab === 'deductions' && <DeductionsView />}
          {activeTab === 'ledger' && <EmployeeLedgerView />}
          {activeTab === 'reports' && <HRReportsView />}
        </div>
      </div>
    </ErrorBoundary>
  );
}
