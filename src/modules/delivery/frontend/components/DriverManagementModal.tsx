// DriverManagementModal.tsx
// Driver registration and vehicle management modal

import React, { useState } from 'react';
import { User, Phone, Truck, ShieldCheck, X, Check } from 'lucide-react';
import { DeliveryDriver, DriverVehicleType, DriverStatus } from '../../types/delivery.types';
import { useSaveDriver } from '../hooks/useDelivery';

interface DriverManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: DeliveryDriver | null;
}

export const DriverManagementModal: React.FC<DriverManagementModalProps> = ({
  isOpen,
  onClose,
  driver,
}) => {
  const saveDriverMutation = useSaveDriver();

  const [name, setName] = useState(driver?.name || '');
  const [phone, setPhone] = useState(driver?.phone || '');
  const [alternatePhone, setAlternatePhone] = useState(driver?.alternate_phone || '');
  const [vehicleType, setVehicleType] = useState<DriverVehicleType>(driver?.vehicle_type || 'two_wheeler');
  const [vehicleNumber, setVehicleNumber] = useState(driver?.vehicle_number || '');
  const [licenseNumber, setLicenseNumber] = useState(driver?.license_number || '');
  const [maxConcurrent, setMaxConcurrent] = useState<number>(driver?.max_concurrent_orders || 4);
  const [status, setStatus] = useState<DriverStatus>(driver?.status || 'available');
  const [isActive, setIsActive] = useState<boolean>(driver ? Boolean(driver.is_active) : true);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      alert('Driver name and phone number are required.');
      return;
    }

    try {
      await saveDriverMutation.mutateAsync({
        id: driver?.id,
        input: {
          name,
          phone,
          alternate_phone: alternatePhone || null,
          vehicle_type: vehicleType,
          vehicle_number: vehicleNumber || null,
          license_number: licenseNumber || null,
          max_concurrent_orders: Number(maxConcurrent) || 4,
          status,
          is_active: isActive ? 1 : 0,
        }
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save driver');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-app border border-border-subtle rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-border-subtle bg-surface-panel flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20">
              <Truck size={18} />
            </div>
            <h3 className="font-bold text-sm text-text-primary">
              {driver ? 'Edit Delivery Driver' : 'Register New Driver'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Driver Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Primary Phone *</label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Alternate Phone</label>
              <input
                type="tel"
                placeholder="Optional backup"
                value={alternatePhone}
                onChange={e => setAlternatePhone(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Vehicle Type</label>
              <select
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value as DriverVehicleType)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500"
              >
                <option value="two_wheeler">Two Wheeler (Bike/Scooter)</option>
                <option value="three_wheeler">Three Wheeler (Auto)</option>
                <option value="car">Four Wheeler / Van</option>
                <option value="bicycle">Bicycle</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Vehicle Registration #</label>
              <input
                type="text"
                placeholder="e.g. KA-01-EA-4521"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Driving License #</label>
              <input
                type="text"
                placeholder="e.g. DL-042011001"
                value={licenseNumber}
                onChange={e => setLicenseNumber(e.target.value)}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-text-muted text-[10px] uppercase tracking-wider">Max Load (Concurrent)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxConcurrent}
                onChange={e => setMaxConcurrent(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-card border border-border-subtle rounded-xl text-text-primary outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded accent-brand-500"
              />
              <span className="font-semibold text-text-primary">Driver is Active & Available</span>
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
              disabled={saveDriverMutation.isPending}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{driver ? 'Update Driver' : 'Save Driver'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DriverManagementModal;
