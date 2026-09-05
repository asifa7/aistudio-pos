// ZoneManagementModal.tsx
// Delivery zone pricing, free delivery thresholds, and SLA configuration modal

import React, { useState } from 'react';
import { MapPin, Check, X, Clock, IndianRupee } from 'lucide-react';
import { DeliveryZone } from '../../types/delivery.types';
import { useSaveZone } from '../hooks/useDelivery';

interface ZoneManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  zone?: DeliveryZone | null;
}

export const ZoneManagementModal: React.FC<ZoneManagementModalProps> = ({
  isOpen,
  onClose,
  zone,
}) => {
  const saveZoneMutation = useSaveZone();

  const [name, setName] = useState(zone?.name || '');
  const [code, setCode] = useState(zone?.code || '');
  const [description, setDescription] = useState(zone?.description || '');
  const [deliveryCharge, setDeliveryCharge] = useState<number>(zone ? zone.delivery_charge_paise / 100 : 40);
  const [minOrder, setMinOrder] = useState<number>(zone ? zone.min_order_paise / 100 : 200);
  const [freeAbove, setFreeAbove] = useState<number>(zone && zone.free_delivery_above_paise ? zone.free_delivery_above_paise / 100 : 1000);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(zone?.estimated_minutes || 45);
  const [availableFrom, setAvailableFrom] = useState(zone?.available_from || '07:00');
  const [availableTo, setAvailableTo] = useState(zone?.available_to || '21:00');
  const [isDefault, setIsDefault] = useState<boolean>(zone ? Boolean(zone.is_default) : false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      alert('Zone name and code are required.');
      return;
    }

    try {
      await saveZoneMutation.mutateAsync({
        id: zone?.id,
        input: {
          name,
          code: code.toUpperCase().replace(/\s+/g, '_'),
          description: description || null,
          delivery_charge_paise: Math.round(deliveryCharge * 100),
          min_order_paise: Math.round(minOrder * 100),
          free_delivery_above_paise: freeAbove > 0 ? Math.round(freeAbove * 100) : null,
          estimated_minutes: Number(estimatedMinutes) || 45,
          available_from: availableFrom,
          available_to: availableTo,
          is_active: 1,
          is_default: isDefault ? 1 : 0,
        }
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save zone');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-app border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border-subtle bg-surface-panel flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20">
              <MapPin size={18} />
            </div>
            <h3 className="font-bold text-sm text-text-primary">
              {zone ? 'Edit Delivery Zone' : 'Create Delivery Zone'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Zone Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Local Area (0-3 km)"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Zone Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. ZONE_LOCAL"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Description</label>
            <input
              type="text"
              placeholder="e.g. Neighborhood localities within 3 km radius"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Delivery Fee (₹)</label>
              <input
                type="number"
                min={0}
                step="1"
                value={deliveryCharge}
                onChange={e => setDeliveryCharge(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Min Order (₹)</label>
              <input
                type="number"
                min={0}
                step="10"
                value={minOrder}
                onChange={e => setMinOrder(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Free Over (₹)</label>
              <input
                type="number"
                min={0}
                step="50"
                value={freeAbove}
                onChange={e => setFreeAbove(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Target SLA (mins)</label>
              <input
                type="number"
                min={10}
                max={240}
                value={estimatedMinutes}
                onChange={e => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Available From</label>
              <input
                type="time"
                value={availableFrom}
                onChange={e => setAvailableFrom(e.target.value)}
                className="w-full px-2 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Available To</label>
              <input
                type="time"
                value={availableTo}
                onChange={e => setAvailableTo(e.target.value)}
                className="w-full px-2 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 text-[11px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className="rounded accent-brand-500"
              />
              <span className="font-semibold text-text-primary">Set as Default / Fallback Zone</span>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border-subtle text-text-secondary hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveZoneMutation.isPending}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{zone ? 'Update Zone' : 'Save Zone'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ZoneManagementModal;
