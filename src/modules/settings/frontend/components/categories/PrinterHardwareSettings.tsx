import React from 'react';
import { Printer, Scale, Scan, Zap } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { TextField } from '../ui/TextField';
import { SwitchControl } from '../ui/SwitchControl';
import { SelectControl } from '../ui/SelectControl';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const PrinterHardwareSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsDraftStore();
  const hw = draftConfig.hardware;
  const tmpl = draftConfig.receiptTemplate;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Thermal Receipt Printer */}
      <SettingCard
        title="Thermal Receipt Printer"
        description="USB, Network, or Virtual Windows driver configuration"
        icon={<Printer size={16} />}
      >
        <SettingRow
          label="Printer Device / Driver Name"
          description="Exact printer name in Windows Control Panel (leave blank for default printer dialog)"
        >
          <TextField
            value={hw.printerName}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                hardware: { ...prev.hardware, printerName: val },
              }))
            }
            placeholder="e.g. POS-80C or XP-58"
            className="w-72 font-mono"
          />
        </SettingRow>

        <SettingRow
          label="Thermal Paper Specification"
          description="Standard roll dimension"
        >
          <SegmentedControl<'58mm' | '80mm' | 'A4'>
            value={tmpl?.paperWidth || '80mm'}
            options={[
              { value: '58mm', label: '58 mm (2-inch)' },
              { value: '80mm', label: '80 mm (3-inch)' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                receiptTemplate: { ...(prev.receiptTemplate || {}), paperWidth: val },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Cash Drawer Kick Trigger"
          description="Send ESC/POS kick pulse signal to cash drawer via RJ11 printer port"
        >
          <SwitchControl
            checked={hw.cashDrawerEnabled ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                hardware: { ...prev.hardware, cashDrawerEnabled: checked },
              }))
            }
          />
        </SettingRow>
      </SettingCard>

      {/* Electronic Weighing Scale */}
      <SettingCard
        title="Electronic Weighing Scale (RS-232 / USB)"
        description="Direct meat scale serial port reading for automatic cart tare and gross weight capture"
        icon={<Scale size={16} />}
      >
        <SettingRow
          label="Serial COM Port"
          description="COM port for connected weighing scale (e.g. COM1, COM3)"
        >
          <TextField
            value={hw.scalePort}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                hardware: { ...prev.hardware, scalePort: val.toUpperCase() },
              }))
            }
            placeholder="e.g. COM3"
            className="w-44 font-mono uppercase"
          />
        </SettingRow>

        <SettingRow
          label="Serial Baud Rate"
          description="Communication speed for the scale motherboard"
        >
          <SelectControl
            value={hw.scaleBaudRate || 9600}
            options={[
              { value: 4800, label: '4800 Baud' },
              { value: 9600, label: '9600 Baud (Standard)' },
              { value: 19200, label: '19200 Baud' },
              { value: 38400, label: '38400 Baud' },
              { value: 115200, label: '115200 Baud' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                hardware: { ...prev.hardware, scaleBaudRate: Number(val) },
              }))
            }
            className="w-72"
          />
        </SettingRow>
      </SettingCard>

      {/* Barcode Gun */}
      <SettingCard
        title="USB Barcode Scanner"
        description="Barcode scanner configuration for pre-packaged marinated meats"
        icon={<Scan size={16} />}
      >
        <SettingRow
          label="Barcode Scanner Support"
          description="Enables automatic keyboard buffer intercept for rapid barcode entry"
        >
          <SwitchControl
            checked={hw.barcodeScannerEnabled ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                hardware: { ...prev.hardware, barcodeScannerEnabled: checked },
              }))
            }
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
