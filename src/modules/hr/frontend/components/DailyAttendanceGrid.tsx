import { useState, useMemo } from 'react';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCheck, 
  Lock, 
  Unlock, 
  AlertCircle, 
  ShieldCheck, 
  RefreshCw, 
  Calendar,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useMonthAttendance, useMarkAttendance, useMarkBulkPresentToday } from '../hooks/useHR';
import type { AttendanceStatus } from '../types/hr.types';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; short: string; weight: number; colorClass: string; bgClass: string }> = {
  Present: { label: 'Present', short: 'P', weight: 1.0, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  Absent: { label: 'Absent', short: 'A', weight: 0.0, colorClass: 'text-rose-400', bgClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  Half_Day: { label: 'Half Day (0.5d)', short: 'HD', weight: 0.5, colorClass: 'text-amber-400', bgClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  Leave_Paid: { label: 'Paid Leave', short: 'PL', weight: 1.0, colorClass: 'text-cyan-400', bgClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  Leave_Unpaid: { label: 'Unpaid Leave', short: 'UL', weight: 0.0, colorClass: 'text-purple-400', bgClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  Late: { label: 'Late', short: 'L', weight: 1.0, colorClass: 'text-orange-400', bgClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  Holiday: { label: 'Shop Holiday', short: 'H', weight: 1.0, colorClass: 'text-indigo-400', bgClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  Weekly_Off: { label: 'Weekly Off', short: 'WO', weight: 1.0, colorClass: 'text-slate-400', bgClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
};

export default function DailyAttendanceGrid() {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().slice(0, 10), [today]);
  
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => {
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: gridData, isLoading, isError, error, refetch } = useMonthAttendance(selectedMonthYear);
  const markAttendanceMutation = useMarkAttendance();
  const bulkPresentMutation = useMarkBulkPresentToday();

  // Cell Popover State
  const [activeCell, setActiveCell] = useState<{
    empId: number;
    empName: string;
    date: string;
    dayNum: number;
    currentStatus?: AttendanceStatus;
    isModified?: number;
    modifiedReason?: string | null;
  } | null>(null);

  // Past Attendance Modification Reason state
  const [selectedNewStatus, setSelectedNewStatus] = useState<AttendanceStatus | null>(null);
  const [modificationReason, setModificationReason] = useState<string>('');
  const [showReasonModal, setShowReasonModal] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonthYear.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonthYear]);

  const handlePrevMonth = () => {
    const [y, m] = selectedMonthYear.split('-');
    let year = parseInt(y, 10);
    let month = parseInt(m, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    setSelectedMonthYear(`${year}-${String(month).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonthYear.split('-');
    let year = parseInt(y, 10);
    let month = parseInt(m, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    setSelectedMonthYear(`${year}-${String(month).padStart(2, '0')}`);
  };

  const handleCellClick = (emp: { id: number; full_name: string }, d: { date_str: string; day_num: number }, rec?: any) => {
    if (gridData?.is_locked) return;
    if (d.date_str > todayStr) {
      alert('Cannot mark or modify attendance for future dates.');
      return;
    }

    setActiveCell({
      empId: emp.id,
      empName: emp.full_name,
      date: d.date_str,
      dayNum: d.day_num,
      currentStatus: rec?.status,
      isModified: rec?.is_modified,
      modifiedReason: rec?.modified_reason,
    });
    setSelectedNewStatus(null);
    setModificationReason('');
    setShowReasonModal(false);
  };

  const handleSelectStatus = async (status: AttendanceStatus) => {
    if (!activeCell) return;
    if (gridData?.is_locked) {
      alert(`Cannot edit attendance. Payroll for ${selectedMonthYear} is locked.`);
      return;
    }

    // If past attendance is being changed from existing value, require reason
    const isPastDate = activeCell.date < todayStr;
    const isChangingExisting = activeCell.currentStatus && activeCell.currentStatus !== status;

    if (isPastDate && isChangingExisting) {
      setSelectedNewStatus(status);
      setShowReasonModal(true);
      return;
    }

    try {
      await markAttendanceMutation.mutateAsync({
        employee_id: activeCell.empId,
        date: activeCell.date,
        status,
      });
      setActiveCell(null);
    } catch (err: any) {
      alert(err.message || 'Failed to update attendance.');
    }
  };

  const handleConfirmModifiedStatus = async () => {
    if (!activeCell || !selectedNewStatus) return;
    if (!modificationReason.trim()) {
      alert('Please enter a reason for modifying past attendance.');
      return;
    }

    try {
      await markAttendanceMutation.mutateAsync({
        employee_id: activeCell.empId,
        date: activeCell.date,
        status: selectedNewStatus,
        modified_reason: modificationReason.trim(),
      });
      setShowReasonModal(false);
      setActiveCell(null);
      setSelectedNewStatus(null);
      setModificationReason('');
      setFeedbackMsg(`Past attendance updated with audit note.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update attendance.');
    }
  };

  const handleBulkPresentToday = async () => {
    if (gridData?.is_locked) {
      alert(`Cannot edit attendance. Payroll for ${selectedMonthYear} is locked.`);
      return;
    }

    try {
      const res = await bulkPresentMutation.mutateAsync(todayStr);
      setFeedbackMsg(`Marked ${res.count} active employees as Present for today!`);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to mark bulk present.');
    }
  };

  const totalEmployees = gridData?.employees.length || 0;
  const avgWorkedDays = useMemo(() => {
    if (!gridData || gridData.employees.length === 0) return '0.0';
    const sum = gridData.employees.reduce((acc, e) => acc + (e.worked_days || 0), 0);
    return (sum / gridData.employees.length).toFixed(1);
  }, [gridData]);

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Toolbar: Month Navigator & Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        {/* Month Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-panel border border-border-subtle rounded-xl p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-surface-card rounded-lg text-text-muted hover:text-text-primary transition-colors"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="px-3 py-1 font-bold text-xs text-text-primary flex items-center gap-2 min-w-[140px] justify-center font-mono">
              <Calendar size={13} className="text-brand-500" />
              <span>{monthLabel}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-surface-card rounded-lg text-text-muted hover:text-text-primary transition-colors"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Month Lock Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            gridData?.is_locked 
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' 
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {gridData?.is_locked ? <Lock size={12} /> : <Unlock size={12} />}
            <span>{gridData?.is_locked ? 'Payroll Locked (Read-Only)' : 'Attendance Unlocked'}</span>
          </div>
        </div>

        {/* Action Controls & Fast Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Mark All Present for Today */}
          <button
            onClick={handleBulkPresentToday}
            disabled={gridData?.is_locked || bulkPresentMutation.isPending}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            title="Mark all staff who do not have attendance marked today as Present"
          >
            <CheckCheck size={14} />
            <span>Mark All Present for Today</span>
          </button>

          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
            title="Refresh Attendance Grid"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150 flex-shrink-0">
          <ShieldCheck size={14} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Attendance Matrix Grid */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col relative">
        {isLoading ? (
          <div className="p-16 text-center text-text-muted text-xs">Loading attendance grid for {monthLabel}...</div>
        ) : isError ? (
          <div className="p-16 text-center space-y-2 text-rose-400">
            <AlertCircle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load attendance matrix</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : !gridData || gridData.employees.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Clock size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Active Employees in {monthLabel}</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Add employees in the &quot;Employee Master&quot; tab to begin tracking daily attendance.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="text-xs border-collapse w-max min-w-full">
              {/* Table Header: Day Numbers & Days of Week */}
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-20 shadow-sm">
                <tr>
                  {/* Sticky Employee Column */}
                  <th className="sticky left-0 z-30 bg-surface-panel py-3 px-4 border-r border-border-subtle min-w-[200px] text-left">
                    EMPLOYEE / ROLE
                  </th>
                  {/* Sticky Worked Days Column */}
                  <th className="sticky left-[200px] z-30 bg-surface-panel py-3 px-3 border-r border-border-subtle text-center min-w-[95px] text-cyan-400 font-extrabold">
                    WORKED DAYS
                  </th>

                  {/* Day Columns */}
                  {gridData.days.map(d => {
                    const isToday = d.date_str === todayStr;
                    const isFuture = d.date_str > todayStr;
                    return (
                      <th
                        key={d.day_num}
                        className={`py-2 px-1 text-center border-r border-border-subtle/50 min-w-[34px] w-[34px] ${
                          d.is_weekend ? 'bg-amber-500/5 text-amber-400/80' : ''
                        } ${isToday ? 'bg-brand-500/15 text-brand-400 font-black' : ''} ${
                          isFuture ? 'opacity-40 bg-surface-card/40' : ''
                        }`}
                        title={isFuture ? `${d.date_str} (Future Date - Read-Only)` : d.date_str}
                      >
                        <div className="text-[10px] font-mono leading-none">{d.day_num}</div>
                        <div className="text-[8.5px] mt-0.5 font-normal uppercase opacity-75">{d.day_of_week.slice(0, 2)}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {/* Table Body: Employees & Day Status Cells */}
              <tbody className="divide-y divide-border-subtle/50">
                {gridData.employees.map(emp => {
                  return (
                    <tr key={emp.id} className="hover:bg-surface-hover/20 transition-colors">
                      {/* Sticky Employee Info */}
                      <td className="sticky left-0 z-10 bg-surface-card hover:bg-surface-hover/30 py-2.5 px-4 border-r border-border-subtle font-sans">
                        <div className="font-bold text-text-primary text-xs truncate max-w-[170px]">
                          {emp.full_name}
                        </div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {emp.emp_code} • {emp.role}
                        </div>
                      </td>

                      {/* Sticky Worked Days Total */}
                      <td className="sticky left-[200px] z-10 bg-surface-card hover:bg-surface-hover/30 py-2.5 px-3 border-r border-border-subtle text-center font-mono font-black text-cyan-400">
                        {emp.worked_days.toFixed(1)}
                        <span className="text-[9px] font-normal text-text-muted ml-0.5">d</span>
                      </td>

                      {/* Day Cells */}
                      {gridData.days.map(d => {
                        const rec = emp.attendance[d.date_str];
                        const isToday = d.date_str === todayStr;
                        const isFuture = d.date_str > todayStr;
                        const status = rec?.status;
                        const config = status ? STATUS_CONFIG[status] : null;
                        const isModified = rec?.is_modified === 1;

                        return (
                          <td
                            key={d.day_num}
                            onClick={() => {
                              if (isFuture) return;
                              handleCellClick(emp, d, rec);
                            }}
                            className={`p-0.5 text-center border-r border-border-subtle/40 select-none ${
                              isFuture 
                                ? 'cursor-not-allowed opacity-30 bg-surface-card/40' 
                                : 'cursor-pointer transition-all hover:bg-brand-500/20'
                            } ${d.is_weekend ? 'bg-amber-500/5' : ''} ${isToday ? 'border-b-2 border-b-brand-500' : ''}`}
                            title={
                              isFuture
                                ? 'Future date — cannot mark attendance'
                                : `${emp.full_name} - ${d.date_str}: ${config?.label || 'Not Marked'}${
                                    isModified ? ` (Modified: ${rec?.modified_reason || 'Edited'})` : ''
                                  }`
                            }
                          >
                            <div
                              className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center font-mono text-[10px] font-extrabold border transition-transform relative ${
                                config
                                  ? `${config.bgClass}`
                                  : 'border-dashed border-border-subtle/60 text-text-muted/40 hover:border-brand-500/50'
                              }`}
                            >
                              {config?.short || (isFuture ? '·' : '·')}
                              {isModified && (
                                <span 
                                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 border border-surface-card rounded-full" 
                                  title={`Edited: ${rec?.modified_reason || 'Reason recorded'}`}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Legend & Summary Bar */}
        <div className="border-t border-border-subtle bg-surface-panel p-2.5 px-4 flex flex-wrap items-center justify-between gap-3 text-xs flex-shrink-0">
          {/* Status Legend Pills */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
            <span className="text-text-muted uppercase text-[9px] mr-1">Legend:</span>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <span key={key} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${cfg.bgClass}`}>
                <span>{cfg.short}</span>
                <span className="font-normal text-text-secondary">({cfg.label})</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Past Edit</span>
            </span>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted">
            <span>Staff: <strong className="text-text-primary">{totalEmployees}</strong></span>
            <span>Avg Worked: <strong className="text-cyan-400">{avgWorkedDays} days</strong></span>
          </div>
        </div>
      </div>

      {/* Rapid Cell Status Picker Popover Modal */}
      {activeCell && !showReasonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-sm p-4 shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <div>
                <h3 className="text-xs font-black text-text-primary">{activeCell.empName}</h3>
                <p className="text-[11px] font-mono text-brand-400 mt-0.5">Date: {activeCell.date}</p>
                {activeCell.isModified === 1 && activeCell.modifiedReason && (
                  <p className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                    <Info size={11} /> Previous Note: {activeCell.modifiedReason}
                  </p>
                )}
              </div>
              <button
                onClick={() => setActiveCell(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
              Select Attendance Status:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map(statusKey => {
                const cfg = STATUS_CONFIG[statusKey];
                const isSelected = activeCell.currentStatus === statusKey;
                return (
                  <button
                    key={statusKey}
                    type="button"
                    onClick={() => handleSelectStatus(statusKey)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold border transition-all text-left ${
                      isSelected 
                        ? `${cfg.bgClass} ring-2 ring-brand-500 shadow-md` 
                        : 'bg-surface-card border-border-subtle hover:bg-surface-hover text-text-primary'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-extrabold border ${cfg.bgClass}`}>
                      {cfg.short}
                    </span>
                    <span className="truncate">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Reason Prompt for Past Date Attendance Modification */}
      {showReasonModal && activeCell && selectedNewStatus && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle size={20} />
              <h3 className="text-sm font-black text-text-primary">Reason for Past Attendance Change</h3>
            </div>

            <p className="text-xs text-text-secondary">
              You are modifying past attendance for <strong className="text-text-primary">{activeCell.empName}</strong> on <strong className="font-mono text-brand-400">{activeCell.date}</strong> from <span className="font-bold text-rose-400">{activeCell.currentStatus || 'None'}</span> to <span className="font-bold text-emerald-400">{STATUS_CONFIG[selectedNewStatus]?.label}</span>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary block">
                Modification Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={modificationReason}
                onChange={e => setModificationReason(e.target.value)}
                placeholder="e.g. Employee forgot to punch in / informed manager / corrected typo"
                rows={3}
                className="w-full bg-surface-card border border-border-subtle rounded-xl p-3 text-xs text-text-primary outline-none focus:border-brand-500"
                required
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowReasonModal(false);
                  setSelectedNewStatus(null);
                }}
                className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-secondary rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModifiedStatus}
                disabled={!modificationReason.trim() || markAttendanceMutation.isPending}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-brand-500/20"
              >
                <span>Save with Audit Note</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
