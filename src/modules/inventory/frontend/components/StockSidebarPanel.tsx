import { AlertTriangle, AlertCircle, CheckCircle2, RefreshCw, Truck } from 'lucide-react';
import { useSidebarSummary } from '../hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface StockSidebarPanelProps {
  onSelectItem?: (variantId: number) => void;
  onOpenTransfers?: () => void;
}

export default function StockSidebarPanel({ onSelectItem, onOpenTransfers }: StockSidebarPanelProps) {
  const { data: summary, isLoading, refetch } = useSidebarSummary();

  const { data: inTransitTransfers } = useQuery({
    queryKey: ['in-transit-transfers-count'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_TRANSFERS, { status: 'in_transit' });
      if (!res.success) return [];
      return res.data || [];
    },
  });

  const inTransitCount = inTransitTransfers?.length || 0;

  if (isLoading || !summary) {
    return (
      <div className="w-80 bg-surface-panel border border-border-subtle rounded-2xl p-4 flex items-center justify-center">
        <RefreshCw className="animate-spin text-brand-500" size={20} />
      </div>
    );
  }

  const { statusCounts, needsAttention } = summary;
  const total = statusCounts.total || 1;
  const okPct = Math.round((statusCounts.ok / total) * 100);
  const lowPct = Math.round((statusCounts.low / total) * 100);
  const criticalPct = Math.round((statusCounts.critical / total) * 100);

  return (
    <div className="w-80 flex flex-col gap-4 sticky top-0">
      {/* Pending / In-Transit Transfers Indicator */}
      {inTransitCount > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-2 shadow-sm text-amber-300">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Truck size={16} />
            </div>
            <div>
              <div className="font-bold text-xs">{inTransitCount} In-Transit Transfer(s)</div>
              <div className="text-[10px] opacity-80">Stock moving between locations</div>
            </div>
          </div>
          {onOpenTransfers && (
            <button
              onClick={onOpenTransfers}
              className="px-2.5 py-1 bg-amber-500 text-zinc-950 font-black rounded-lg text-[10px] uppercase hover:bg-amber-400 transition-colors shrink-0"
            >
              View
            </button>
          )}
        </div>
      )}

      {/* 1. Status Overview Bar / Donut Chart */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Stock Status Health</h3>
          <button onClick={() => refetch()} className="p-1 text-text-muted hover:text-text-primary transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Visual Multi-Segment Progress Bar */}
        <div className="h-3.5 w-full bg-surface-app rounded-full overflow-hidden flex mb-3 border border-border-subtle/40">
          <div style={{ width: `${okPct}%` }} className="bg-emerald-500 transition-all duration-500" title={`OK: ${statusCounts.ok}`} />
          <div style={{ width: `${lowPct}%` }} className="bg-amber-500 transition-all duration-500" title={`Low Stock: ${statusCounts.low}`} />
          <div style={{ width: `${criticalPct}%` }} className="bg-rose-500 transition-all duration-500" title={`Critical: ${statusCounts.critical}`} />
        </div>

        {/* Status Breakdown Legend */}
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center justify-center gap-1 text-emerald-400 font-bold">
              <CheckCircle2 size={12} />
              <span>{statusCounts.ok}</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 font-medium">Healthy</div>
          </div>

          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
              <AlertTriangle size={12} />
              <span>{statusCounts.low}</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 font-medium">Low Stock</div>
          </div>

          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center justify-center gap-1 text-rose-400 font-bold">
              <AlertCircle size={12} />
              <span>{statusCounts.critical}</span>
            </div>
            <div className="text-[10px] text-text-muted mt-0.5 font-medium">Critical</div>
          </div>
        </div>
      </div>

      {/* 2. Needs Attention (Top 5 lowest stock) */}
      <div className="bg-surface-panel border border-border-subtle rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} className="text-amber-400" />
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Needs Attention</h3>
        </div>

        {needsAttention.length === 0 ? (
          <p className="text-[11px] text-emerald-400 font-medium py-2 text-center bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            ✓ All item stock levels are healthy!
          </p>
        ) : (
          <div className="space-y-2">
            {needsAttention.map((item: any) => {
              const isWeight = item.unit_type === 'weight';
              const currentStr = isWeight ? `${(item.currentQty / 1000).toFixed(2)} kg` : `${item.currentQty} pcs`;
              const thresholdStr = isWeight ? `${(item.thresholdQty / 1000).toFixed(1)} kg` : `${item.thresholdQty} pcs`;

              return (
                <div
                  key={item.product_variant_id}
                  onClick={() => onSelectItem?.(item.product_variant_id)}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-surface-app border border-border-subtle hover:border-brand-500/50 cursor-pointer transition-all hover:bg-surface-hover"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-text-primary group-hover:text-brand-500 transition-colors truncate">
                      {item.product_name}
                    </div>
                    <div className="text-[10px] text-text-muted truncate">{item.variant_name}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono font-bold ${item.status === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {currentStr}
                    </div>
                    <div className="text-[9px] text-text-muted font-mono">Min: {thresholdStr}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}
