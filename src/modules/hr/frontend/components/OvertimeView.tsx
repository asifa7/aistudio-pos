import { useState, useMemo, useEffect } from 'react';
import { 
  Clock, 
  Plus, 
  Search, 
  RefreshCw, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Hourglass
} from 'lucide-react';
import { useOvertimeRecords, useRecordOvertime, useEmployees, useSalaryStructure } from '../hooks/useHR';

export default function OvertimeView() {
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpId, setSelectedEmpId] = useState<number | 'ALL'>('ALL');

  // Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Queries
  const { data: rawOvertime = [], isLoading, isError, error, refetch } = useOvertimeRecords({
    employeeId: selectedEmpId !== 'ALL' ? selectedEmpId : undefined,
    monthYear: selectedMonth !== 'ALL' ? selectedMonth : undefined,
  });
  const overtimeRecords = useMemo(() => Array.isArray(rawOvertime) ? rawOvertime : [], [rawOvertime]);

  const { data: rawEmployees = [] } = useEmployees({ status: 'Active' });
  const activeEmployees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const recordOvertimeMutation = useRecordOvertime();

  // Form State
  const [otEmpId, setOtEmpId] = useState<number | ''>('');
  const [otDate, setOtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [otHours, setOtHours] = useState('2');
  const [otRate, setOtRate] = useState('100');
  const [otNormalHours, setOtNormalHours] = useState('8');
  const [otNotes, setOtNotes] = useState('Extended peak-hour cutting/prep shift');
  const [otError, setOtError] = useState<string | null>(null);

  // Lookup employee salary structure for default OT rate
  const { data: empSalaryStruct } = useSalaryStructure(typeof otEmpId === 'number' ? otEmpId : null);

  useEffect(() => {
    if (empSalaryStruct?.overtime_rate_paise) {
      setOtRate((empSalaryStruct.overtime_rate_paise / 100).toString());
    } else {
      setOtRate('100');
    }
  }, [empSalaryStruct]);

  const filteredRecords = useMemo(() => {
    return overtimeRecords.filter(r => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = r.full_name?.toLowerCase().includes(q);
        const matchCode = r.emp_code?.toLowerCase().includes(q);
        const matchNotes = r.notes?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchNotes) return false;
      }
      return true;
    });
  }, [overtimeRecords, searchTerm]);

  // Totals
  const totalHours = useMemo(() => overtimeRecords.reduce((s, r) => s + (r.ot_hours || 0), 0), [overtimeRecords]);
  const totalAmountPaise = useMemo(() => overtimeRecords.reduce((s, r) => s + (r.computed_amount_paise || 0), 0), [overtimeRecords]);

  const computedPreviewAmount = useMemo(() => {
    const hrs = parseFloat(otHours) || 0;
    const rate = parseFloat(otRate) || 0;
    return (hrs * rate).toFixed(2);
  }, [otHours, otRate]);

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtError(null);

    if (!otEmpId) {
      setOtError('Please select an employee.');
      return;
    }
    const hrsNum = parseFloat(otHours);
    const rateNum = parseFloat(otRate);
    if (isNaN(hrsNum) || hrsNum <= 0) {
      setOtError('Please enter valid OT hours (> 0).');
      return;
    }
    if (isNaN(rateNum) || rateNum <= 0) {
      setOtError('Please enter a valid hourly rate.');
      return;
    }

    try {
      await recordOvertimeMutation.mutateAsync({
        employee_id: Number(otEmpId),
        date: otDate,
        normal_hours: parseFloat(otNormalHours) || 8,
        ot_hours: hrsNum,
        ot_rate_paise: Math.round(rateNum * 100),
        notes: otNotes.trim() || undefined,
      });

      setIsRecordModalOpen(false);
      refetch();
    } catch (err: any) {
      setOtError(err.message || 'Failed to record overtime.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-shrink-0">
        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total OT Hours ({selectedMonth})</span>
            <div className="text-base font-black text-brand-400 font-mono mt-0.5">
              {totalHours.toFixed(1)} hrs
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center border border-brand-500/20">
            <Hourglass size={18} />
          </div>
        </div>

        <div className="bg-surface-card border border-border-subtle p-3 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-emerald-400">Total Overtime Pay Owed</span>
            <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
              ₹{(totalAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <DollarSign size={18} />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search overtime records..."
              className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 font-bold"
            />
          </div>

          <select
            value={selectedEmpId}
            onChange={e => setSelectedEmpId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500 font-bold"
          >
            <option value="ALL">All Staff</option>
            {activeEmployees.map(e => (
              <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code})</option>
            ))}
          </select>

          <input
            type="month"
            value={selectedMonth === 'ALL' ? '' : selectedMonth}
            onChange={e => setSelectedMonth(e.target.value || 'ALL')}
            className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>Log Overtime</span>
          </button>
        </div>
      </div>

      {/* Overtime Table */}
      <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
        {isLoading ? (
          <div className="p-12 text-center text-text-muted text-xs">Loading overtime records...</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2 text-rose-400">
            <AlertCircle size={32} className="mx-auto" />
            <div className="text-sm font-bold">Failed to load overtime records</div>
            <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock size={36} className="mx-auto text-text-muted/50" />
            <div className="text-sm font-bold text-text-secondary">No Overtime Logged for {selectedMonth}</div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Click &quot;Log Overtime&quot; above to record extra shift duty for cutters and helpers.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                <tr>
                  <th className="py-3 px-4">EMPLOYEE / ID</th>
                  <th className="py-3 px-4">DATE</th>
                  <th className="py-3 px-4 text-center">NORMAL HRS</th>
                  <th className="py-3 px-4 text-center text-brand-400 font-extrabold">OT HOURS</th>
                  <th className="py-3 px-4 text-right font-mono">HOURLY RATE</th>
                  <th className="py-3 px-4 text-right text-emerald-400 font-extrabold">COMPUTED PAY</th>
                  <th className="py-3 px-4">NOTES</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredRecords.map(rec => {
                  return (
                    <tr key={rec.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-bold text-text-primary text-xs">{rec.full_name}</div>
                        <div className="text-[10px] text-text-muted font-mono mt-0.5">
                          {rec.emp_code} • {rec.department}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-text-primary">
                        {rec.date}
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-text-muted">
                        {rec.normal_hours} hrs
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-black text-brand-400 text-xs">
                        +{rec.ot_hours} hrs
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-text-secondary">
                        ₹{(rec.ot_rate_paise / 100).toFixed(2)}/hr
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-xs">
                        +₹{(rec.computed_amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 text-text-secondary max-w-[200px] truncate" title={rec.notes || ''}>
                        {rec.notes || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                          <CheckCircle2 size={10} />
                          <span>Posted to Ledger</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Overtime Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
                  <Clock size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Log Staff Overtime (OT)</h3>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Select Employee</label>
                <select
                  value={otEmpId}
                  onChange={e => setOtEmpId(Number(e.target.value) || '')}
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {activeEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code} - {e.role})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Date</label>
                  <input
                    type="date"
                    value={otDate}
                    onChange={e => setOtDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Normal Working Hours</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={otNormalHours}
                    onChange={e => setOtNormalHours(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">OT Hours Worked</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={otHours}
                    onChange={e => setOtHours(e.target.value)}
                    className="w-full bg-surface-card border border-brand-500 rounded-xl px-3 py-2 text-xs font-mono font-black text-brand-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">OT Rate (₹ / Hour)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={otRate}
                    onChange={e => setOtRate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              {/* Real-time Computed Preview */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs font-mono">
                <span className="text-text-muted">Computed Payout ({otHours} hrs × ₹{otRate}):</span>
                <span className="font-black text-emerald-400 text-sm">₹{computedPreviewAmount}</span>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Notes / Task</label>
                <input
                  type="text"
                  value={otNotes}
                  onChange={e => setOtNotes(e.target.value)}
                  placeholder="e.g. Festival peak hour meat cutting & packing"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              {otError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {otError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordOvertimeMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  {recordOvertimeMutation.isPending ? 'Logging...' : 'Post Overtime'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
