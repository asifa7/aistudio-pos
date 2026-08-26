import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowRightLeft, 
  Calendar, 
  Filter, 
  MapPin, 
  Download, 
  FileSpreadsheet
} from 'lucide-react';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { exportToCSV } from '../../../../core/shared/csv_exporter';

export default function InventoryReportsView() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Locations query
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_LOCATIONS, {});
      return res.success ? (res.data || []) : [];
    },
  });

  // Stock Movement Query
  const { data: movementData, isLoading: isLoadingMovement } = useQuery({
    queryKey: ['stock-movement', startDate, endDate, selectedLocationId, selectedCategory],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_MOVEMENT_REPORT, {
        startDate,
        endDate,
        location_id: selectedLocationId,
        category: selectedCategory,
      });
      return res.success ? res.data : null;
    }
  });

  const categories = ['All', 'Fresh Cuts', 'Meat', 'Seafood', 'Vegetables'];

  const handleExportMovementCSV = () => {
    if (!movementData) return;
    const headers = ['Timestamp', 'Product', 'Variant', 'Category', 'Type', 'Action', 'Qty', 'Reference'];
    const rows = (movementData.movements || []).map((m: any) => [
      new Date(m.timestamp).toLocaleString(),
      m.product_name,
      m.variant_name,
      m.category,
      m.movement_type,
      m.action_kind,
      m.unit_type === 'weight' ? `${((m.quantity_grams || 0)/1000).toFixed(3)} kg` : `${m.quantity_units || 0} pcs`,
      m.reference,
    ]);
    exportToCSV(`stock_movement_report_${startDate}_to_${endDate}`, headers, rows);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6 bg-surface-app text-text-primary">
      {/* Header & Global Filters */}
      <div className="border-b border-border-subtle pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="text-brand-500" />
          <div>
            <h2 className="text-lg font-bold">Stock Movement Log</h2>
            <p className="text-xs text-text-muted">Pure audit trail of all stock ins and outs.</p>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-surface-panel border border-border-subtle p-2 rounded-xl text-xs">
          {/* Date Range Picker */}
          <div className="flex items-center gap-1.5 pr-2 border-r border-border-subtle">
            <Calendar size={13} className="text-text-muted" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-surface-card border border-border-subtle rounded-md px-2 py-1 text-text-primary font-medium outline-none"
            />
            <span className="text-text-muted font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-surface-card border border-border-subtle rounded-md px-2 py-1 text-text-primary font-medium outline-none"
            />
          </div>

          {/* Location Filter */}
          <div className="flex items-center gap-1.5 px-2 border-r border-border-subtle">
            <MapPin size={13} className="text-brand-500" />
            <select
              value={selectedLocationId}
              onChange={e => setSelectedLocationId(e.target.value)}
              className="bg-transparent text-text-primary font-bold outline-none cursor-pointer"
            >
              <option value="all">All Locations</option>
              {(locations || []).map((loc: any) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 px-2">
            <Filter size={13} className="text-text-muted" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-transparent text-text-primary font-bold outline-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportMovementCSV}
            className="ml-auto px-3 py-1.5 bg-brand-500 text-white rounded-lg font-bold flex items-center gap-1 hover:bg-brand-600 transition-all shadow-subtle"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {isLoadingMovement ? (
        <div className="flex-1 flex items-center justify-center text-text-muted text-xs">Loading movement ledger...</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Variant Opening / Net Change / Closing Summaries */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-elevation space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-brand-500" />
              Variant Balance Summary ({movementData?.variantSummaries?.length || 0} variants active in period)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-card border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Variant</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Opening Qty</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400">Total IN</th>
                    <th className="py-2.5 px-3 text-right text-rose-400">Total OUT</th>
                    <th className="py-2.5 px-3 text-right">Net Change</th>
                    <th className="py-2.5 px-3 text-right font-bold">Closing Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 font-mono text-[11px]">
                  {(movementData?.variantSummaries || []).map((vs: any) => {
                    const isWeight = vs.unit_type === 'weight';
                    const fmtQty = (g: number | null, u: number | null) => isWeight ? `${((g || 0)/1000).toFixed(3)} kg` : `${u || 0} pcs`;
                    return (
                      <tr key={vs.product_variant_id} className="hover:bg-surface-hover/30">
                        <td className="py-2.5 px-3 font-sans font-bold text-text-primary">{vs.product_name} ({vs.variant_name})</td>
                        <td className="py-2.5 px-3 font-sans text-text-secondary">{vs.category}</td>
                        <td className="py-2.5 px-3 text-right text-text-muted">{fmtQty(vs.opening_quantity_grams, vs.opening_quantity_units)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{fmtQty(vs.total_in_grams, vs.total_in_units)}</td>
                        <td className="py-2.5 px-3 text-right text-rose-400 font-bold">{fmtQty(vs.total_out_grams, vs.total_out_units)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-brand-500">{fmtQty(vs.net_change_grams, vs.net_change_units)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-text-primary">{fmtQty(vs.closing_quantity_grams, vs.closing_quantity_units)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chronological Movements Table */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden shadow-elevation">
            <div className="px-5 py-3 border-b border-border-subtle">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Chronological Transaction Log ({movementData?.movements?.length || 0} events)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-card border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Item / Variant</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Dir</th>
                    <th className="py-3 px-4">Action Event</th>
                    <th className="py-3 px-4 text-right">Quantity</th>
                    <th className="py-3 px-4 text-right">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 font-mono">
                  {(movementData?.movements || []).map((m: any) => (
                    <tr key={m.id} className="hover:bg-surface-hover/30">
                      <td className="py-3 px-4 text-text-muted">{new Date(m.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-4 font-sans font-bold text-text-primary">{m.product_name} ({m.variant_name})</td>
                      <td className="py-3 px-4 font-sans text-text-secondary">{m.category}</td>
                      <td className="py-3 px-4 text-center font-sans">
                        {m.movement_type === 'IN' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">IN</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">OUT</span>
                        )}
                      </td>
                      <td className="py-3 px-4 capitalize font-sans text-text-primary">{m.action_kind.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 text-right font-bold text-text-primary">
                        {m.unit_type === 'weight' ? `${((Math.abs(m.quantity_grams || 0))/1000).toFixed(3)} kg` : `${Math.abs(m.quantity_units || 0)} pcs`}
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted">{m.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
