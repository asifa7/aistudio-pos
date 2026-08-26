import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  X, 
  Calendar, 
  ShoppingBag, 
  Sparkles 
} from 'lucide-react';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';

interface DailyCashierPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DailyCashierPromptModal({ isOpen, onClose }: DailyCashierPromptModalProps) {
  const [activeTab, setActiveTab] = useState<'bulk' | 'event'>('bulk');

  // Form states for Quick Bulk Order
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVariantId, setSelectedVariantId] = useState<number | string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Form states for Quick Festival / Event
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [impactLevel, setImpactLevel] = useState<'High' | 'Normal' | 'Low' | 'Very_Low'>('Low');

  // Query variants
  const { data: variants } = useQuery({
    queryKey: ['products-all-variants'],
    queryFn: async () => {
      const res = await window.api.invoke('products:get-all', {});
      if (!res.success) return [];
      const list: any[] = [];
      (res.data || []).forEach((p: any) => {
        (p.variants || []).forEach((v: any) => {
          list.push({
            id: v.id,
            name: `${p.name} - ${v.variant_name} (${v.unit_type})`,
            unit_type: v.unit_type,
          });
        });
      });
      return list;
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const handleAddBulkOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariantId || !quantity || !customerNotes.trim()) return;

    const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CREATE_BULK_ORDER, {
      delivery_date: deliveryDate,
      product_variant_id: Number(selectedVariantId),
      quantity: parseFloat(quantity),
      customer_name_or_notes: customerNotes.trim(),
    });

    if (res.success) {
      onClose();
    }
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.CREATE_CALENDAR_EVENT, {
      event_name: eventName.trim(),
      event_date: eventDate,
      impact_level: impactLevel,
    });

    if (res.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl w-full max-w-lg shadow-elevation overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-surface-card border-b border-border-subtle p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="text-brand-500" size={18} />
            <h3 className="font-bold text-sm font-outfit text-text-primary">
              Daily Operations Check — Bulk Orders & Events
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-text-secondary leading-relaxed">
            Good morning! Are there any expected bulk restaurant orders, hotel deliveries, or special festival fasting days scheduled for today or this week?
          </p>

          {/* Quick Tabs */}
          <div className="flex bg-surface-app border border-border-subtle p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'bulk' ? 'bg-brand-500 text-white shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <ShoppingBag size={14} /> Quick-Add Bulk Order
            </button>
            <button
              onClick={() => setActiveTab('event')}
              className={`flex-1 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'event' ? 'bg-brand-500 text-white shadow-subtle' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Calendar size={14} /> Quick-Add Fasting Event
            </button>
          </div>

          {/* Tab 1: Quick Bulk Order */}
          {activeTab === 'bulk' && (
            <form onSubmit={handleAddBulkOrder} className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-muted font-bold mb-1">Delivery Date</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={e => setDeliveryDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-muted font-bold mb-1">Item / Variant</label>
                  <select
                    value={selectedVariantId}
                    onChange={e => setSelectedVariantId(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">Select Variant...</option>
                    {(variants || []).map((v: any) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-muted font-bold mb-1">Quantity (kg or pcs)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 25"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-muted font-bold mb-1">Customer / Hotel Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Rajan Hotel"
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all shadow-subtle"
                >
                  Save Bulk Order
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-surface-card border border-border-subtle text-text-muted hover:text-text-primary font-bold rounded-xl transition-all"
                >
                  Skip for Today
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Quick Fasting Event */}
          {activeTab === 'event' && (
            <form onSubmit={handleAddEvent} className="space-y-3 pt-1">
              <div>
                <label className="block text-text-muted font-bold mb-1">Event Name</label>
                <input
                  type="text"
                  placeholder="e.g., Ekadashi Fasting"
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-muted font-bold mb-1">Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-muted font-bold mb-1">Impact Level</label>
                  <select
                    value={impactLevel}
                    onChange={e => setImpactLevel(e.target.value as any)}
                    className="w-full bg-surface-card border border-border-subtle rounded-lg px-2.5 py-1.5 text-text-primary outline-none focus:border-brand-500 font-bold"
                  >
                    <option value="Very_Low">Very Low (0.3x)</option>
                    <option value="Low">Low (0.6x)</option>
                    <option value="Normal">Normal (1.0x)</option>
                    <option value="High">High Spike (1.4x)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-all shadow-subtle"
                >
                  Save Fasting Event
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-surface-card border border-border-subtle text-text-muted hover:text-text-primary font-bold rounded-xl transition-all"
                >
                  Skip for Today
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
