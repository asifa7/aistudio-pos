import { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Search, 
  RefreshCw, 
  Gift, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Target, 
  Award
} from 'lucide-react';
import { 
  useIncentives, 
  useIncentiveRules, 
  useCreateManualIncentive, 
  useCreateIncentiveRule, 
  useEvaluateRuleIncentives, 
  useEmployees 
} from '../hooks/useHR';

export default function IncentivesView() {
  const currentMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [searchTerm, setSearchTerm] = useState('');
  const [subTab, setSubTab] = useState<'log' | 'rules'>('log');

  // Modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [evalResultMsg, setEvalResultMsg] = useState<string | null>(null);

  // Queries
  const { data: rawIncentives = [], isLoading, isError, error, refetch: refetchIncentives } = useIncentives({
    monthYear: selectedMonth !== 'ALL' ? selectedMonth : undefined,
  });
  const incentives = useMemo(() => Array.isArray(rawIncentives) ? rawIncentives : [], [rawIncentives]);

  const { data: rawRules = [], refetch: refetchRules } = useIncentiveRules();
  const rules = useMemo(() => Array.isArray(rawRules) ? rawRules : [], [rawRules]);

  const { data: rawEmployees = [] } = useEmployees({ status: 'Active' });
  const activeEmployees = useMemo(() => Array.isArray(rawEmployees) ? rawEmployees : [], [rawEmployees]);

  const manualIncentiveMutation = useCreateManualIncentive();
  const ruleMutation = useCreateIncentiveRule();
  const evalMutation = useEvaluateRuleIncentives();

  // Manual Incentive Form State
  const [manEmpId, setManEmpId] = useState<number | ''>('');
  const [manAmount, setManAmount] = useState('');
  const [manDate, setManDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manReason, setManReason] = useState('Festival / Performance Bonus');
  const [manError, setManError] = useState<string | null>(null);

  // Rule Form State
  const [ruleName, setRuleName] = useState('');
  const [ruleType, setRuleType] = useState('sales_target');
  const [ruleTarget, setRuleTarget] = useState('500000');
  const [ruleReward, setRuleReward] = useState('2000');
  const [ruleDesc, setRuleDesc] = useState('');
  const [ruleError, setRuleError] = useState<string | null>(null);

  const filteredIncentives = useMemo(() => {
    return incentives.filter(i => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = i.full_name?.toLowerCase().includes(q);
        const matchCode = i.emp_code?.toLowerCase().includes(q);
        const matchReason = i.reason?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchReason) return false;
      }
      return true;
    });
  }, [incentives, searchTerm]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManError(null);

    if (!manEmpId) {
      setManError('Please select an employee.');
      return;
    }
    const amtNum = parseFloat(manAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setManError('Please enter a valid amount.');
      return;
    }
    if (!manReason.trim()) {
      setManError('Please enter a reason or occasion.');
      return;
    }

    try {
      await manualIncentiveMutation.mutateAsync({
        employee_id: Number(manEmpId),
        amount_paise: Math.round(amtNum * 100),
        incentive_date: manDate,
        reason: manReason.trim(),
      });

      setIsManualModalOpen(false);
      setManAmount('');
      refetchIncentives();
    } catch (err: any) {
      setManError(err.message || 'Failed to record incentive.');
    }
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleError(null);

    if (!ruleName.trim()) {
      setRuleError('Please enter rule name.');
      return;
    }
    const targetNum = parseFloat(ruleTarget);
    const rewardNum = parseFloat(ruleReward);
    if (isNaN(targetNum) || isNaN(rewardNum) || rewardNum <= 0) {
      setRuleError('Please enter valid target and reward values.');
      return;
    }

    const targetVal = ruleType === 'sales_target' ? Math.round(targetNum * 100) : targetNum;

    try {
      await ruleMutation.mutateAsync({
        rule_name: ruleName.trim(),
        rule_type: ruleType,
        target_value: targetVal,
        reward_amount_paise: Math.round(rewardNum * 100),
        description: ruleDesc.trim() || undefined,
      });

      setIsRuleModalOpen(false);
      setRuleName('');
      setRuleDesc('');
      refetchRules();
    } catch (err: any) {
      setRuleError(err.message || 'Failed to create rule.');
    }
  };

  const handleEvaluateRules = async () => {
    const targetMonth = selectedMonth === 'ALL' ? new Date().toISOString().slice(0, 7) : selectedMonth;

    try {
      const res = await evalMutation.mutateAsync(targetMonth);
      setEvalResultMsg(`Evaluated targets for ${targetMonth}: Awarded ${res.processed} rule-based incentive(s)!`);
      refetchIncentives();
      setTimeout(() => setEvalResultMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to evaluate rules.');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3.5 rounded-2xl flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Sub-tab switcher */}
          <div className="flex items-center bg-surface-panel p-1 rounded-xl border border-border-subtle">
            <button
              onClick={() => setSubTab('log')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'log'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Award size={13} />
              <span>Incentives Log</span>
            </button>

            <button
              onClick={() => setSubTab('rules')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'rules'
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Sliders size={13} />
              <span>Incentive Rules ({rules.length})</span>
            </button>
          </div>

          {subTab === 'log' && (
            <>
              <div className="relative min-w-[200px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search incentives..."
                  className="w-full bg-surface-panel border border-border-subtle rounded-xl pl-8 pr-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted outline-none font-bold"
                />
              </div>

              <input
                type="month"
                value={selectedMonth === 'ALL' ? '' : selectedMonth}
                onChange={e => setSelectedMonth(e.target.value || 'ALL')}
                className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'log' && (
            <button
              onClick={handleEvaluateRules}
              disabled={evalMutation.isPending}
              className="px-3.5 py-2 bg-purple-500/15 hover:bg-purple-500 text-purple-400 hover:text-white border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Automatically evaluate sales & attendance targets for active staff"
            >
              <Sparkles size={14} />
              <span>{evalMutation.isPending ? 'Evaluating...' : 'Evaluate Rules for Month'}</span>
            </button>
          )}

          {subTab === 'rules' ? (
            <button
              onClick={() => setIsRuleModalOpen(true)}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add Incentive Rule</span>
            </button>
          ) : (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Gift size={14} />
              <span>Award Manual Incentive</span>
            </button>
          )}

          <button
            onClick={() => {
              refetchIncentives();
              refetchRules();
            }}
            className="p-2 bg-surface-panel hover:bg-surface-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-xl transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {evalResultMsg && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 flex-shrink-0 animate-in fade-in">
          <CheckCircle2 size={14} />
          <span>{evalResultMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      {subTab === 'log' ? (
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted text-xs">Loading incentive records...</div>
          ) : isError ? (
            <div className="p-12 text-center space-y-2 text-rose-400">
              <AlertCircle size={32} className="mx-auto" />
              <div className="text-sm font-bold">Failed to load incentives</div>
              <p className="text-xs text-text-muted">{error instanceof Error ? error.message : 'Database error'}</p>
            </div>
          ) : filteredIncentives.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Gift size={36} className="mx-auto text-text-muted/50" />
              <div className="text-sm font-bold text-text-secondary">No Incentives Awarded for {selectedMonth}</div>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Click &quot;Award Manual Incentive&quot; or &quot;Evaluate Rules for Month&quot; to calculate target rewards.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold z-10">
                  <tr>
                    <th className="py-3 px-4">EMPLOYEE / ID</th>
                    <th className="py-3 px-4">AWARD DATE</th>
                    <th className="py-3 px-4 text-center">TYPE</th>
                    <th className="py-3 px-4">REASON / RULE</th>
                    <th className="py-3 px-4 text-right text-emerald-400 font-extrabold">AMOUNT (CREDIT)</th>
                    <th className="py-3 px-4 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {filteredIncentives.map(inc => {
                    const isRuleBased = inc.incentive_type === 'rule_based';

                    return (
                      <tr key={inc.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-bold text-text-primary text-xs">{inc.full_name}</div>
                          <div className="text-[10px] text-text-muted font-mono mt-0.5">
                            {inc.emp_code} • {inc.department}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-text-primary">
                          {inc.incentive_date}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isRuleBased
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {isRuleBased ? <Sparkles size={10} /> : <Gift size={10} />}
                            <span>{isRuleBased ? 'Rule-Based' : 'Manual Bonus'}</span>
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-text-secondary max-w-[280px] truncate" title={inc.reason}>
                          {inc.reason}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-400 text-xs">
                          +₹{(inc.amount_paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
      ) : (
        /* Rules View */
        <div className="bg-surface-card border border-border-subtle rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col p-4 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Configured Performance Rules</h3>
            <span className="text-xs text-text-muted">Target evaluation runs against live sales & attendance records.</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rules.map(r => {
              const targetDisplay = r.rule_type === 'sales_target' 
                ? `Monthly Sales ≥ ₹${(r.target_value / 100).toLocaleString('en-IN')}` 
                : r.rule_type === 'attendance_target'
                ? `Monthly Worked Days ≥ ${r.target_value} days`
                : `Target: ${r.target_value}`;

              return (
                <div key={r.id} className="p-4 rounded-2xl bg-surface-panel border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text-primary flex items-center gap-2">
                      <Target size={15} className="text-brand-500" />
                      <span>{r.rule_name}</span>
                    </span>
                    <span className="font-mono font-black text-emerald-400 text-xs px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      ₹{(r.reward_amount_paise / 100).toFixed(2)} Reward
                    </span>
                  </div>

                  <p className="text-xs text-text-secondary">{r.description || 'Automatic monthly evaluation.'}</p>

                  <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-brand-400 font-bold">{targetDisplay}</span>
                    <span className="text-text-muted uppercase text-[10px]">{r.rule_type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Award Manual Incentive Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Gift size={16} />
                </div>
                <h3 className="text-sm font-black text-text-primary">Award Manual Incentive / Bonus</h3>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Select Employee</label>
                <select
                  value={manEmpId}
                  onChange={e => setManEmpId(Number(e.target.value) || '')}
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
                  <label className="font-bold text-text-secondary block mb-1">Incentive Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={manAmount}
                    onChange={e => setManAmount(e.target.value)}
                    placeholder="e.g. 2000"
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">Award Date</label>
                  <input
                    type="date"
                    value={manDate}
                    onChange={e => setManDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Reason / Occasion</label>
                <textarea
                  rows={2}
                  value={manReason}
                  onChange={e => setManReason(e.target.value)}
                  placeholder="e.g. Eid / Diwali Festival Bonus or Exceptional Cutting Yield"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                  required
                />
              </div>

              {manError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {manError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualIncentiveMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  {manualIncentiveMutation.isPending ? 'Posting...' : 'Credit Incentive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Incentive Rule Modal */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-sm font-black text-text-primary">Configure Incentive Rule</h3>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRuleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-text-secondary block mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={e => setRuleName(e.target.value)}
                  placeholder="e.g. Monthly Shop Sales > ₹6 Lakhs"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-text-secondary block mb-1">Rule Type</label>
                  <select
                    value={ruleType}
                    onChange={e => setRuleType(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-bold text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="sales_target">Sales Target (₹)</option>
                    <option value="attendance_target">Attendance Days Worked</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-secondary block mb-1">
                    Target Threshold ({ruleType === 'sales_target' ? '₹' : 'Days'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={ruleTarget}
                    onChange={e => setRuleTarget(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Reward Payout Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={ruleReward}
                  onChange={e => setRuleReward(e.target.value)}
                  placeholder="e.g. 2000"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-text-secondary block mb-1">Description</label>
                <textarea
                  rows={2}
                  value={ruleDesc}
                  onChange={e => setRuleDesc(e.target.value)}
                  placeholder="e.g. Awarded to all active team members when store target is achieved"
                  className="w-full bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs text-text-primary outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {ruleError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {ruleError}
                </div>
              )}

              <div className="pt-2 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="px-4 py-2 bg-surface-card hover:bg-surface-hover text-text-muted rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ruleMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl font-bold shadow-md shadow-brand-500/20"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
