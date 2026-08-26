import { X, Printer } from 'lucide-react';
import { formatPaise, formatDate } from '../../types/supplier.types';

export interface InvoiceTemplateData {
  invoiceNumber: string;
  invoiceDate: string;
  poNumber?: string;
  dueDate?: string;
  fromName: string;
  fromAddress?: string;
  fromCityStateZip?: string;
  fromPhone?: string;
  billToName: string;
  billToAddress?: string;
  billToCityStateZip?: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToCityStateZip?: string;
  items: Array<{
    qty: number;
    description: string;
    unitPricePaise: number;
    amountPaise: number;
  }>;
  subtotalPaise: number;
  taxPercent?: number;
  taxPaise?: number;
  totalPaise: number;
  notes?: string;
  isEdited?: boolean;
}

interface InvoiceTemplateModalProps {
  data: InvoiceTemplateData;
  onClose: () => void;
}

export default function InvoiceTemplateModal({ data, onClose }: InvoiceTemplateModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      {/* Modal Container */}
      <div className="bg-white text-slate-900 rounded-lg shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Top Controls Bar (Hidden during print) */}
        <div className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">Invoice Preview & Print</span>
            <span className="text-xs text-slate-400">({data.invoiceNumber})</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={14} /> Print Invoice
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (Exact match to requested layout) */}
        <div className="p-8 sm:p-12 overflow-y-auto flex-1 bg-white font-sans text-slate-800 printable-document">
          {/* Header Section */}
          <div className="flex justify-between items-start mb-8 border-b-2 border-slate-200 pb-6 relative">
            {data.isEdited && (
              <div className="absolute left-[38%] top-[10%] rotate-[-12deg] bg-amber-100 border-2 border-amber-600 text-amber-800 text-[10px] font-black tracking-widest px-3 py-1.5 uppercase select-none rounded shadow-sm opacity-95 border-dashed z-10 print:visible">
                ⚠️ Revised / Edited Invoice
              </div>
            )}
            <div>
              <div className="w-16 h-2 bg-gradient-to-r from-slate-400 via-slate-300 to-slate-200 mb-2"></div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 uppercase font-mono">invoice</h1>
            </div>
            {/* LOGO Circle */}
            <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs tracking-wider border-2 border-slate-400">
              LOGO
            </div>
          </div>

          {/* Top Info Grid */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
            {/* FROM */}
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">FROM</p>
              <p className="font-bold text-sm text-slate-900">{data.fromName}</p>
              {data.fromAddress && <p className="text-slate-600">{data.fromAddress}</p>}
              {data.fromCityStateZip && <p className="text-slate-600">{data.fromCityStateZip}</p>}
              {data.fromPhone && <p className="text-slate-600">Ph: {data.fromPhone}</p>}
            </div>

            {/* INVOICE DETAILS */}
            <div className="text-right space-y-1">
              <div className="flex justify-end gap-4">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">SUPPLIER BILL #</span>
                <span className="font-mono font-bold text-slate-900">{data.invoiceNumber || 'N/A'}</span>
              </div>
              <div className="flex justify-end gap-4">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">INVOICE DATE</span>
                <span className="font-mono text-slate-700">{formatDate(data.invoiceDate)}</span>
              </div>
              {data.poNumber && (
                <div className="flex justify-end gap-4">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">INTERNAL REF #</span>
                  <span className="font-mono text-slate-700">{data.poNumber}</span>
                </div>
              )}
              {data.dueDate && (
                <div className="flex justify-end gap-4">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">DUE DATE</span>
                  <span className="font-mono text-slate-700">{formatDate(data.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* BILL TO & SHIP TO */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-xs border-t border-b border-slate-100 py-4">
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">BILL TO</p>
              <p className="font-bold text-slate-900">{data.billToName}</p>
              {data.billToAddress && <p className="text-slate-600">{data.billToAddress}</p>}
              {data.billToCityStateZip && <p className="text-slate-600">{data.billToCityStateZip}</p>}
            </div>
            <div>
              <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">SHIP TO</p>
              <p className="font-bold text-slate-900">{data.shipToName || data.billToName}</p>
              {data.shipToAddress && <p className="text-slate-600">{data.shipToAddress}</p>}
              {data.shipToCityStateZip && <p className="text-slate-600">{data.shipToCityStateZip}</p>}
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="mb-8">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-t-2 border-b-2 border-slate-800 text-[10px] uppercase tracking-wider text-slate-700">
                  <th className="py-2 px-2 w-16 text-center">QTY</th>
                  <th className="py-2 px-2">DESCRIPTION</th>
                  <th className="py-2 px-2 text-right w-28">UNIT PRICE</th>
                  <th className="py-2 px-2 text-right w-28">AMOUNT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                {data.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-2 text-center font-mono">{item.qty}</td>
                    <td className="py-3 px-2">{item.description}</td>
                    <td className="py-3 px-2 text-right font-mono">{formatPaise(item.unitPricePaise)}</td>
                    <td className="py-3 px-2 text-right font-mono font-bold">{formatPaise(item.amountPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BOTTOM TOTALS & SIGNATURE */}
          <div className="flex justify-between items-end pt-4">
            {/* Signature Area */}
            <div className="w-1/2 pt-8">
              <div className="border-b-2 border-slate-800 w-48 mb-1"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorized Signature</p>
            </div>

            {/* Financial Summary */}
            <div className="w-1/2 space-y-2 text-xs text-right">
              <div className="flex justify-end gap-6 text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono font-bold text-slate-800">{formatPaise(data.subtotalPaise)}</span>
              </div>
              {(data.taxPaise ?? 0) > 0 && (
                <div className="flex justify-end gap-6 text-slate-600">
                  <span>Sales Tax ({data.taxPercent || 0}%)</span>
                  <span className="font-mono font-bold text-slate-800">{formatPaise(data.taxPaise || 0)}</span>
                </div>
              )}

              {/* Bold Boxed TOTAL */}
              <div className="mt-4 border-2 border-slate-900 p-3 bg-slate-50 flex justify-between items-center text-slate-900 shadow-sm">
                <span className="text-base font-extrabold uppercase tracking-widest font-mono">TOTAL</span>
                <span className="text-xl font-extrabold font-mono">{formatPaise(data.totalPaise)}</span>
              </div>
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
          .printable-document, .printable-document * {
            visibility: visible;
          }
          .printable-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
