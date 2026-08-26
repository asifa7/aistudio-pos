import { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Eye,
  Truck,
  IndianRupee,
  ShoppingBag,
  RotateCcw,
  ClipboardList
} from 'lucide-react';
import {
  usePurchaseOrders,
  useGoodsReceipts,
  usePurchaseInvoices,
  usePurchaseReturns,
  useSuppliersProfile,
  useSubmitPurchaseOrder,
  useApprovePurchaseOrder,
  useCancelPurchaseOrder
} from '../../hooks/useSupplierProcurement';
import { formatPaise, formatDate } from '../../types/supplier.types';

// Child view imports (we will build these next)
import PurchaseOrderWizard from './PurchaseOrderWizard';
import GoodsReceiptWizard from './GoodsReceiptWizard';
import PurchaseInvoiceDetails from './PurchaseInvoiceDetails';
import PurchaseReturnsWizard from './PurchaseReturnsWizard';

export default function ProcurementDashboard() {
  const { data: pos, isLoading: isLoadingPos, refetch: refetchPos } = usePurchaseOrders();
  const { data: grns, isLoading: isLoadingGrns, refetch: refetchGrns } = useGoodsReceipts();
  const { data: invoices, isLoading: isLoadingInvoices, refetch: refetchInvoices } = usePurchaseInvoices();
  const { data: returns, isLoading: isLoadingReturns, refetch: refetchReturns } = usePurchaseReturns();
  const { data: suppliers } = useSuppliersProfile();

  // Mutations
  const submitPoMutation = useSubmitPurchaseOrder();
  const approvePoMutation = useApprovePurchaseOrder();
  const cancelPoMutation = useCancelPurchaseOrder();

  // Active View State
  // 'list' | 'create_po' | 'create_grn' | 'create_invoice' | 'create_return' | 'view_po' | 'view_grn' | 'view_invoice' | 'view_return'
  const [viewState, setViewState] = useState<'list' | 'create_po' | 'create_grn' | 'create_invoice' | 'create_return' | 'view_po' | 'view_grn' | 'view_invoice' | 'view_return'>('list');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  // Tabs for the List View
  const [activeTab, setActiveTab] = useState<'pos' | 'grns' | 'invoices' | 'returns'>('pos');

  // Helper: Find supplier name
  const getSupplierName = (supplierId: number) => {
    return suppliers?.find(s => s.id === supplierId)?.company_name || `Supplier #${supplierId}`;
  };

  // Render Stats
  const renderStats = () => {
    const totalPoCount = pos?.length || 0;
    const pendingApprovalPoCount = pos?.filter(p => p.status === 'submitted')?.length || 0;
    const unpaidInvoicesAmount = invoices?.reduce((acc, inv) => acc + (inv.payment_status !== 'paid' ? inv.outstanding_amount_paise : 0), 0) || 0;
    const totalReturnsCount = returns?.length || 0;

    return (
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* PO Stat */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Total Purchase Orders</span>
            <p className="text-xl font-bold font-outfit text-text-secondary mt-1">{totalPoCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <ClipboardList className="text-accent text-lg" size={18} />
          </div>
        </div>

        {/* Pending PO Approval */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Awaiting PO Approval</span>
            <p className={`text-xl font-bold font-outfit mt-1 ${pendingApprovalPoCount > 0 ? 'text-amber-400' : 'text-text-secondary'}`}>
              {pendingApprovalPoCount}
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-950/20 flex items-center justify-center">
            <AlertTriangle className="text-amber-400 text-lg" size={18} />
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Outstanding Payables</span>
            <p className="text-xl font-bold font-mono text-rose-400 mt-1">{formatPaise(unpaidInvoicesAmount)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-950/20 flex items-center justify-center">
            <IndianRupee className="text-rose-400 text-lg" size={18} />
          </div>
        </div>

        {/* Returns */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Purchase Returns</span>
            <p className="text-xl font-bold font-outfit text-text-secondary mt-1">{totalReturnsCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-950/20 flex items-center justify-center">
            <RotateCcw className="text-purple-400 text-lg" size={18} />
          </div>
        </div>
      </div>
    );
  };

  // Close creation/view flows and return to listing
  const handleBackToList = () => {
    setSelectedItemId(null);
    setViewState('list');
    refetchPos();
    refetchGrns();
    refetchInvoices();
    refetchReturns();
  };

  // Rendering conditional sub-views
  if (viewState === 'create_po') {
    return <PurchaseOrderWizard onCancel={handleBackToList} onSuccess={handleBackToList} />;
  }

  if (viewState === 'create_grn') {
    return <GoodsReceiptWizard onCancel={handleBackToList} onSuccess={handleBackToList} />;
  }

  if (viewState === 'create_return') {
    return <PurchaseReturnsWizard onCancel={handleBackToList} onSuccess={handleBackToList} />;
  }

  if (viewState === 'view_invoice' && selectedItemId) {
    return <PurchaseInvoiceDetails invoiceId={selectedItemId} onBack={handleBackToList} />;
  }

  // Handle PO status change actions directly from row
  const handleApprovePo = async (id: number) => {
    if (confirm('Approve this purchase order?')) {
      try {
        await approvePoMutation.mutateAsync(id);
        refetchPos();
      } catch (err: any) {
        alert(err.message || 'Approval failed');
      }
    }
  };

  const handleCancelPo = async (id: number) => {
    if (confirm('Cancel this purchase order?')) {
      try {
        await cancelPoMutation.mutateAsync(id);
        refetchPos();
      } catch (err: any) {
        alert(err.message || 'Cancellation failed');
      }
    }
  };

  const handleSubmitPo = async (id: number) => {
    try {
      await submitPoMutation.mutateAsync(id);
      refetchPos();
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6">
      {/* Header with Quick Actions */}
      <div className="border-b border-border-subtle pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-secondary flex items-center gap-2">
            <ShoppingBag className="text-accent" />
            <span>Procurement & Supply Chain Management</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">Raise POs, receipt goods receipt notes (GRN), process purchase returns, and track accounts payable.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewState('create_po')}
            className="px-3.5 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Plus size={14} /> New PO
          </button>
          <button
            onClick={() => setViewState('create_grn')}
            className="px-3.5 py-2 bg-surface-card hover:bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Truck size={14} /> New GRN
          </button>
          <button
            onClick={() => setViewState('create_return')}
            className="px-3.5 py-2 bg-surface-card hover:bg-surface-app border border-border-subtle text-text-secondary rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-[0.98]"
          >
            <RotateCcw size={14} /> Log Return
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {renderStats()}

      {/* Main List Layout Container */}
      <div className="flex-1 min-h-0 bg-surface-panel rounded-xl border border-border-subtle overflow-hidden flex flex-col shadow-sm">
        {/* Tab switch list */}
        <div className="flex bg-surface-app/40 border-b border-border-subtle p-1 gap-1">
          <button
            onClick={() => setActiveTab('pos')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'pos'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Order Placed
          </button>
          <button
            onClick={() => setActiveTab('grns')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'grns'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Stock Received
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'invoices'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Supplier Bill
          </button>
          <button
            onClick={() => setActiveTab('returns')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'returns'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Purchase Returns
          </button>
        </div>

        {/* Tab Body listing */}
        <div className="flex-1 overflow-y-auto">
          {/* TAB 1: PURCHASE ORDERS */}
          {activeTab === 'pos' && (
            <>
              {isLoadingPos ? (
                <p className="text-xs text-text-muted py-8 text-center">Loading orders...</p>
              ) : pos?.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center italic">No purchase orders found.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-app/40 text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                      <th className="p-4">PO Number</th>
                      <th className="p-4">Order Date</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4 text-right">Total Cost</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                    {pos?.map(po => (
                      <tr key={po.id} className="hover:bg-surface-app/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-accent">{po.po_number}</td>
                        <td className="p-4 text-text-muted">{formatDate(po.order_date)}</td>
                        <td className="p-4 text-text-secondary font-bold">{getSupplierName(po.supplier_id)}</td>
                        <td className="p-4 text-right font-mono font-bold text-text-secondary">{formatPaise(po.total_amount_paise)}</td>
                        <td className="p-4">
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                            po.status === 'draft'
                              ? 'bg-surface-app border-border-subtle text-text-muted'
                              : po.status === 'submitted'
                                ? 'bg-blue-950/20 border-blue-900/50 text-blue-400'
                                : po.status === 'approved'
                                  ? 'bg-brand-500/10 border-green-900/50 text-accent'
                                  : po.status === 'received'
                                    ? 'bg-brand-500/10 border-emerald-900/50 text-brand-500'
                                    : 'bg-rose-950/20 border-rose-900/50 text-rose-400'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          {po.status === 'draft' && (
                            <button
                              onClick={() => handleSubmitPo(po.id)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                            >
                              Submit
                            </button>
                          )}
                          {po.status === 'submitted' && (
                            <>
                              <button
                                onClick={() => handleApprovePo(po.id)}
                                className="px-2 py-1 bg-brand-500 hover:bg-emerald-700 text-white rounded text-[10px] font-bold"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleCancelPo(po.id)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* TAB 2: GOODS RECEIPTS (GRN) */}
          {activeTab === 'grns' && (
            <>
              {isLoadingGrns ? (
                <p className="text-xs text-text-muted py-8 text-center">Loading receipts...</p>
              ) : grns?.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center italic">No goods receipts found.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-app/40 text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                      <th className="p-4">GRN Number</th>
                      <th className="p-4">Received Date</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Delivery Note No.</th>
                      <th className="p-4">PO Reference</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                    {grns?.map(grn => (
                      <tr key={grn.id} className="hover:bg-surface-app/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-text-secondary">{grn.grn_number}</td>
                        <td className="p-4 text-text-muted">{formatDate(grn.received_date)}</td>
                        <td className="p-4 text-text-secondary font-bold">{getSupplierName(grn.supplier_id)}</td>
                        <td className="p-4 font-semibold text-text-muted">{grn.delivery_note_number || 'N/A'}</td>
                        <td className="p-4 font-mono text-[10px] text-accent">
                          {grn.purchase_order_id ? `PO #${grn.purchase_order_id}` : 'Direct Stock Load'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* TAB 3: VENDOR INVOICES */}
          {activeTab === 'invoices' && (
            <>
              {isLoadingInvoices ? (
                <p className="text-xs text-text-muted py-8 text-center">Loading invoices...</p>
              ) : invoices?.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center italic">No invoices found.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-app/40 text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Invoice Date</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4 text-right">Total Amount</th>
                      <th className="p-4 text-right">Outstanding Due</th>
                      <th className="p-4">Payment Status</th>
                      <th className="p-4 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                    {invoices?.map(inv => (
                      <tr key={inv.id} className="hover:bg-surface-app/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-text-secondary">{inv.invoice_number}</td>
                        <td className="p-4 text-text-muted">{formatDate(inv.invoice_date)}</td>
                        <td className="p-4 text-text-secondary font-bold">{getSupplierName(inv.supplier_id)}</td>
                        <td className="p-4 text-right font-mono font-bold text-text-secondary">{formatPaise(inv.total_amount_paise)}</td>
                        <td className="p-4 text-right font-mono font-bold text-rose-400">{formatPaise(inv.outstanding_amount_paise)}</td>
                        <td className="p-4">
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                            inv.payment_status === 'unpaid'
                              ? 'bg-rose-950/20 border-rose-900/50 text-rose-400'
                              : inv.payment_status === 'partially_paid'
                                ? 'bg-amber-950/20 border-amber-900/50 text-amber-400'
                                : 'bg-brand-500/10 border-green-900/50 text-accent'
                          }`}>
                            {inv.payment_status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedItemId(inv.id);
                              setViewState('view_invoice');
                            }}
                            className="p-1 hover:text-accent text-text-muted inline-flex items-center"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* TAB 4: PURCHASE RETURNS */}
          {activeTab === 'returns' && (
            <>
              {isLoadingReturns ? (
                <p className="text-xs text-text-muted py-8 text-center">Loading returns...</p>
              ) : returns?.length === 0 ? (
                <p className="text-xs text-text-muted py-8 text-center italic">No purchase returns logged.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-app/40 text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                      <th className="p-4">Return Number</th>
                      <th className="p-4">Return Date</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Reason</th>
                      <th className="p-4 text-right">Refund Amount</th>
                      <th className="p-4">Resolution Type</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                    {returns?.map(ret => (
                      <tr key={ret.id} className="hover:bg-surface-app/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-text-secondary">{ret.return_number}</td>
                        <td className="p-4 text-text-muted">{formatDate(ret.return_date)}</td>
                        <td className="p-4 text-text-secondary font-bold">{getSupplierName(ret.supplier_id)}</td>
                        <td className="p-4 text-text-muted max-w-[150px] truncate">{ret.reason || 'None provided'}</td>
                        <td className="p-4 text-right font-mono font-bold text-brand-500">{formatPaise(ret.total_refund_amount_paise)}</td>
                        <td className="p-4">
                          <span className="bg-surface-app border border-border-subtle px-2 py-0.5 rounded text-[9px] uppercase font-bold text-text-secondary">
                            {ret.resolved_via}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
