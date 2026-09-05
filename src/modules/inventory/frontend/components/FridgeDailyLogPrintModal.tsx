import React, { useState, useRef, useMemo } from 'react';
import { X, Printer, Calendar, RefreshCw, FileSpreadsheet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useFridgeActivityLog, FridgeActivityItem } from '../hooks/useRefrigeratorStock';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { AppConfig } from '../../../../core/shared/types';

interface FridgeDailyLogPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId?: number;
  branchName?: string;
}

export default function FridgeDailyLogPrintModal({
  isOpen,
  onClose,
  branchId = 1,
  branchName = 'Main Branch',
}: FridgeDailyLogPrintModalProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const printContainerRef = useRef<HTMLDivElement>(null);

  const { data: config } = useQuery<AppConfig>({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.CONFIG.GET);
      return res?.data;
    },
  });

  const { data: logs = [], isLoading, refetch, isFetching } = useFridgeActivityLog(branchId, 500, selectedDate);

  const shopName = config?.shopInfo?.name || 'MEAT SHOP POS';
  const shopAddress = config?.shopInfo?.address || '';
  const shopGSTIN = config?.shopInfo?.gstin || '';

  // Calculate Running Totals
  const { totalInKg, totalInPcs, totalOutKg, totalOutPcs, totalInCount, totalOutCount } = useMemo(() => {
    let inKg = 0;
    let inPcs = 0;
    let outKg = 0;
    let outPcs = 0;
    let inCount = 0;
    let outCount = 0;

    for (const item of logs) {
      const isDeposit = item.action_type === 'fridge_deposit' || (!item.action_type.includes('removal') && (item.notes || '').toLowerCase().includes('deposit'));
      const isWeight = item.unit_type === 'weight' || item.unit_type === 'live_dual' || item.quantity_grams != null;
      const qtyGrams = Math.abs(item.quantity_grams || 0);
      const qtyUnits = Math.abs(item.quantity_units || 0);

      if (isDeposit) {
        inCount++;
        if (isWeight) inKg += qtyGrams / 1000;
        else inPcs += qtyUnits;
      } else {
        outCount++;
        if (isWeight) outKg += qtyGrams / 1000;
        else outPcs += qtyUnits;
      }
    }

    return {
      totalInKg: Math.round(inKg * 1000) / 1000,
      totalInPcs: inPcs,
      totalOutKg: Math.round(outKg * 1000) / 1000,
      totalOutPcs: outPcs,
      totalInCount: inCount,
      totalOutCount: outCount,
    };
  }, [logs]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedHeaderDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0 bg-surface-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Print Daily Refrigerator Log Sheet</h2>
              <p className="text-xs text-text-muted">A4 physical reference log for cold storage in/out movements</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center gap-1.5 bg-surface-panel border border-border-subtle px-2.5 py-1 rounded-xl">
              <Calendar size={14} className="text-brand-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-mono font-bold text-text-primary outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              title="Refresh date logs"
              className="p-2 hover:bg-surface-hover rounded-xl text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Sheet (A4)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-surface-hover rounded-lg text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable A4 Document Preview */}
        <div className="p-6 overflow-y-auto flex-1 bg-surface-app flex justify-center">
          <div
            ref={printContainerRef}
            id="fridge-daily-log-sheet"
            className="w-full max-w-3xl bg-white text-black p-8 rounded-xl shadow-lg border border-slate-300 font-sans text-xs space-y-5"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Store Header & Document Title */}
            <div className="border-b-2 border-gray-800 pb-3 flex justify-between items-start">
              <div>
                <h1 className="text-lg font-black uppercase tracking-wider text-gray-900 leading-tight">
                  {shopName}
                </h1>
                {shopAddress && <div className="text-[11px] text-gray-600 mt-0.5">{shopAddress}</div>}
                {shopGSTIN && <div className="text-[10px] text-gray-600 font-mono">GSTIN: {shopGSTIN}</div>}
                <div className="text-[11px] text-gray-700 font-bold mt-1">Location: {branchName}</div>
              </div>

              <div className="text-right">
                <div className="inline-block px-3 py-1 bg-gray-100 border border-gray-300 rounded font-black text-xs uppercase tracking-wider text-gray-900">
                  DAILY REFRIGERATOR LOG
                </div>
                <div className="text-xs font-bold text-gray-900 mt-1.5">{formattedHeaderDate}</div>
                <div className="text-[10px] text-gray-500 font-mono">Generated: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-4 gap-3 bg-gray-50 p-2.5 rounded-lg border border-gray-300 text-center">
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">Total IN Entries</div>
                <div className="text-sm font-black text-emerald-700">{totalInCount} actions</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">Total Quantity IN</div>
                <div className="text-sm font-black text-emerald-700">
                  {totalInKg > 0 && `${totalInKg.toFixed(3)} kg`}
                  {totalInKg > 0 && totalInPcs > 0 && ' + '}
                  {totalInPcs > 0 && `${totalInPcs} pcs`}
                  {totalInKg === 0 && totalInPcs === 0 && '0 kg'}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">Total OUT Entries</div>
                <div className="text-sm font-black text-rose-700">{totalOutCount} actions</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-gray-500">Total Quantity OUT</div>
                <div className="text-sm font-black text-rose-700">
                  {totalOutKg > 0 && `${totalOutKg.toFixed(3)} kg`}
                  {totalOutKg > 0 && totalOutPcs > 0 && ' + '}
                  {totalOutPcs > 0 && `${totalOutPcs} pcs`}
                  {totalOutKg === 0 && totalOutPcs === 0 && '0 kg'}
                </div>
              </div>
            </div>

            {/* Log Table */}
            <div>
              {isLoading ? (
                <div className="py-12 text-center text-gray-500 italic">Loading movements for {selectedDate}...</div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  No refrigerator IN / OUT movements recorded on {selectedDate}.
                </div>
              ) : (
                <table className="w-full border-collapse text-left border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-[10px] font-black uppercase tracking-wider text-gray-800">
                      <th className="py-2 px-2.5 border-r border-gray-300 w-8 text-center">#</th>
                      <th className="py-2 px-2.5 border-r border-gray-300 w-18 text-center">Time</th>
                      <th className="py-2 px-2.5 border-r border-gray-300 w-16 text-center">Type</th>
                      <th className="py-2 px-2.5 border-r border-gray-300">Product / Item</th>
                      <th className="py-2 px-2.5 border-r border-gray-300 w-22 text-right">Quantity</th>
                      <th className="py-2 px-2.5 border-r border-gray-300">Purpose / Reason (for OUT)</th>
                      <th className="py-2 px-2.5 border-r border-gray-300 w-24">By</th>
                      <th className="py-2 px-2.5 w-24 text-right">Ref #</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((row, idx) => {
                      const isDeposit = row.action_type === 'fridge_deposit' || (!row.action_type.includes('removal') && (row.notes || '').toLowerCase().includes('deposit'));
                      const isWeight = row.unit_type === 'weight' || row.unit_type === 'live_dual' || row.quantity_grams != null;
                      const qty = isWeight
                        ? Math.abs(row.quantity_grams || 0) / 1000
                        : Math.abs(row.quantity_units || 0);
                      const unit = isWeight ? 'kg' : 'pcs';

                      const timeStr = new Date(row.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      });

                      // Extract clean reason from notes
                      let cleanReason = row.notes || (isDeposit ? 'Stock Added' : 'Taken Out');
                      if (cleanReason.startsWith('Fridge Take Out: ')) cleanReason = cleanReason.replace('Fridge Take Out: ', '');
                      if (cleanReason.startsWith('Fridge Deposit: ')) cleanReason = cleanReason.replace('Fridge Deposit: ', '');

                      return (
                        <tr
                          key={row.id || idx}
                          className={`border-b border-gray-200 text-[11px] ${
                            idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'
                          }`}
                        >
                          <td className="py-1.5 px-2.5 border-r border-gray-200 text-center font-mono text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200 text-center font-mono font-bold text-gray-800 whitespace-nowrap">
                            {timeStr}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200 text-center font-black">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black ${
                                isDeposit
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-rose-100 text-rose-800 border border-rose-300'
                              }`}
                            >
                              {isDeposit ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200">
                            <span className="font-bold text-gray-900">{row.product_name}</span>
                            {row.variant_name && row.variant_name !== 'Default' && (
                              <span className="text-gray-600 text-[10px]"> ({row.variant_name})</span>
                            )}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200 text-right font-mono font-black text-gray-900 whitespace-nowrap">
                            {qty.toFixed(isWeight ? 3 : 0)} {unit}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200 text-gray-700 text-[10px]">
                            {cleanReason}
                          </td>
                          <td className="py-1.5 px-2.5 border-r border-gray-200 text-gray-800 font-medium">
                            {row.user_name || 'Admin'}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-[9px] text-gray-600 whitespace-nowrap">
                            {row.reference_number || `#${row.id}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Summary Footer in Table */}
                  <tfoot>
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-black text-[11px] text-gray-900">
                      <td colSpan={4} className="py-2 px-2.5 text-right uppercase tracking-wider">
                        Running Daily Totals:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono">
                        <div className="text-emerald-700">IN: +{totalInKg.toFixed(3)} kg</div>
                        <div className="text-rose-700">OUT: -{totalOutKg.toFixed(3)} kg</div>
                      </td>
                      <td colSpan={3} className="py-2 px-2.5 text-[10px] text-gray-600">
                        Net Fridge Delta: <strong>{(totalInKg - totalOutKg).toFixed(3)} kg</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Signature & Posting Footnote */}
            <div className="pt-6 border-t border-gray-300 flex justify-between items-end text-[10px] text-gray-700">
              <div>
                <div className="h-8 w-36 border-b border-gray-400"></div>
                <div className="mt-1 font-bold">Store Supervisor Signature</div>
                <div className="text-[9px] text-gray-500">Date: {formattedHeaderDate}</div>
              </div>

              <div>
                <div className="h-8 w-36 border-b border-gray-400"></div>
                <div className="mt-1 font-bold">Inventory Auditor / Owner</div>
                <div className="text-[9px] text-gray-500">Verified & Reconciled</div>
              </div>

              <div className="text-right text-[9px] text-gray-400">
                <div>MeatPOS Fridge Log Control</div>
                <div>Keep on Physical Record / File</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-surface-card border-t border-border-subtle flex items-center justify-between text-xs">
          <div className="text-text-muted text-[11px]">
            Selected Date: <strong className="text-text-primary font-mono">{selectedDate}</strong> ({logs.length} movement records)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-surface-panel hover:bg-surface-hover text-text-primary rounded-xl text-xs font-semibold border border-border-subtle transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Printer size={14} />
              <span>Print Fridge Log (A4)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
