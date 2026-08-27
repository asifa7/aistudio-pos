import React from 'react';
import { Cpu, Printer, Scale, Scan, CheckCircle2 } from 'lucide-react';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const HardwareStatusPreview: React.FC = () => {
  const { draftConfig } = useSettingsDraftStore();
  const hw = draftConfig.hardware;

  return (
    <div className="w-full space-y-4">
      {/* Hardware Status Tile */}
      <div className="w-full bg-surface-card border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            <Printer size={16} className="text-brand-500" />
            <h4 className="text-xs font-black uppercase tracking-wider text-text-primary">
              Hardware Bus Telemetry
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            LOCAL DESKTOP
          </span>
        </div>

        <div className="space-y-3">
          {/* Thermal Receipt Printer */}
          <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Printer size={16} className="text-brand-500" />
              <div>
                <p className="text-xs font-bold text-text-primary">Thermal Printer</p>
                <p className="text-[10px] text-text-muted font-mono">
                  {hw.printerName ? `Device: ${hw.printerName}` : 'System Default / Print Dialog'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 size={12} /> Ready
            </span>
          </div>

          {/* Electronic Weighing Scale */}
          <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Scale size={16} className="text-amber-500" />
              <div>
                <p className="text-xs font-bold text-text-primary">Weighing Scale (RS-232 / COM)</p>
                <p className="text-[10px] text-text-muted font-mono">
                  {hw.scalePort ? `${hw.scalePort} @ ${hw.scaleBaudRate || 9600} baud` : 'Manual input fallback'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${hw.scalePort ? 'text-emerald-500' : 'text-text-muted'}`}>
              {hw.scalePort ? 'Port Assigned' : 'Emulated'}
            </span>
          </div>

          {/* Barcode Scanner */}
          <div className="p-3 rounded-xl bg-surface-panel border border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Scan size={16} className="text-blue-500" />
              <div>
                <p className="text-xs font-bold text-text-primary">Barcode Scanner</p>
                <p className="text-[10px] text-text-muted">
                  {hw.barcodeScannerEnabled ? 'HID Keyboard wedge active' : 'Disabled'}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold flex items-center gap-1 ${hw.barcodeScannerEnabled ? 'text-emerald-500' : 'text-text-muted'}`}>
              {hw.barcodeScannerEnabled ? 'Active' : 'Off'}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-text-muted text-center leading-relaxed">
        Plug and play peripheral diagnostics for thermal rolls, electronic scales, and USB barcode guns.
      </p>
    </div>
  );
};
