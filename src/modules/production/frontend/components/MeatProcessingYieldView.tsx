import React, { useState } from 'react';
import { Drumstick, Scale, RefreshCw, Plus, Trash2, CheckCircle2, History, Layers, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { useStockStatus } from '../../../inventory/frontend/hooks/useInventory';
import DailyReconciliationPromptModal from '../../../inventory/frontend/components/DailyReconciliationPromptModal';

interface OutputRow {
  output_variant_id: string;
  quantity: string;
  cost_share_percent: string;
}

export default function MeatProcessingYieldView() {
  const queryClient = useQueryClient();
  const { data: stocks } = useStockStatus();

  // Active Tab: Calculator / Workstation vs Yield History
  const [activeTab, setActiveTab] = useState<'workstation' | 'history'>('workstation');
  const [isDailyReconciliationOpen, setIsDailyReconciliationOpen] = useState(false);

  // Input State
  const [rawVariantId, setRawVariantId] = useState<string>('');
  const [rawQuantity, setRawQuantity] = useState<string>('10');
  const [inputCount, setInputCount] = useState<string>('5');
  const [wastageQty, setWastageQty] = useState<string>('3.5');
  const [notes, setNotes] = useState<string>('');

  // Output Cuts State
  const [outputs, setOutputs] = useState<OutputRow[]>([
    { output_variant_id: '', quantity: '4.5', cost_share_percent: '' },
    { output_variant_id: '', quantity: '2.0', cost_share_percent: '' },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Yield runs query
  const { data: yieldRuns, isLoading: isLoadingRuns, refetch: refetchRuns } = useQuery({
    queryKey: ['yield-runs-list'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_YIELD_RUNS, {});
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    enabled: activeTab === 'history',
  });

  // Execute Yield Mutation
  const executeYieldMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.EXECUTE_YIELD, payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const handleAddOutputRow = () => {
    setOutputs(prev => [...prev, { output_variant_id: '', quantity: '1', cost_share_percent: '' }]);
  };

  const handleRemoveOutputRow = (index: number) => {
    if (outputs.length <= 1) return;
    setOutputs(prev => prev.filter((_, i) => i !== index));
  };

  const handleOutputFieldChange = (index: number, field: keyof OutputRow, val: string) => {
    setOutputs(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Metric Calculations
  const rawQtyNum = parseFloat(rawQuantity) || 0;
  const wastageNum = parseFloat(wastageQty) || 0;
  const expectedYieldNum = Math.max(0, rawQtyNum * 0.65); // Default 35% waste estimate

  let totalCutQtyNum = 0;
  outputs.forEach(o => {
    totalCutQtyNum += parseFloat(o.quantity) || 0;
  });

  const totalAccountedQty = totalCutQtyNum + wastageNum;
  const unaccountedVariance = rawQtyNum - totalAccountedQty;
  const isReconciled = rawQtyNum > 0 && Math.abs(unaccountedVariance) <= 0.050; // 50g tolerance

  const recoveryPct = rawQtyNum > 0 ? ((totalCutQtyNum / rawQtyNum) * 100).toFixed(1) : '0.0';

  const selectedRawItem = (stocks || []).find((s: any) => String(s.product_variant_id) === rawVariantId);
  const rawUnitLabel = (selectedRawItem?.unit_type === 'weight' || selectedRawItem?.unit_type === 'live_dual') ? 'kg' : 'pcs';

  const handleSubmitYieldRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!rawVariantId) {
      setErrorMsg('Please select a raw carcass input item');
      return;
    }
    if (rawQtyNum <= 0) {
      setErrorMsg('Raw input quantity must be greater than zero');
      return;
    }
    if (!isReconciled) {
      setErrorMsg(`Unaccounted weight variance of ${Math.abs(unaccountedVariance).toFixed(3)} kg detected. Input weight (${rawQtyNum.toFixed(3)} kg) must reconcile to sum of output cuts + wastage (${totalAccountedQty.toFixed(3)} kg) within 50g tolerance.`);
      return;
    }

    const outputPayload = outputs.map(o => {
      const q = parseFloat(o.quantity);
      const c = parseFloat(o.cost_share_percent);
      return {
        output_variant_id: parseInt(o.output_variant_id),
        quantity: !isNaN(q) ? q : 0,
        cost_share_percent: !isNaN(c) && c > 0 ? c : undefined,
      };
    }).filter(o => o.output_variant_id && o.quantity > 0);

    if (outputPayload.length === 0) {
      setErrorMsg('Please select at least one output cut product and valid quantity');
      return;
    }

    try {
      const res = await executeYieldMutation.mutateAsync({
        raw_input_variant_id: parseInt(rawVariantId),
        input_quantity: rawQtyNum,
        input_count: selectedRawItem?.unit_type === 'live_dual' ? parseFloat(inputCount) : undefined,
        wastage_quantity: wastageNum,
        outputs: outputPayload,
        notes: notes.trim() || undefined,
      });

      setSuccessMsg(`Yield Run #${res.runNumber} executed successfully! Created ${res.outputs.length} cut batches and logged ${wastageNum} ${rawUnitLabel} wastage.`);
      queryClient.invalidateQueries({ queryKey: ['stock-status'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments'] });

      // Reset form
      setNotes('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to execute yield processing run');
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-app text-text-primary p-6 space-y-5 overflow-hidden">
      {/* Header & Tabs */}
      <div className="border-b border-border-subtle pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
            <Drumstick className="text-brand-500" size={24} />
            <span>Meat Processing & Yield Breakdown Workstation</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Process whole carcass inputs into saleable cuts, allocate FIFO batch costs, and reconcile input weight to cut output + waste.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsDailyReconciliationOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <ShieldAlert size={14} /> Reconcile Today
          </button>

          <div className="flex bg-surface-panel border border-border-subtle p-1 rounded-xl shrink-0 gap-1">
            <button
              onClick={() => setActiveTab('workstation')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'workstation' ? 'bg-brand-500 text-white shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Scale size={14} /> Yield Workstation
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'history' ? 'bg-brand-500 text-white shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <History size={14} /> Processing Audit Log
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'history' ? (
        /* History View */
        <div className="flex-1 bg-surface-panel border border-border-subtle rounded-2xl p-4 overflow-y-auto min-h-0 shadow-elevation">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-text-primary">Yield Processing Run History</h3>
            <button onClick={() => refetchRuns()} className="p-1.5 rounded-lg bg-surface-card hover:bg-surface-hover text-text-muted hover:text-text-primary">
              <RefreshCw size={14} />
            </button>
          </div>

          {isLoadingRuns ? (
            <div className="py-12 text-center text-xs text-text-muted flex justify-center items-center gap-2">
              <RefreshCw className="animate-spin text-brand-500" size={16} /> Loading yield run history...
            </div>
          ) : !yieldRuns || yieldRuns.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">No yield processing runs recorded yet.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-text-muted font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Run Number</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Raw Carcass Input</th>
                  <th className="py-2.5 px-3 text-right">Input Qty</th>
                  <th className="py-2.5 px-3 text-right">Processing Loss</th>
                  <th className="py-2.5 px-3">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 font-mono">
                {yieldRuns.map((r: any) => (
                  <tr key={r.id} className="hover:bg-surface-hover">
                    <td className="py-2.5 px-3 font-bold text-brand-500">{r.run_number}</td>
                    <td className="py-2.5 px-3 text-text-muted text-[11px]">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-sans font-bold text-text-primary">{r.raw_product_name} ({r.raw_variant_name})</td>
                    <td className="py-2.5 px-3 text-right font-bold text-text-primary">
                      {r.input_quantity_grams ? `${(r.input_quantity_grams/1000).toFixed(2)} kg` : `${r.input_quantity_units} pcs`}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400 font-bold">
                      {r.wastage_quantity_grams ? `${(r.wastage_quantity_grams/1000).toFixed(2)} kg` : `${r.wastage_quantity_units} pcs`}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-text-secondary">{r.processed_by_user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* Workstation Form View */
        <form onSubmit={handleSubmitYieldRun} className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden">
          {/* Left Column: Inputs & Output Cuts */}
          <div className="lg:col-span-8 bg-surface-panel border border-border-subtle rounded-2xl p-5 overflow-y-auto space-y-4 shadow-elevation flex flex-col">
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-2 border-b border-border-subtle pb-2">
              <Scale size={15} className="text-brand-500" /> Whole Carcass Batch Input & Processing Loss
            </h3>

            {/* Input Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-text-muted uppercase">Select Raw Carcass Input *</label>
                <select
                  value={rawVariantId}
                  onChange={e => setRawVariantId(e.target.value)}
                  required
                  className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="">-- Select Raw Item --</option>
                  {(stocks || []).map((s: any) => (
                    <option key={s.product_variant_id} value={s.product_variant_id}>
                      {s.product_name} - {s.variant_name} ({s.unit_type === 'live_dual' ? `${s.quantity_count ?? 0} pcs / ${((s.quantity_grams ?? 0)/1000).toFixed(2)} kg available` : s.unit_type === 'weight' ? `${((s.quantity_grams ?? 0)/1000).toFixed(2)} kg` : `${s.quantity_units ?? 0} pcs`})
                    </option>
                  ))}
                </select>
              </div>

              {selectedRawItem?.unit_type === 'live_dual' ? (
                <div className="sm:col-span-1 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-brand-400 uppercase">Count (birds) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="e.g. 2"
                      value={inputCount}
                      onChange={e => setInputCount(e.target.value)}
                      required
                      className="w-full bg-surface-app border border-brand-500/50 rounded-xl px-3 py-2 text-xs font-mono font-bold text-brand-300 outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-text-muted uppercase">Weight (kg) *</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={rawQuantity}
                      onChange={e => setRawQuantity(e.target.value)}
                      required
                      className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-text-muted uppercase">Input Quantity ({rawUnitLabel}) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={rawQuantity}
                    onChange={e => setRawQuantity(e.target.value)}
                    required
                    className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </div>

            {/* Output Cuts Builder */}
            <div className="pt-3 space-y-2 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Output Cuts Created (Saleable Products) *
                </label>
                <button
                  type="button"
                  onClick={handleAddOutputRow}
                  className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-500 hover:bg-brand-500 hover:text-white text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <Plus size={12} /> Add Output Cut
                </button>
              </div>

              <div className="space-y-2">
                {outputs.map((outRow, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-surface-app p-2.5 rounded-xl border border-border-subtle">
                    <div className="flex-1">
                      <select
                        value={outRow.output_variant_id}
                        onChange={e => handleOutputFieldChange(idx, 'output_variant_id', e.target.value)}
                        className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary outline-none focus:border-brand-500"
                      >
                        <option value="">-- Select Output Cut --</option>
                        {(stocks || []).map((s: any) => (
                          <option key={s.product_variant_id} value={s.product_variant_id}>
                            {s.product_name} - {s.variant_name} ({s.unit_type})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder={`Qty (${rawUnitLabel})`}
                        value={outRow.quantity}
                        onChange={e => handleOutputFieldChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-surface-card border border-border-subtle rounded-lg px-2 py-1.5 text-right font-mono font-bold text-text-primary text-xs outline-none focus:border-brand-500"
                      />
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="Cost % (Auto)"
                        value={outRow.cost_share_percent}
                        onChange={e => handleOutputFieldChange(idx, 'cost_share_percent', e.target.value)}
                        className="w-full bg-surface-card border border-border-subtle rounded-lg px-2 py-1.5 text-right font-mono text-xs text-text-muted outline-none focus:border-brand-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveOutputRow(idx)}
                      disabled={outputs.length <= 1}
                      className="p-1.5 text-text-muted hover:text-rose-400 transition-colors disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Processing Loss / Wastage Input */}
            <div className="pt-2 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-rose-400 uppercase">Processing Loss / Shrinkage Waste ({rawUnitLabel})</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={wastageQty}
                  onChange={e => setWastageQty(e.target.value)}
                  className="w-full bg-surface-app border border-rose-500/30 rounded-xl px-3 py-1.5 font-mono font-bold text-rose-400 text-xs outline-none focus:border-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-text-muted uppercase">Notes / Batch Remarks (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Carcass de-boning batch #23..."
                  className="w-full bg-surface-app border border-border-subtle rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {errorMsg && <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-semibold">{errorMsg}</div>}
            {successMsg && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold flex items-center gap-1.5"><CheckCircle2 size={15} /> {successMsg}</div>}

            <div className="pt-2 mt-auto">
              <button
                type="submit"
                disabled={executeYieldMutation.isPending}
                className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={15} />
                {executeYieldMutation.isPending ? 'Executing Conversion...' : 'Execute Yield Stock Conversion Batch'}
              </button>
            </div>
          </div>

          {/* Right Column: Calculated Yield & Recovery Analytics */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-surface-panel border border-border-subtle rounded-2xl p-5 space-y-4 shadow-elevation">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle pb-2">
                Yield Efficiency & Recovery Analytics
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-app border border-border-subtle rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted">Saleable Cuts Qty</span>
                  <p className="text-xl font-black font-mono text-brand-500">{totalCutQtyNum.toFixed(2)} {rawUnitLabel}</p>
                </div>

                <div className="bg-surface-app border border-border-subtle rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted">Yield Recovery %</span>
                  <p className="text-xl font-black font-mono text-emerald-400">{recoveryPct}%</p>
                </div>

                <div className="bg-surface-app border border-border-subtle rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted">Processing Loss</span>
                  <p className="text-xl font-black font-mono text-rose-400">{wastageNum.toFixed(2)} {rawUnitLabel}</p>
                </div>

                <div className="bg-surface-app border border-border-subtle rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-text-muted">Expected Yield (65% Est)</span>
                  <p className="text-xl font-black font-mono text-amber-400">{expectedYieldNum.toFixed(2)} {rawUnitLabel}</p>
                </div>
              </div>

              {/* Live Weight Reconciliation Status Card */}
              <div className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                isReconciled
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-400'
              }`}>
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {isReconciled ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    {isReconciled ? 'Weight Reconciled' : 'Unaccounted Variance'}
                  </span>
                  <span className="font-mono text-[11px]">
                    {isReconciled ? '±50g OK' : `${Math.abs(unaccountedVariance).toFixed(3)} ${rawUnitLabel}`}
                  </span>
                </div>
                <p className="text-[10px] text-text-muted">
                  {isReconciled
                    ? `Input carcass (${rawQtyNum.toFixed(2)} ${rawUnitLabel}) reconciles to output cuts (${totalCutQtyNum.toFixed(2)} ${rawUnitLabel}) + waste (${wastageNum.toFixed(2)} ${rawUnitLabel}).`
                    : `Adjust cut output weights or processing loss so total accounted weight (${totalAccountedQty.toFixed(2)} ${rawUnitLabel}) matches raw input (${rawQtyNum.toFixed(2)} ${rawUnitLabel}).`
                  }
                </p>
              </div>

              <div className="p-3 bg-surface-app rounded-xl border border-border-subtle text-[11px] text-text-muted space-y-1">
                <div className="font-bold text-text-primary flex items-center gap-1">
                  <Layers size={13} className="text-brand-500" /> Batch FIFO Rules Active
                </div>
                <p>Output cuts receive allocated batch costs. Processing loss logs automatically into Phase 1 wastage audit.</p>
              </div>
            </div>
          </div>
        </form>
      )}

      <DailyReconciliationPromptModal
        isOpen={isDailyReconciliationOpen}
        onClose={() => setIsDailyReconciliationOpen(false)}
      />
    </div>
  );
}
