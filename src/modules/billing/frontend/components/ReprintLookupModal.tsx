// src/modules/billing/frontend/components/ReprintLookupModal.tsx
// Bill Search & Action Hub: Search by Bill #, Date, Customer, Item + 1-Click Reprint, Edit & Delete with Security

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Printer,
  Calendar,
  Filter,
  ChevronDown,
  Edit3,
  Trash2,
  Lock,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useQueryClient } from '@tanstack/react-query';
import DateRangePicker from '../../../../core/shared/DateRangePicker';

interface ReprintLookupModalProps {
  onClose: () => void;
  onPrintReceipt: (invoiceId: number) => void;
  onSelectBillForEdit?: (invoiceId: number) => void;
}

export default function ReprintLookupModal({
  onClose,
  onPrintReceipt,
  onSelectBillForEdit
}: ReprintLookupModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [billNumber, setBillNumber] = useState('');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');

  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Password Modals State
  const [activeActionBill, setActiveActionBill] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'edit' | 'delete' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const cart = useCart();
  const queryClient = useQueryClient();

  // Catalog product names for searchable dropdown
  const [catalogProducts, setCatalogProducts] = useState<string[]>([]);
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch product catalog variants on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await window.api.invoke('billing:get-variants');
        if (res.success && Array.isArray(res.data)) {
          const names = new Set<string>();
          res.data.forEach((v: any) => {
            const fullName = `${v.product_name} ${v.variant_name && v.variant_name !== 'Default' ? v.variant_name : ''}`.trim();
            if (fullName) names.add(fullName);
            if (v.product_name) names.add(v.product_name);
          });
          setCatalogProducts(Array.from(names).sort());
        }
      } catch (err) {
        console.warn('Failed to load product catalog for reprint search:', err);
      }
    };
    fetchCatalog();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        itemInputRef.current &&
        !itemInputRef.current.contains(e.target as Node)
      ) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchBills = async () => {
    setIsLoading(true);
    setError('');
    try {
      const filter: any = {
        startDate,
        endDate,
        paymentStatus,
      };
      if (billNumber.trim()) filter.billNumber = billNumber.trim();
      if (itemName.trim()) filter.itemName = itemName.trim();
      if (quantity && !isNaN(Number(quantity))) filter.quantity = Number(quantity);
      if (minAmount && !isNaN(Number(minAmount))) filter.minAmount = Number(minAmount);
      if (maxAmount && !isNaN(Number(maxAmount))) filter.maxAmount = Number(maxAmount);

      const res = await window.api.invoke('billing:search-invoices', filter);
      if (res.success) {
        setBills(res.data || []);
      } else {
        setError(res.error?.message || 'Failed to search bills');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search bills');
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time auto search when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBills();
    }, 200);
    return () => clearTimeout(timer);
  }, [startDate, endDate, billNumber, itemName, quantity, minAmount, maxAmount, paymentStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills();
  };

  const handleResetFilters = () => {
    setStartDate(todayStr);
    setEndDate(todayStr);
    setBillNumber('');
    setItemName('');
    setQuantity('');
    setMinAmount('');
    setMaxAmount('');
    setPaymentStatus('all');
    setShowItemDropdown(false);
  };

  // Initiate Edit Flow
  const handleInitiateEdit = (bill: any) => {
    setActiveActionBill(bill);
    setActionType('edit');
    setAuthPassword('');
    setActionError('');
  };

  // Initiate Delete Flow
  const handleInitiateDelete = (bill: any) => {
    setActiveActionBill(bill);
    setActionType('delete');
    setAuthPassword('');
    setDeleteReason('Customer requested cancellation / cashier correction');
    setActionError('');
  };

  // Execute Confirmed Action (Edit or Delete)
  const handleExecuteAction = async () => {
    if (!activeActionBill || !actionType) return;
    setActionError('');
    setIsProcessingAction(true);

    try {
      // 1. Check password
      const verifyRes = await window.api.invoke('billing:verify-action-password', { password: authPassword });
      if (!verifyRes.success || !verifyRes.data) {
        setActionError('Invalid password. Authorization failed.');
        setIsProcessingAction(false);
        return;
      }

      if (actionType === 'edit') {
        // Reopen invoice into draft
        const reopenRes = await window.api.invoke('billing:reopen-invoice', {
          invoice_id: activeActionBill.id,
          password: authPassword,
        });

        if (reopenRes.success) {
          await cart.loadInvoice(activeActionBill.id);
          queryClient.invalidateQueries({ queryKey: ['billing', 'held'] });
          if (onSelectBillForEdit) {
            onSelectBillForEdit(activeActionBill.id);
          }
          onClose();
        } else {
          setActionError(reopenRes.error?.message || 'Failed to reopen bill for editing');
        }
      } else if (actionType === 'delete') {
        const deleteRes = await window.api.invoke('billing:delete-invoice', {
          invoice_id: activeActionBill.id,
          reason: deleteReason.trim() || 'Deleted by user',
          password: authPassword,
        });

        if (deleteRes.success) {
          setSuccessMessage(`Bill #${activeActionBill.invoice_number || activeActionBill.id} deleted successfully. Stock restored.`);
          setActiveActionBill(null);
          setActionType(null);
          setBills(prev => prev.filter(b => b.id !== activeActionBill.id));
          queryClient.invalidateQueries({ queryKey: ['billing', 'held'] });
        } else {
          setActionError(deleteRes.error?.message || 'Failed to delete bill');
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'Operation failed');
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500">
              <Search size={16} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-text-primary">Bill Search & Management</h2>
              <p className="text-[10px] text-text-muted">Find bills by number or date to Reprint, Edit, or Delete</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-xs font-bold text-emerald-400 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Filters Bar */}
        <form onSubmit={handleSearchSubmit} className="p-3 border-b border-border-subtle bg-surface-panel/50 space-y-2 flex-shrink-0 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {/* Universal Date Range Filter */}
            <div className="md:col-span-2">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => {
                  setStartDate(s);
                  setEndDate(e);
                }}
                labelFrom="From Date"
                labelTo="To Date"
              />
            </div>

            {/* Bill Number Search */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Bill / Invoice Number</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. 101 or INV-00101"
                  value={billNumber}
                  onChange={e => setBillNumber(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500"
                />
                <Search size={13} className="absolute left-2 top-2 text-text-muted" />
              </div>
            </div>

            {/* Item Name Dropdown */}
            <div className="relative">
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Product / Cut Name</label>
              <div className="relative">
                <input
                  ref={itemInputRef}
                  type="text"
                  placeholder="Filter by product name..."
                  value={itemName}
                  onChange={e => {
                    setItemName(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                  className="w-full pl-2 pr-7 py-1.5 bg-surface-card border border-border-subtle rounded-md text-text-primary outline-none focus:border-brand-500"
                />
                <ChevronDown size={13} className="absolute right-2 top-2 text-text-muted pointer-events-none" />
              </div>

              {/* Autocomplete Dropdown */}
              {showItemDropdown && catalogProducts.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-surface-card border border-border-subtle rounded-md shadow-xl divide-y divide-border-subtle/40"
                >
                  {catalogProducts
                    .filter(p => !itemName || p.toLowerCase().includes(itemName.toLowerCase()))
                    .slice(0, 15)
                    .map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setItemName(p);
                          setShowItemDropdown(false);
                        }}
                        className="px-2.5 py-1.5 hover:bg-surface-hover cursor-pointer text-xs font-semibold text-text-primary"
                      >
                        {p}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1">
            {/* Quantity */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Item Quantity</label>
              <input
                type="number"
                step="any"
                placeholder="e.g. 1.5"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500"
              />
            </div>

            {/* Min Amount */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Min Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500"
              />
            </div>

            {/* Max Amount */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Max Amount (₹)</label>
              <input
                type="number"
                placeholder="5000"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500"
              />
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md text-text-primary outline-none focus:border-brand-500 cursor-pointer font-bold"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            {/* Filter Actions */}
            <div className="flex items-end gap-1.5">
              <button
                type="submit"
                className="btn-primary flex-1 py-1.5 text-xs font-extrabold flex items-center justify-center gap-1 shadow-subtle cursor-pointer"
              >
                <Search size={12} /> Search
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary py-1.5 px-2 text-xs font-bold cursor-pointer"
                title="Reset Filters"
              >
                Reset
              </button>
            </div>
          </div>
        </form>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3">
          {error && <p className="text-xs font-semibold text-red-400 mb-2 p-2 bg-red-950/40 rounded border border-red-800/40">{error}</p>}

          {isLoading ? (
            <div className="p-8 text-center text-xs text-text-muted">Searching bills...</div>
          ) : bills.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted space-y-1">
              <Filter size={24} className="mx-auto opacity-40" />
              <p className="font-bold text-text-secondary">No bills match the selected filter criteria.</p>
              <p className="text-[10px]">Enter the original bill number above or change the date range.</p>
            </div>
          ) : (
            <div className="border border-border-subtle rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-surface-card border-b border-border-subtle text-[10px] uppercase font-extrabold text-text-muted select-none">
                  <tr>
                    <th className="p-2.5">Bill No</th>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Customer Name</th>
                    <th className="p-2.5 text-center">Items</th>
                    <th className="p-2.5 text-right">Total Amount</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60 font-medium">
                  {bills.map(bill => {
                    const invNo = bill.invoice_number ? `#${bill.invoice_number.split('_')[0]}` : `#${bill.id}`;
                    const createdDate = new Date(bill.created_at);
                    const dateFormatted = createdDate.toLocaleDateString();
                    const timeFormatted = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isVoid = bill.status === 'void' || bill.derived_status === 'Cancelled';

                    return (
                      <tr key={bill.id} className="hover:bg-surface-hover/50 transition-colors">
                        <td className="p-2.5 font-mono font-extrabold text-brand-500">{invNo}</td>
                        <td className="p-2.5 font-mono text-[11px]">
                          {dateFormatted} <span className="text-text-muted">{timeFormatted}</span>
                        </td>
                        <td className="p-2.5 font-bold text-text-primary">
                          {bill.customer_name || 'Walk-in Customer'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-text-secondary">
                          {bill.item_count || 1}
                        </td>
                        <td className="p-2.5 text-right font-mono font-extrabold text-text-primary">
                          ₹{(bill.total_paise / 100).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                              isVoid
                                ? 'bg-red-950/40 border-red-800/40 text-red-400'
                                : bill.status === 'completed'
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                            }`}
                          >
                            {bill.derived_status || bill.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reprint */}
                            <button
                              type="button"
                              onClick={() => onPrintReceipt(bill.id)}
                              className="px-2 py-1 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-md text-[10px] font-bold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Reprint Thermal Receipt"
                            >
                              <Printer size={11} /> Print
                            </button>

                            {/* Edit Bill */}
                            {!isVoid && (
                              <button
                                type="button"
                                onClick={() => handleInitiateEdit(bill)}
                                className="px-2 py-1 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-[10px] font-extrabold transition-all flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Reopen Bill for Editing (Quantities / Items)"
                              >
                                <Edit3 size={11} /> Edit
                              </button>
                            )}

                            {/* Delete Bill */}
                            {!isVoid && (
                              <button
                                type="button"
                                onClick={() => handleInitiateDelete(bill)}
                                className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-400 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Delete Bill & Restore Stock"
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Password / Confirmation Action Modal */}
        {actionType && activeActionBill && (
          <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-card border border-border-subtle rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    actionType === 'delete'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                  }`}
                >
                  {actionType === 'delete' ? <Trash2 size={20} /> : <Lock size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary">
                    {actionType === 'delete' ? 'Delete Bill Confirmation' : 'Edit Bill Authorization'}
                  </h3>
                  <p className="text-[11px] text-text-muted">
                    Bill #{activeActionBill.invoice_number || activeActionBill.id} (₹{((activeActionBill.total_paise || 0) / 100).toFixed(2)})
                  </p>
                </div>
              </div>

              {actionType === 'delete' && (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-text-muted mb-1">
                    Reason for Deletion
                  </label>
                  <textarea
                    rows={2}
                    value={deleteReason}
                    onChange={e => setDeleteReason(e.target.value)}
                    placeholder="Enter reason for deleting this bill..."
                    className="w-full px-3 py-2 bg-surface-app border border-border-subtle rounded-xl text-xs text-text-primary outline-none focus:border-red-500 font-semibold"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Deleting will restore all deducted stock back to inventory and log this action.
                  </p>
                </div>
              )}

              {actionType === 'edit' && (
                <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-xs text-brand-200">
                  Reopening this bill allows changing quantities, adding/removing items, or changing customer details. Stock is automatically managed.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-text-muted mb-1">
                  Manager / Admin Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="Enter authorization password..."
                  className="w-full px-3 py-2 bg-surface-app border border-border-subtle rounded-xl text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleExecuteAction();
                  }}
                />
              </div>

              {actionError && (
                <div className="p-2.5 bg-red-950/40 border border-red-800/40 rounded-xl text-xs font-bold text-red-400">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setActionType(null);
                    setActiveActionBill(null);
                    setActionError('');
                  }}
                  className="btn-secondary px-3 py-1.5 text-xs font-bold cursor-pointer"
                  disabled={isProcessingAction}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={isProcessingAction}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer ${
                    actionType === 'delete'
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-brand-500 hover:bg-brand-600 text-white'
                  }`}
                >
                  {isProcessingAction ? 'Processing...' : actionType === 'delete' ? 'Confirm Delete' : 'Reopen for Edit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
