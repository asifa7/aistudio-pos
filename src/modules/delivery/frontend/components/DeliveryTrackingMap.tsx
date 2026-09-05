// DeliveryTrackingMap.tsx
// Interactive live operational map displaying shop base and active delivery pins with popup cards

import React, { useEffect, useRef, useState } from 'react';
import { Store, User, Phone, Navigation, Clock, RefreshCw, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DeliveryOrder, DeliveryStatus } from '../../types/delivery.types';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

interface DeliveryTrackingMapProps {
  deliveries: DeliveryOrder[];
  shopLocation?: { lat: number; lng: number; name: string };
  onSelectDelivery?: (delivery: DeliveryOrder) => void;
  onUpdateStatus?: (deliveryId: number, status: DeliveryStatus) => void;
}

// Default Shop Coordinates: Bengaluru Core
const DEFAULT_SHOP = {
  lat: 12.9716,
  lng: 77.5946,
  name: 'MeatPOS Central Store',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b', // amber
  preparing: '#3b82f6', // blue
  ready_for_dispatch: '#6366f1', // indigo
  assigned: '#8b5cf6', // purple
  picked_up: '#a855f7', // purple
  out_for_delivery: '#ec4899', // pink
  arrived: '#10b981', // green
  delivered: '#22c55e', // green
  failed: '#ef4444', // red
  cancelled: '#6b7280', // gray
};

export const DeliveryTrackingMap: React.FC<DeliveryTrackingMapProps> = ({
  deliveries,
  shopLocation = DEFAULT_SHOP,
  onSelectDelivery,
  onUpdateStatus,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOrder | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: [shopLocation.lat, shopLocation.lng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers whenever deliveries change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // 1. Add Shop Base Marker
    const shopIcon = L.divIcon({
      className: 'shop-base-pin',
      html: `
        <div style="
          background-color: #0f172a;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid #f97316;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f97316;
          font-weight: bold;
        ">
          🥩
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const shopMarker = L.marker([shopLocation.lat, shopLocation.lng], { icon: shopIcon });
    shopMarker.bindTooltip(`<b>${shopLocation.name}</b><br/>HQ Dispatch Base`, { direction: 'top' });
    markersGroup.addLayer(shopMarker);

    // 2. Add Active Delivery Markers
    const bounds: [number, number][] = [[shopLocation.lat, shopLocation.lng]];

    deliveries.forEach((d) => {
      // Fallback coordinate offset if no lat/long exists to keep operational view populated
      const lat = d.address?.latitude || (shopLocation.lat + (Math.sin(d.id * 1.7) * 0.03));
      const lng = d.address?.longitude || (shopLocation.lng + (Math.cos(d.id * 1.7) * 0.03));

      bounds.push([lat, lng]);

      const color = STATUS_COLORS[d.status] || '#3b82f6';
      const isSelected = selectedDelivery?.id === d.id;

      const deliveryIcon = L.divIcon({
        className: 'delivery-order-pin',
        html: `
          <div style="
            background-color: ${color};
            width: ${isSelected ? '36px' : '30px'};
            height: ${isSelected ? '36px' : '30px'};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            <div style="
              transform: rotate(45deg);
              font-size: 11px;
              font-weight: 800;
              color: white;
            ">
              ${d.delivery_number.slice(-3)}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([lat, lng], { icon: deliveryIcon });
      marker.on('click', () => {
        setSelectedDelivery(d);
        if (onSelectDelivery) onSelectDelivery(d);
      });

      marker.bindTooltip(`
        <div style="font-size: 11px; font-family: sans-serif;">
          <b>${d.delivery_number}</b><br/>
          ${d.customer_name} · ₹${(d.total_paise / 100).toFixed(2)}<br/>
          <span style="color: ${color}; font-weight: bold; text-transform: uppercase;">${d.status.replace(/_/g, ' ')}</span>
        </div>
      `, { direction: 'top' });

      markersGroup.addLayer(marker);
    });

    // Auto fit bounds if multiple pins exist
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [deliveries, shopLocation, selectedDelivery]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-surface-card rounded-2xl border border-border-subtle shadow-elevation">
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full flex-1 min-h-[450px]" />

      {/* Legend & Stats Overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-surface-panel/90 backdrop-blur-md border border-border-subtle p-3 rounded-2xl shadow-xl space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-text-primary">
          <Store size={14} className="text-brand-500" />
          <span>Active Dispatch Map ({deliveries.length} orders)</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-text-secondary pt-1 border-t border-border-subtle">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Pending / Prep</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Assigned / Transit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            <span>Out for Delivery</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Arrived</span>
          </div>
        </div>
      </div>

      {/* Selected Delivery Card Overlay */}
      {selectedDelivery && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-surface-panel/95 backdrop-blur-md border border-border-subtle p-4 rounded-2xl shadow-2xl w-80 animate-in slide-in-from-bottom-2 duration-150 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-text-primary font-mono">{selectedDelivery.delivery_number}</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                  style={{
                    backgroundColor: `${STATUS_COLORS[selectedDelivery.status]}20`,
                    color: STATUS_COLORS[selectedDelivery.status]
                  }}
                >
                  {selectedDelivery.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {selectedDelivery.time_slot_start ? `${selectedDelivery.time_slot_start} - ${selectedDelivery.time_slot_end}` : 'Immediate Delivery'}
              </p>
            </div>
            <button
              onClick={() => setSelectedDelivery(null)}
              className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bg-surface-card border border-border-subtle rounded-xl p-2.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-text-muted flex items-center gap-1">
                <User size={12} /> Customer:
              </span>
              <span className="font-bold text-text-primary">{selectedDelivery.customer_name}</span>
            </div>
            {selectedDelivery.customer_phone && (
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1">
                  <Phone size={12} /> Phone:
                </span>
                <span className="font-mono text-text-secondary">{selectedDelivery.customer_phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-text-muted flex items-center gap-1">
                <Navigation size={12} /> Area:
              </span>
              <span className="text-text-secondary truncate max-w-[150px]">{selectedDelivery.address?.area || 'Local Zone'}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50">
              <span className="text-text-muted">Driver:</span>
              <span className="font-semibold text-brand-500">{selectedDelivery.driver_name || 'Unassigned'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Total:</span>
              <span className="font-bold font-mono text-text-primary">{formatPaise(selectedDelivery.total_paise)}</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          {onUpdateStatus && (
            <div className="flex gap-2 pt-1">
              {selectedDelivery.status === 'assigned' && (
                <button
                  onClick={() => onUpdateStatus(selectedDelivery.id, 'out_for_delivery')}
                  className="flex-1 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all"
                >
                  Dispatch
                </button>
              )}
              {selectedDelivery.status === 'out_for_delivery' && (
                <button
                  onClick={() => onUpdateStatus(selectedDelivery.id, 'delivered')}
                  className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                >
                  <CheckCircle2 size={13} />
                  Mark Delivered
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryTrackingMap;
