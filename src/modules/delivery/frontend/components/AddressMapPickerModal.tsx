// AddressMapPickerModal.tsx
// Interactive Leaflet map pin-drop picker for capturing customer address lat/long

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Check, X, Navigation, Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AddressMapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  addressLabel?: string;
  onSelectCoordinates: (lat: number, lng: number) => void;
}

// Fix default leaflet marker icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Default center: Bengaluru (12.9716, 77.5946) or shop location
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

export const AddressMapPickerModal: React.FC<AddressMapPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  addressLabel = 'Customer Delivery Address',
  onSelectCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_CENTER[0],
    lng: initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_CENTER[1],
  });

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const initialPos: [number, number] = [
      initialLat && !isNaN(initialLat) ? initialLat : DEFAULT_CENTER[0],
      initialLng && !isNaN(initialLng) ? initialLng : DEFAULT_CENTER[1],
    ];

    // Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: initialPos,
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Custom Draggable Pin Marker
    const customIcon = L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div style="
          background-color: #ef4444;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background-color: white;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker(initialPos, {
      draggable: true,
      icon: customIcon,
    }).addTo(map);

    marker.on('dragend', (e) => {
      const latlng = e.target.getLatLng();
      setSelectedCoords({ lat: latlng.lat, lng: latlng.lng });
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setSelectedCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [isOpen]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const latlng: [number, number] = [latitude, longitude];
          mapInstanceRef.current?.setView(latlng, 16);
          markerRef.current?.setLatLng(latlng);
          setSelectedCoords({ lat: latitude, lng: longitude });
        },
        () => {
          alert('Could not determine current location. Please click on the map to drop the pin.');
        }
      );
    }
  };

  const handleConfirm = () => {
    onSelectCoordinates(Number(selectedCoords.lat.toFixed(6)), Number(selectedCoords.lng.toFixed(6)));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-app border border-border-subtle rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col h-[600px] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-border-subtle bg-surface-panel flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center border border-brand-500/20">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-text-primary">Pin-Drop Delivery Address</h3>
              <p className="text-xs text-text-muted">{addressLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 bg-surface-card overflow-hidden">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* Quick Guidance Overlay */}
          <div className="absolute top-3 left-3 z-[1000] bg-surface-panel/90 backdrop-blur-md border border-border-subtle px-3 py-2 rounded-xl text-xs shadow-lg text-text-secondary flex items-center gap-2">
            <Crosshair size={14} className="text-brand-500 shrink-0" />
            <span>Click anywhere or drag the red pin to select the exact doorstep location.</span>
          </div>

          {/* Current Location Button */}
          <button
            onClick={handleUseCurrentLocation}
            className="absolute bottom-4 right-4 z-[1000] bg-surface-panel/95 hover:bg-surface-hover text-text-primary border border-border-subtle px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 transition-all"
          >
            <Navigation size={14} className="text-blue-400" />
            <span>Locate Me</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-surface-panel flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-text-secondary">
            <span className="text-text-muted">Coordinates:</span>
            <span className="bg-surface-card border border-border-subtle px-2 py-1 rounded font-bold text-text-primary">
              {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-semibold text-text-secondary hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-1.5 transition-all"
            >
              <Check size={14} />
              <span>Confirm Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddressMapPickerModal;
