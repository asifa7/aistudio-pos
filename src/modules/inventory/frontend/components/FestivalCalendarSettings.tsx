import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  ShoppingBag
} from 'lucide-react';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

export default function FestivalCalendarSettings() {
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [impactLevel, setImpactLevel] = useState<'High' | 'Normal' | 'Low' | 'Very_Low'>('Low');
  const [notes, setNotes] = useState('');

  // Queries
  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['all-calendar-events'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.LIST_CALENDAR_EVENTS, {});
      return res.success ? (res.data || []) : [];
    },
  });

  const { data: bulkOrders, refetch: refetchBulk } = useQuery({
    queryKey: ['pending-bulk-orders'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.GET_PENDING_BULK_ORDERS, {});
      return res.success ? (res.data || []) : [];
    },
  });

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !eventDate) return;

    const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CREATE_CALENDAR_EVENT, {
      event_name: eventName,
      event_date: eventDate,
      impact_level: impactLevel,
      notes: notes,
    });

    if (res.success) {
      setEventName('');
      setNotes('');
      refetchEvents();
    }
  };

  const handleDeleteEvent = async (id: number) => {
    const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.DELETE_CALENDAR_EVENT, { id });
    if (res.success) refetchEvents();
  };

  const handleCancelBulkOrder = async (id: number) => {
    const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CANCEL_BULK_ORDER, { id });
    if (res.success) refetchBulk();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6 bg-surface-app text-text-primary">
      {/* Header */}
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
          <CalendarIcon className="text-brand-500" />
          <span>Festival & Event Demand Calendar</span>
        </h2>
        <p className="text-text-muted text-xs mt-1">
          Manage upcoming Hindu festival dates, fasting days (Ekadashi, Purattasi), and bulk restaurant orders to dynamically adjust daily demand forecasting multipliers.
        </p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column: Create New Event Form */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation space-y-4 h-fit">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Plus className="text-brand-500" size={16} />
            <span>Add Event / Fasting Date</span>
          </h3>

          <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
            <div>
              <label className="block text-text-muted font-bold mb-1">Event Name</label>
              <input
                type="text"
                placeholder="e.g., Ekadashi Fasting, Navratri"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-text-muted font-bold mb-1">Event Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-brand-500"
                required
              />
            </div>

            <div>
              <label className="block text-text-muted font-bold mb-1">Demand Impact Multiplier</label>
              <select
                value={impactLevel}
                onChange={e => setImpactLevel(e.target.value as any)}
                className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-brand-500 font-bold"
              >
                <option value="Very_Low">Very Low Demand (0.3x multiplier - Strict Vegetarian/Fasting)</option>
                <option value="Low">Low Demand (0.6x multiplier - General Fasting Day)</option>
                <option value="Normal">Normal Demand (1.0x multiplier - Standard Day)</option>
                <option value="High">High Demand (1.4x multiplier - Festival Gathering / Holiday Spike)</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted font-bold mb-1">Notes / Regional Context</label>
              <textarea
                placeholder="e.g., Tamil Nadu fasting day, expect reduced mutton sales"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all shadow-subtle flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Add Calendar Event
            </button>
          </form>
        </div>

        {/* Center & Right Column: Events & Bulk Orders List */}
        <div className="lg:col-span-2 flex flex-col space-y-6 overflow-hidden">
          {/* Upcoming Festival Events Table */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
              <CalendarIcon size={16} className="text-brand-500" />
              <span>Configured Fasting & Festival Events ({events?.length || 0})</span>
            </h3>

            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-card border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Event Name</th>
                    <th className="py-2.5 px-3">Demand Impact</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 font-mono">
                  {(events || []).map((ev: any) => (
                    <tr key={ev.id} className="hover:bg-surface-hover/30">
                      <td className="py-2.5 px-3 font-bold text-text-primary font-sans">{ev.event_date}</td>
                      <td className="py-2.5 px-3 font-sans font-bold text-text-primary">{ev.event_name}</td>
                      <td className="py-2.5 px-3 font-sans">
                        {ev.impact_level === 'Very_Low' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            0.3x Very Low
                          </span>
                        )}
                        {ev.impact_level === 'Low' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            0.6x Low
                          </span>
                        )}
                        {ev.impact_level === 'Normal' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            1.0x Normal
                          </span>
                        )}
                        {ev.impact_level === 'High' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            1.4x High Spike
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-text-muted font-sans text-[11px]">{ev.notes || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1 text-text-muted hover:text-rose-400 transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Bulk Orders List */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 shadow-elevation h-48 flex flex-col min-h-0">
            <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <ShoppingBag size={16} className="text-brand-500" />
              <span>Registered Pending Bulk Orders ({bulkOrders?.length || 0})</span>
            </h3>

            <div className="flex-1 overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-card border-b border-border-subtle text-text-muted uppercase text-[10px] font-bold">
                  <tr>
                    <th className="py-2 px-3">Delivery Date</th>
                    <th className="py-2 px-3">Item / Variant</th>
                    <th className="py-2 px-3 text-right">Quantity</th>
                    <th className="py-2 px-3">Customer / Note</th>
                    <th className="py-2 px-3 text-center">Cancel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 font-mono">
                  {(bulkOrders || []).map((bo: any) => {
                    const isWeight = bo.unit_type === 'weight';
                    const qtyStr = isWeight ? `${((bo.quantity_grams || 0)/1000).toFixed(3)} kg` : `${bo.quantity_units || 0} pcs`;
                    return (
                      <tr key={bo.id} className="hover:bg-surface-hover/30">
                        <td className="py-2 px-3 font-bold text-text-primary font-sans">{bo.delivery_date}</td>
                        <td className="py-2 px-3 font-sans font-bold text-text-primary">{bo.product_name} ({bo.variant_name})</td>
                        <td className="py-2 px-3 text-right font-bold text-brand-500">{qtyStr}</td>
                        <td className="py-2 px-3 font-sans text-text-secondary">{bo.customer_name_or_notes}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleCancelBulkOrder(bo.id)}
                            className="p-1 text-text-muted hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {(!bulkOrders || bulkOrders.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-text-muted text-xs font-sans">
                        No pending bulk orders registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
