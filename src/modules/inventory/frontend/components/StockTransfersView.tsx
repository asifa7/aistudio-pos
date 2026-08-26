import { useState } from 'react';
import { ArrowRightLeft, Plus, CheckCircle2, RefreshCw, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import StockTransferModal from './StockTransferModal';
import TransferReceiptModal from './TransferReceiptModal';
import BranchManagementModal from './BranchManagementModal';

export default function StockTransfersView() {
  const [isInitiateOpen, setIsInitiateOpen] = useState(false);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [selectedTransferForReceipt, setSelectedTransferForReceipt] = useState<any | null>(null);

  const { data: transfers, isLoading, refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_TRANSFERS, { status: 'all' });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-surface-panel p-4 border border-border-subtle rounded-2xl shadow-sm gap-3">
        <div>
          <h2 className="text-base font-extrabold text-text-primary flex items-center gap-2">
            <ArrowRightLeft className="text-brand-500" size={18} /> Multi-Branch Stock Transfers
          </h2>
          <p className="text-xs text-text-muted mt-0.5">Direct stock transfer between physical store branches (what went out and what went in).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsBranchesOpen(true)}
            className="px-3 py-2 bg-surface-card hover:bg-surface-panel border border-border-subtle text-text-primary rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Building2 size={14} className="text-brand-500" /> Manage Branches
          </button>

          <button
            onClick={() => setIsInitiateOpen(true)}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-colors"
          >
            <Plus size={15} /> Transfer Stock Now
          </button>
        </div>
      </div>

      {/* Transfers List Table */}
      <div className="border border-border-subtle rounded-2xl bg-surface-panel overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-text-muted flex justify-center items-center gap-2">
            <RefreshCw className="animate-spin text-brand-500" size={16} /> Loading stock transfers...
          </div>
        ) : !transfers || transfers.length === 0 ? (
          <div className="py-16 text-center text-xs text-text-muted">No stock transfers found. Click &quot;Transfer Stock Now&quot; to transfer items between branches.</div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-app text-text-muted font-bold text-[11px] uppercase tracking-wider border-b border-border-subtle">
              <tr>
                <th className="p-3.5">Transfer #</th>
                <th className="p-3.5">From Branch (Dispatched)</th>
                <th className="p-3.5">To Branch (Received)</th>
                <th className="p-3.5">Items Transferred</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-medium">
              {transfers.map((t: any) => {
                return (
                  <tr key={t.id} className="hover:bg-surface-hover">
                    <td className="p-3.5 font-mono font-bold text-brand-500">{t.transfer_number}</td>
                    <td className="p-3.5 font-bold text-text-primary">
                      <span className="text-rose-400">↑ Out: </span>{t.from_location_name}
                    </td>
                    <td className="p-3.5 font-bold text-text-primary">
                      <span className="text-emerald-400">↓ In: </span>{t.to_location_name}
                    </td>
                    <td className="p-3.5 text-text-secondary">
                      {t.items?.map((item: any) => (
                        <div key={item.id} className="font-mono text-[11px]">
                          {item.product_name} - {item.variant_name} ({item.sent_quantity_grams !== null ? `${(item.sent_quantity_grams/1000).toFixed(2)}kg` : `${item.sent_quantity_units}pcs`})
                        </div>
                      ))}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                        <CheckCircle2 size={12} /> Transferred
                      </span>
                    </td>
                    <td className="p-3.5 text-right text-text-muted font-mono text-[11px]">{new Date(t.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {isInitiateOpen && (
        <StockTransferModal
          isOpen={isInitiateOpen}
          onClose={() => { setIsInitiateOpen(false); refetch(); }}
        />
      )}

      {selectedTransferForReceipt && (
        <TransferReceiptModal
          isOpen={!!selectedTransferForReceipt}
          onClose={() => { setSelectedTransferForReceipt(null); refetch(); }}
          transfer={selectedTransferForReceipt}
        />
      )}

      {isBranchesOpen && (
        <BranchManagementModal
          isOpen={isBranchesOpen}
          onClose={() => setIsBranchesOpen(false)}
        />
      )}
    </div>
  );
}
