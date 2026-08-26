import { useState, useEffect } from 'react';
import { X, FileText, Image as ImageIcon, ExternalLink, ShieldCheck, ZoomIn, ZoomOut, RotateCw, AlertTriangle, Upload, CheckCircle2, Printer } from 'lucide-react';
import { formatPaise, formatDate, PassbookLedgerEntry } from '../../types/supplier.types';
import { IPC_CHANNELS } from '../../../../../core/ipc/channels';

interface Props {
  entry: PassbookLedgerEntry;
  onClose: () => void;
  onFlagMismatch?: (entry: PassbookLedgerEntry) => void;
  onAttachPhoto?: (entry: PassbookLedgerEntry) => void;
}

export default function BillCrossCheckModal({ entry, onClose, onFlagMismatch, onAttachPhoto }: Props) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (entry.ref_type === 'purchase_invoice' && entry.ref_id) {
      setIsLoading(true);
      window.api.invoke(IPC_CHANNELS.PROCUREMENT.INVOICE_GET_BY_ID, { id: entry.ref_id })
        .then(res => {
          if (res.success && res.data) {
            setInvoiceItems(res.data.items || []);
          }
        })
        .catch(err => console.error("Error loading invoice items:", err))
        .finally(() => setIsLoading(false));
    }
  }, [entry]);

  const isImage = entry.file_path ? /\.(jpg|jpeg|png|webp|gif)$/i.test(entry.file_path) : false;
  const isPdf = entry.file_path ? /\.pdf$/i.test(entry.file_path) : false;

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => { setZoom(100); setRotation(0); };
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden text-text-primary">
        
        {/* Header */}
        <div className="bg-surface-card px-6 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-500/10 text-brand-500 rounded-xl">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-bold font-outfit text-text-primary flex items-center gap-2">
                Cross-Check Physical Receipt vs System Record
              </h2>
              <p className="text-xs text-text-muted">
                Supplier: <span className="text-text-primary font-bold">{entry.supplier_name}</span> | Internal Ref: <span className="font-mono text-brand-500 font-extrabold">{entry.purchase_ref_number || `PUR-${entry.ref_id}`}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {entry.ref_type === 'purchase_invoice' && (
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm print:hidden"
              >
                <Printer size={14} /> Print Bill
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors print:hidden"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Side-by-Side Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 divide-y md:divide-y-0 md:divide-x divide-border-subtle overflow-hidden">
          
          {/* LEFT PANEL: System-Generated Purchase Record (Voucher View - 50% Width) */}
          <div className="w-full md:w-1/2 flex flex-col bg-surface-app/60 p-5 overflow-y-auto space-y-4 print:w-full print:p-0">
            <div className="flex items-center justify-between print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <FileText size={15} className="text-brand-500" /> System Purchase Voucher
              </span>
              <span className={entry.status === 'pending_approval' ? 'badge-warning' : 'badge-success'}>
                {entry.status === 'pending_approval' ? 'Pending Approval' : 'Confirmed'}
              </span>
            </div>

            {/* Printable Voucher Card (A4 Formatted Print Preview) */}
            <div className="bg-white text-slate-800 border border-slate-200 rounded-xl p-6 shadow-sm space-y-5 font-sans text-xs printable-voucher">
              {/* Shop details & Title */}
              <div className="flex justify-between items-start border-b-2 border-slate-200 pb-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight uppercase font-mono">PURCHASE BILL</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">MEAT SHOP STORE</p>
                  <p className="text-[9px] text-slate-400">Main Counter / Inventory Dept</p>
                </div>
                <div className="text-right">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">INTERNAL REF #</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{entry.purchase_ref_number || `PUR-${entry.ref_id}`}</span>
                  </div>
                  <div className="flex flex-col mt-1">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">SUPPLIER BILL / INVOICE #</span>
                    <span className="font-mono font-bold text-slate-800">{entry.supplier_bill_number || 'N/A (Not Provided)'}</span>
                  </div>
                </div>
              </div>

              {/* Supplier details & date */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-[11px]">
                <div>
                  <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[9px] block">SUPPLIER</span>
                  <span className="font-bold text-slate-900">{entry.supplier_name}</span>
                  <span className="text-slate-500 block text-[10px]">Supplier Account Ledger</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-400 uppercase tracking-wider text-[9px] block">DATE</span>
                  <span className="font-bold text-slate-900">{formatDate(entry.entry_date)}</span>
                  <span className="text-slate-500 block text-[10px]">Movement Type: Stock Receipt (IN)</span>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="space-y-1">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">LINE ITEMS</span>
                {isLoading ? (
                  <div className="py-4 text-center text-slate-400">Loading line items...</div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="border-t border-b border-slate-300 text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                        <th className="py-1 px-1">Item Variant</th>
                        <th className="py-1 px-1 text-right w-20">Quantity</th>
                        <th className="py-1 px-1 text-center w-14">Unit</th>
                        <th className="py-1 px-1 text-right w-24">Rate (₹)</th>
                        <th className="py-1 px-1 text-right w-28">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {invoiceItems.length > 0 ? (
                        invoiceItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-1 text-slate-950 font-bold">{item.product_name} ({item.variant_name || 'Standard'})</td>
                            <td className="py-2 px-1 text-right font-mono">{item.quantity}</td>
                            <td className="py-2 px-1 text-center">{item.unit_type === 'weight' ? 'Kg' : 'Pcs'}</td>
                            <td className="py-2 px-1 text-right font-mono">₹{parseFloat(item.unit_price || (item.unit_price_paise / 100)).toFixed(2)}</td>
                            <td className="py-2 px-1 text-right font-mono font-bold text-slate-950">₹{((item.subtotal || item.subtotal_paise) / 100).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-3 px-1 text-slate-600 font-mono" colSpan={5}>
                            {entry.items_summary || entry.description}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Grand Total */}
              <div className="border-t-2 border-slate-300 pt-3 flex justify-between items-end text-slate-900">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">RUNNING BALANCE</span>
                  <span className="font-mono text-[10px] font-bold text-slate-600">
                    {formatPaise(entry.running_balance_paise)}
                  </span>
                </div>
                <div className="text-right flex items-center gap-4">
                  <span className="text-xs font-extrabold uppercase tracking-widest font-mono text-slate-500">TOTAL</span>
                  <span className="text-base font-extrabold font-mono text-slate-950 bg-slate-50 border border-slate-200 px-3 py-1 rounded shadow-sm">
                    {formatPaise(entry.amount_paise)}
                  </span>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="bg-surface-card p-3.5 rounded-xl border border-border-subtle">
              <label
                onClick={() => setIsVerified(!isVerified)}
                className={`flex items-center gap-3 cursor-pointer transition-colors ${
                  isVerified ? 'text-emerald-600 dark:text-emerald-300' : 'text-text-secondary'
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                  isVerified ? 'bg-emerald-500 border-emerald-400 text-white' : 'border-border-subtle bg-surface-app'
                }`}>
                  {isVerified && <CheckCircle2 size={14} />}
                </div>
                <span className="text-xs font-bold">
                  I confirm the system record matches the paper receipt.
                </span>
              </label>
            </div>
          </div>

          {/* RIGHT PANEL: Attached Uploaded Bill Photo / PDF with Zoom Controls (50% Width) */}
          <div className="w-full md:w-1/2 flex flex-col bg-surface-panel p-5 overflow-hidden">
            
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3 text-xs font-bold text-text-secondary">
              <span className="flex items-center gap-1.5">
                <ImageIcon size={15} className="text-brand-500" /> Attached Paper Receipt Photo / File
              </span>

              {/* Zoom & Rotate Controls */}
              {entry.file_path && isImage && (
                <div className="flex items-center gap-1.5 bg-surface-card border border-border-subtle rounded-lg p-1 shadow-sm">
                  <button
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-text-primary"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-[11px] font-mono w-10 text-center">{zoom}%</span>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-text-primary"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <button
                    onClick={handleRotate}
                    className="p-1 hover:bg-surface-hover rounded text-text-muted hover:text-text-primary ml-1 border-l border-border-subtle pl-2"
                    title="Rotate 90°"
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-[10px] hover:bg-surface-hover rounded text-brand-500 font-bold"
                  >
                    Reset
                  </button>
                </div>
              )}

              {entry.file_path && (
                <button
                  onClick={() => window.api.invoke('app:open-external', entry.file_path!)}
                  className="text-brand-500 hover:underline flex items-center gap-1 text-[11px]"
                >
                  External View <ExternalLink size={12} />
                </button>
              )}
            </div>

            {/* Document Viewer Box */}
            <div className="flex-1 bg-surface-card border border-border-subtle rounded-xl overflow-auto p-3 flex items-center justify-center relative min-h-[300px]">
              {entry.file_path ? (
                isImage ? (
                  <div className="overflow-auto max-w-full max-h-full flex items-center justify-center p-2">
                    <img
                      src={`file://${entry.file_path}`}
                      alt="Attached Bill"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.15s ease-out'
                      }}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-md"
                    />
                  </div>
                ) : isPdf ? (
                  <iframe
                    src={`file://${entry.file_path}`}
                    title="Attached PDF Bill"
                    className="w-full h-full rounded-lg border-0"
                  />
                ) : (
                  <div className="text-center p-6 text-text-muted text-xs space-y-2">
                    <FileText size={40} className="mx-auto text-brand-500/50" />
                    <p className="font-bold text-text-primary">Attached Document File</p>
                    <p className="font-mono text-[11px] break-all">{entry.file_path}</p>
                    <button
                      onClick={() => window.api.invoke('app:open-external', entry.file_path!)}
                      className="px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold shadow"
                    >
                      Open File externally
                    </button>
                  </div>
                )
              ) : (
                <div className="text-center p-8 text-text-muted text-xs space-y-3">
                  <div className="p-3 bg-surface-panel rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-border-subtle">
                    <ImageIcon size={28} className="text-text-muted" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-text-primary text-sm">No Paper Bill Attached</p>
                    <p className="text-[11px] max-w-xs mx-auto text-text-muted">
                      This purchase entry was created without attaching a physical receipt photo or PDF.
                    </p>
                  </div>

                  {onAttachPhoto && (
                    <button
                      onClick={() => onAttachPhoto(entry)}
                      className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 mx-auto shadow-md transition-colors"
                    >
                      <Upload size={14} /> Attach Bill Photo Now
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-4 border-t border-border-subtle mt-4 flex items-center justify-between">
              {onFlagMismatch ? (
                <button
                  onClick={() => onFlagMismatch(entry)}
                  className="px-3.5 py-2 bg-rose-100 dark:bg-rose-950/60 hover:bg-rose-200 dark:hover:bg-rose-900/80 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-700/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <AlertTriangle size={14} /> Flag Mismatch 🚩
                </button>
              ) : <div />}

              <button
                onClick={onClose}
                className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Close Verification
              </button>
            </div>
          </div>

        </div>

      </div>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-voucher, .printable-voucher * {
            visibility: visible;
          }
          .printable-voucher {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
