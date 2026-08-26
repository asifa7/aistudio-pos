import { AlertTriangle, Check, X, Image as ImageIcon } from 'lucide-react';
import { PurchaseInvoiceRow, formatPaise, formatDate } from '../../types/supplier.types';
import { useUpdateInvoiceStatus, useSuppliersProfile } from '../../hooks/useSupplierProcurement';

interface Props {
  invoices: PurchaseInvoiceRow[];
}

export default function PendingApprovalsView({ invoices }: Props) {
  const { data: suppliers } = useSuppliersProfile();
  const updateStatusMutation = useUpdateInvoiceStatus();

  const handleApprove = async (id: number) => {
    if (confirm('Approve this purchase bill? Stock has already been updated.')) {
      try {
        await updateStatusMutation.mutateAsync({ invoiceId: id, status: 'approved' });
      } catch (err: any) {
        alert('Failed to approve: ' + err.message);
      }
    }
  };

  const handleReject = async (id: number) => {
    if (confirm('Reject this purchase bill? This flags the financial record for correction, but does NOT automatically reverse stock.')) {
      try {
        await updateStatusMutation.mutateAsync({ invoiceId: id, status: 'rejected' });
      } catch (err: any) {
        alert('Failed to reject: ' + err.message);
      }
    }
  };

  const getSupplierName = (id: number) => {
    return suppliers?.find(s => s.id === id)?.company_name || `Supplier #${id}`;
  };

  if (invoices.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4 text-green-600">
          <Check size={32} />
        </div>
        <h3 className="text-lg font-bold text-text-primary">All caught up!</h3>
        <p className="text-text-muted text-sm mt-1">No pending quick purchase bills to approve.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
            <AlertTriangle className="text-amber-500" /> Pending Approvals
          </h2>
          <p className="text-text-muted text-xs mt-1">
            Review Quick Purchase bills submitted by cashiers. Rejection does not reverse stock automatically.
          </p>
        </div>

        <div className="bg-surface-panel rounded-xl border border-border-subtle shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-app/50">
                <th className="py-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider">Supplier</th>
                <th className="py-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider">Bill No.</th>
                <th className="py-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider text-center">Attachment</th>
                <th className="py-3 px-4 text-xs font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-surface-hover transition-colors">
                  <td className="py-3 px-4 text-sm text-text-secondary">{formatDate(inv.invoice_date)}</td>
                  <td className="py-3 px-4 text-sm font-bold text-text-primary">{getSupplierName(inv.supplier_id)}</td>
                  <td className="py-3 px-4 text-sm font-mono text-text-secondary">
                    {inv.supplier_invoice_number || '-'}
                  </td>
                  <td className="py-3 px-4 text-sm font-mono font-bold text-text-primary text-right">
                    {formatPaise(inv.total_amount_paise)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {inv.file_path ? (
                      <button 
                        onClick={() => window.api.invoke('app:open-external', inv.file_path)}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-bold bg-brand-50 px-2 py-1 rounded"
                        title={inv.file_path}
                      >
                        <ImageIcon size={14} /> View
                      </button>
                    ) : (
                      <span className="text-xs text-text-muted italic">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApprove(inv.id)}
                        disabled={updateStatusMutation.isPending}
                        className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(inv.id)}
                        disabled={updateStatusMutation.isPending}
                        className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
