import { useState, useRef } from 'react';
import { 
  Printer, 
  X, 
  FileText
} from 'lucide-react';
import type { PayrollItem } from '../types/hr.types';

interface SalarySlipModalProps {
  item: PayrollItem;
  onClose: () => void;
}

export default function SalarySlipModal({ item, onClose }: SalarySlipModalProps) {
  const [printFormat, setPrintFormat] = useState<'a4' | '80mm'>('a4');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const [yearStr, monthStr] = item.month_year.split('-');
  const monthLabel = `${monthNames[parseInt(monthStr, 10) - 1] || ''} ${yearStr}`;

  const periodDisplay = item.start_date && item.end_date 
    ? `${item.start_date} to ${item.end_date}` 
    : monthLabel;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <FileText size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-text-primary">
                Salary Slip — {item.full_name} ({periodDisplay})
              </h2>
              <p className="text-[11px] text-text-muted font-mono">{item.emp_code} • {item.department} {item.cycle_type ? `• ${item.cycle_type}` : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="flex items-center bg-surface-card p-0.5 rounded-xl border border-border-subtle text-xs">
              <button
                onClick={() => setPrintFormat('a4')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  printFormat === 'a4' ? 'bg-brand-500 text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                A4 Slip
              </button>
              <button
                onClick={() => setPrintFormat('80mm')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  printFormat === '80mm' ? 'bg-brand-500 text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                80mm Thermal
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Printer size={13} />
              <span>Print Slip</span>
            </button>

            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary p-1.5 rounded-xl hover:bg-surface-hover transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface-card/40">
          <div 
            ref={printRef}
            className={`mx-auto bg-white text-gray-900 shadow-xl rounded-xl transition-all ${
              printFormat === '80mm' 
                ? 'w-[320px] p-4 text-[11px] font-mono leading-tight' 
                : 'w-full max-w-2xl p-8 text-xs font-sans leading-normal'
            }`}
            style={{ color: '#111827' }}
          >
            {/* Header: Shop Name & Slip Title */}
            <div className="text-center border-b border-gray-300 pb-3 mb-3">
              <h1 className="font-black text-base uppercase tracking-wider text-gray-900">MEATPOS STORE</h1>
              <p className="text-[10px] text-gray-600">Fresh Meat & Poultry Processing — Employee Salary Statement</p>
              <div className="mt-2 inline-block px-3 py-0.5 bg-gray-100 rounded-full font-bold text-xs uppercase tracking-wider text-gray-800 border border-gray-300">
                PAYSLIP: {periodDisplay.toUpperCase()} {item.cycle_type === 'RELIEVING' ? '(FINAL SETTLEMENT)' : ''}
              </div>
            </div>

            {/* Employee & Attendance Overview */}
            <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-gray-200 pb-3 mb-3">
              <div>
                <div className="flex"><span className="text-gray-500 w-24">Employee ID:</span><strong className="font-mono">{item.emp_code}</strong></div>
                <div className="flex"><span className="text-gray-500 w-24">Employee Name:</span><strong>{item.full_name}</strong></div>
                <div className="flex"><span className="text-gray-500 w-24">Department:</span><span>{item.department}</span></div>
                <div className="flex"><span className="text-gray-500 w-24">Role / Title:</span><span>{item.role}</span></div>
                <div className="flex"><span className="text-gray-500 w-24">Pay Cycle:</span><span>{item.cycle_type || item.salary_type}</span></div>
              </div>
              <div>
                <div className="flex"><span className="text-gray-500 w-28">Period Days:</span><span>{item.total_days_in_month} days</span></div>
                <div className="flex"><span className="text-gray-500 w-28">Worked Days:</span><strong>{item.worked_days} days</strong></div>
                <div className="flex"><span className="text-gray-500 w-28">Present Days:</span><span>{item.present_days ?? item.worked_days} days</span></div>
                <div className="flex"><span className="text-gray-500 w-28">Unpaid Leaves:</span><span>{item.unpaid_leave_days || 0} days</span></div>
                <div className="flex"><span className="text-gray-500 w-28">Overtime Hours:</span><span>{item.overtime_hours || 0} hrs</span></div>
              </div>
            </div>

            {/* Earnings & Deductions Breakdown Tables */}
            <div className={printFormat === '80mm' ? 'space-y-3' : 'grid grid-cols-2 gap-4'}>
              {/* Earnings Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-emerald-50 px-3 py-1.5 font-bold text-emerald-900 border-b border-emerald-100 text-[11px] flex justify-between">
                  <span>EARNINGS & CREDITS</span>
                  <span>AMOUNT (₹)</span>
                </div>
                <div className="p-2.5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Basic Salary</span>
                    <span className="font-mono font-bold">₹{(item.basic_salary_paise / 100).toFixed(2)}</span>
                  </div>

                  {item.fixed_allowances_paise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fixed Allowances</span>
                      <span className="font-mono">₹{(item.fixed_allowances_paise / 100).toFixed(2)}</span>
                    </div>
                  )}

                  {item.overtime_amount_paise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Overtime Pay ({item.overtime_hours} hrs)</span>
                      <span className="font-mono font-bold text-emerald-700">₹{(item.overtime_amount_paise / 100).toFixed(2)}</span>
                    </div>
                  )}

                  {item.incentive_amount_paise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Incentives / Bonus</span>
                      <span className="font-mono font-bold text-emerald-700">₹{(item.incentive_amount_paise / 100).toFixed(2)}</span>
                    </div>
                  )}

                  {item.reimbursable_expenses_paise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Expense Reimbursement</span>
                      <span className="font-mono">₹{(item.reimbursable_expenses_paise / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-900">
                    <span>GROSS EARNINGS</span>
                    <span className="font-mono text-emerald-800">₹{(item.gross_salary_paise / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-rose-50 px-3 py-1.5 font-bold text-rose-900 border-b border-rose-100 text-[11px] flex justify-between">
                  <span>DEDUCTIONS & RECOVERIES</span>
                  <span>AMOUNT (₹)</span>
                </div>
                <div className="p-2.5 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Advance Recovery</span>
                    <span className="font-mono text-rose-700">
                      {item.advance_recovery_paise > 0 ? `-₹${(item.advance_recovery_paise / 100).toFixed(2)}` : '₹0.00'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-600">Unpaid Leave Deduction ({item.unpaid_leave_days}d)</span>
                    <span className="font-mono text-rose-700">
                      {item.unpaid_leave_deduction_paise > 0 ? `-₹${(item.unpaid_leave_deduction_paise / 100).toFixed(2)}` : '₹0.00'}
                    </span>
                  </div>

                  {item.other_deductions_paise > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Other Deductions & Penalties</span>
                      <span className="font-mono text-rose-700">-₹{(item.other_deductions_paise / 100).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-gray-900">
                    <span>TOTAL DEDUCTIONS</span>
                    <span className="font-mono text-rose-800">-₹{(item.total_deductions_paise / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Net Salary Highlight Box */}
            <div className="mt-4 p-3 bg-gray-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">NET SALARY PAYABLE</span>
                <span className="text-xs text-gray-300">
                  Status: <strong className="uppercase text-emerald-400">{item.status}</strong>
                  {item.is_overridden === 1 && ' (Manual Override)'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black font-mono text-emerald-400">
                  ₹{(item.net_salary_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment Details */}
            {item.status === 'Paid' && (
              <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] grid grid-cols-3 gap-2">
                <div><span className="text-gray-500 block">Payment Date:</span><strong>{item.payment_date || '—'}</strong></div>
                <div><span className="text-gray-500 block">Payment Mode:</span><strong className="uppercase">{item.payment_method || 'Cash'}</strong></div>
                <div><span className="text-gray-500 block">Reference No:</span><strong className="font-mono">{item.payment_reference || '—'}</strong></div>
              </div>
            )}

            {/* Signatures */}
            <div className="mt-8 pt-4 border-t border-gray-300 grid grid-cols-2 gap-8 text-center text-[10px] text-gray-600">
              <div>
                <div className="h-8 border-b border-gray-400 border-dashed mb-1"></div>
                <span>Employee Signature</span>
              </div>
              <div>
                <div className="h-8 border-b border-gray-400 border-dashed mb-1"></div>
                <span>Authorized Signatory (Manager)</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-4 text-center text-[9px] text-gray-400">
              This is a computer-generated salary slip from MeatPOS HR Engine.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
