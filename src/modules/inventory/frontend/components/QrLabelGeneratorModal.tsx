import { useRef } from 'react';
import { X, Printer, QrCode } from 'lucide-react';

interface QrLabelGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: Array<{
    product_code: string;
    product_name: string;
    variant_name: string;
    unit_type: 'weight' | 'piece';
    rate_paise_per_unit: number;
  }>;
}

export default function QrLabelGeneratorModal({
  isOpen,
  onClose,
  selectedItems,
}: QrLabelGeneratorModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Print Product QR Sticker Labels</h2>
              <p className="text-xs text-text-muted">Generated {selectedItems.length} label(s) ready for standard sticker sheets.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/20"
            >
              <Printer size={15} /> Print Sheet
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Label Printable Grid */}
        <div className="p-6 overflow-y-auto flex-1 bg-zinc-950">
          <div ref={printRef} className="grid grid-cols-3 gap-4">
            {selectedItems.map((item, idx) => {
              const priceRupees = ((item.rate_paise_per_unit || 0) / 100).toFixed(2);
              return (
                <div
                  key={`${item.product_code}-${idx}`}
                  className="bg-white text-zinc-900 border border-zinc-300 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm select-none"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">{item.product_code}</div>
                    <div className="font-extrabold text-xs text-zinc-900 truncate mt-0.5">{item.product_name}</div>
                    <div className="text-[11px] font-medium text-zinc-600 truncate">{item.variant_name}</div>
                    <div className="text-xs font-black text-brand-600 mt-1 font-mono">₹{priceRupees}/{item.unit_type === 'weight' ? 'kg' : 'pc'}</div>
                  </div>

                  {/* High contrast QR matrix representation */}
                  <div className="p-1.5 bg-white border border-zinc-300 rounded-lg shrink-0 flex flex-col items-center justify-center">
                    <svg width="60" height="60" viewBox="0 0 29 29" className="shape-rendering-crisp">
                      <path d="M0,0 h7 v7 h-7 z M2,2 h3 v3 h-3 z M22,0 h7 v7 h-7 z M24,2 h3 v3 h-3 z M0,22 h7 v7 h-7 z M2,24 h3 v3 h-3 z M9,0 h2 v2 h-2 z M13,0 h3 v1 h-3 z M18,0 h2 v3 h-2 z M10,3 h4 v2 h-4 z M16,4 h2 v3 h-2 z M8,7 h3 v2 h-3 z M13,8 h4 v2 h-4 z M20,8 h3 v3 h-3 z M0,9 h2 v3 h-2 z M4,10 h3 v2 h-3 z M9,12 h2 v4 h-2 z M13,12 h4 v3 h-4 z M19,13 h3 v2 h-3 z M24,11 h4 v3 h-4 z M0,14 h3 v3 h-3 z M5,15 h2 v3 h-2 z M10,17 h4 v2 h-4 z M16,16 h3 v4 h-3 z M21,17 h3 v3 h-3 z M26,16 h2 v4 h-2 z M9,21 h3 v3 h-3 z M14,21 h4 v2 h-4 z M20,22 h3 v2 h-3 z M25,22 h3 v4 h-3 z M9,25 h4 v3 h-4 z M15,25 h3 v3 h-3 z M20,26 h4 v2 h-4 z" fill="#000" />
                    </svg>
                    <span className="text-[8px] font-mono font-extrabold text-zinc-600 mt-0.5">{item.product_code}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
