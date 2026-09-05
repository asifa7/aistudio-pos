import React, { useRef } from 'react';
import { X, Printer, ArrowDownLeft, ArrowUpRight, Snowflake, CheckCircle2 } from 'lucide-react';
import { FridgeSlipData } from '../hooks/useRefrigeratorStock';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import type { AppConfig } from '../../../../core/shared/types';

interface FridgeSlipPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  slip: FridgeSlipData | null;
}

export default function FridgeSlipPrintModal({ isOpen, onClose, slip }: FridgeSlipPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: config } = useQuery<AppConfig>({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.CONFIG.GET);
      return res?.data;
    },
  });

  if (!isOpen || !slip) return null;

  const isDeposit = slip.action_type === 'IN';
  const shopName = config?.shopInfo?.name || 'MEAT SHOP POS';
  const shopAddress = config?.shopInfo?.address || 'Fresh Meat & Poultry Wholesale / Retail';
  const shopPhone = config?.shopInfo?.phone || '';

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(slip.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = new Date(slip.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0 bg-surface-card">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isDeposit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {isDeposit ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                <span>Refrigerator {isDeposit ? 'Stock IN' : 'Stock OUT'} Slip</span>
              </h2>
              <p className="text-[11px] text-text-muted font-mono">{slip.reference_number}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* Printable Slip Paper Preview Container */}
        <div className="p-4 overflow-y-auto flex-1 bg-surface-app">
          <div
            ref={printRef}
            id="fridge-printable-slip"
            className="p-5 bg-white text-black rounded-xl border border-slate-300 shadow-md font-sans space-y-3.5 text-xs max-w-sm mx-auto"
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            {/* Store Banner */}
            <div className="text-center border-b border-dashed border-gray-400 pb-2.5">
              <div className="font-black text-sm uppercase tracking-wide text-gray-900">{shopName}</div>
              {shopAddress && <div className="text-[10px] text-gray-600 mt-0.5 leading-tight">{shopAddress}</div>}
              {shopPhone && <div className="text-[10px] text-gray-600">Ph: {shopPhone}</div>}
              <div className="inline-block mt-2 px-2.5 py-0.5 rounded font-black text-[10px] uppercase tracking-wider bg-gray-100 text-gray-900 border border-gray-300">
                {isDeposit ? '❄️ REFRIGERATOR STOCK IN' : '❄️ REFRIGERATOR STOCK OUT'}
              </div>
            </div>

            {/* Reference & Time Row */}
            <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-dashed border-gray-300 pb-2">
              <div>
                <span className="text-gray-500 text-[10px] block">Ref Number:</span>
                <strong className="font-mono text-gray-900">{slip.reference_number}</strong>
              </div>
              <div className="text-right">
                <span className="text-gray-500 text-[10px] block">Date / Time:</span>
                <span className="font-mono font-bold text-gray-900">
                  {formattedDate} {formattedTime}
                </span>
              </div>
              <div>
                <span className="text-gray-500 text-[10px] block">Ledger ID:</span>
                <span className="font-mono text-gray-700">#{slip.ledger_id}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 text-[10px] block">{isDeposit ? 'Added By:' : 'Taken By:'}</span>
                <strong className="text-gray-900">{slip.user_name}</strong>
              </div>
            </div>

            {/* Product & Quantity Highlight Box */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-300 space-y-1.5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Product Item:</span>
                  <div className="font-black text-sm text-gray-900 leading-tight">
                    {slip.product_name}
                    {slip.variant_name && slip.variant_name !== 'Default' && ` (${slip.variant_name})`}
                  </div>
                  {slip.product_code && (
                    <span className="text-[10px] font-mono text-gray-500">Code: {slip.product_code}</span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                <span className="font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                  {isDeposit ? 'Quantity Put In:' : 'Quantity Taken Out:'}
                </span>
                <span className="font-mono font-black text-base text-gray-900">
                  {slip.quantity.toFixed(slip.unit === 'kg' ? 3 : 0)} {slip.unit}
                </span>
              </div>
            </div>

            {/* Reason / Purpose (for OUT) or Batch Details (for IN) */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-gray-300 pb-2">
              <div className="flex justify-between">
                <span className="text-gray-500">{isDeposit ? 'Purpose / Note:' : 'Reason / Destination:'}</span>
                <strong className="text-gray-900 text-right">{slip.reason || 'General'}</strong>
              </div>
              {slip.batch_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Batch Code:</span>
                  <span className="font-mono text-gray-800">{slip.batch_number}</span>
                </div>
              )}
            </div>

            {/* Footer Signatures */}
            <div className="pt-3 flex justify-between items-end text-[10px] text-gray-600">
              <div>
                <div className="h-6 w-24 border-b border-gray-400"></div>
                <span className="mt-0.5 block">Staff Signature</span>
              </div>
              <div className="text-right">
                <div className="h-6 w-24 border-b border-gray-400 ml-auto"></div>
                <span className="mt-0.5 block">Verified by (Supervisor)</span>
              </div>
            </div>

            <div className="text-[9px] text-center text-gray-400 pt-1">
              MeatPOS Refrigerator Ledger Tracking System
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-surface-card border-t border-border-subtle flex items-center justify-between text-xs">
          <span className="text-text-muted text-[11px]">
            Matching Ledger ID: <strong className="font-mono text-text-secondary">#{slip.ledger_id}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-surface-panel hover:bg-surface-hover text-text-primary rounded-xl text-xs font-semibold border border-border-subtle transition-colors cursor-pointer"
            >
              Done
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Slip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
