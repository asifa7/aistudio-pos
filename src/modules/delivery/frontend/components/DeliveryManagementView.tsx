// src/modules/delivery/frontend/components/DeliveryManagementView.tsx
// Simplified Local Shop Delivery View: Lists only bills marked for delivery with payment and dispatch status

import React, { useState, useMemo } from 'react';
import {
  Truck,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Phone,
  User,
  MapPin,
  DollarSign,
  AlertCircle,
  Calendar,
  Check
} from 'lucide-react';
import {
  useDeliveries,
  useUpdateDeliveryStatus,
  useRecordCOD
} from '../hooks/useDelivery';
import { DeliveryOrder, DeliveryStatus } from '../../types/delivery.types';
import DateRangePicker from '../../../../core/shared/DateRangePicker';

export const DeliveryManagementView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: deliveries = [], isLoading, refetch, isFetching } = useDeliveries({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const updateStatusMutation = useUpdateDeliveryStatus();
  const recordCODMutation = useRecordCOD();

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      // Search text match
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesBill = (d.invoice_number || '').toLowerCase().includes(query) || String(d.id).includes(query);
        const matchesCustomer = (d.customer_name || '').toLowerCase().includes(query);
        const matchesPhone = (d.customer_phone || '').includes(query);
        const matchesAddress = (d.delivery_address_snapshot || '').toLowerCase().includes(query);
        if (!matchesBill && !matchesCustomer && !matchesPhone && !matchesAddress) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'delivered' && d.status !== 'delivered') return false;
        if (statusFilter === 'out' && d.status !== 'out_for_delivery') return false;
        if (statusFilter === 'pending' && !['pending', 'order_created', 'preparing'].includes(d.status)) return false;
      }

      // Payment filter
      if (paymentFilter !== 'all') {
        const isPaid = d.payment_status === 'paid';
        if (paymentFilter === 'paid' && !isPaid) return false;
        if (paymentFilter === 'pending' && isPaid) return false;
      }

      return true;
    });
  }, [deliveries, searchTerm, statusFilter, paymentFilter]);

  // Quick Stats
  const stats = useMemo(() => {
    let totalBills = deliveries.length;
    let paymentDoneCount = 0;
    let paymentPendingCount = 0;
    let outForDeliveryCount = 0;
    let deliveredCount = 0;

    for (const d of deliveries) {
      if (d.payment_status === 'paid') paymentDoneCount++;
      else paymentPendingCount++;

      if (d.status === 'delivered') deliveredCount++;
      else if (d.status === 'out_for_delivery') outForDeliveryCount++;
    }

    return {
      totalBills,
      paymentDoneCount,
      paymentPendingCount,
      outForDeliveryCount,
      deliveredCount,
    };
  }, [deliveries]);

  // Handle Mark Payment Done
  const handleMarkPaymentDone = async (delivery: DeliveryOrder) => {
    if (window.confirm(`Confirm payment received for Bill #${delivery.invoice_number || delivery.id} (₹${((delivery.total_paise || 0) / 100).toFixed(2)})?`)) {
      try {
        await recordCODMutation.mutateAsync({
          deliveryId: delivery.id,
          amountCollectedPaise: delivery.total_paise || 0,
          collectionMethod: 'cash',
        });
        refetch();
      } catch (err: any) {
        alert(`Failed to update payment: ${err?.message || 'Unknown error'}`);
      }
    }
  };

  // Handle Advance Delivery Status
  const handleAdvanceStatus = async (delivery: DeliveryOrder, nextStatus: DeliveryStatus) => {
    try {
      await updateStatusMutation.mutateAsync({
        id: delivery.id,
        status: nextStatus,
      });
      refetch();
    } catch (err: any) {
      alert(`Failed to update delivery status: ${err?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-base text-text-primary overflow-hidden p-4 sm:p-6 gap-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-text-primary tracking-tight">Delivery Orders</h1>
              <p className="text-xs text-text-muted">Simple tracking for bills marked as doorstep delivery</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-xl text-xs font-bold text-text-secondary cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <div className="p-3.5 bg-surface-card border border-border-subtle rounded-2xl shadow-xs">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Total Delivery Bills</div>
          <div className="text-2xl font-black text-text-primary mt-1">{stats.totalBills}</div>
        </div>

        <div className="p-3.5 bg-surface-card border border-emerald-500/20 rounded-2xl shadow-xs">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={13} /> Payment Done
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.paymentDoneCount}</div>
        </div>

        <div className="p-3.5 bg-surface-card border border-amber-500/20 rounded-2xl shadow-xs">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <Clock size={13} /> Payment Pending / COD
          </div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.paymentPendingCount}</div>
        </div>

        <div className="p-3.5 bg-surface-card border border-blue-500/20 rounded-2xl shadow-xs">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-400 flex items-center gap-1">
            <Truck size={13} /> Out / Delivered
          </div>
          <div className="text-2xl font-black text-blue-400 mt-1">
            {stats.outForDeliveryCount} <span className="text-xs text-text-muted font-normal">out</span> / {stats.deliveredCount} <span className="text-xs text-text-muted font-normal">done</span>
          </div>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="p-3.5 bg-surface-card border border-border-subtle rounded-2xl flex flex-wrap items-center gap-3 shrink-0 shadow-xs">
        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by Bill #, Customer name, Phone, Address..."
            className="w-full pl-9 pr-3 py-2 bg-surface-app border border-border-subtle rounded-xl text-xs font-semibold text-text-primary outline-none focus:border-brand-500"
          />
        </div>

        {/* Date Filter */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          labelFrom="From"
          labelTo="To"
        />

        {/* Payment Filter */}
        <div className="flex items-center gap-1 bg-surface-app border border-border-subtle px-2 py-1.5 rounded-xl text-xs">
          <span className="text-[10px] font-bold text-text-muted uppercase shrink-0">Payment:</span>
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="bg-transparent font-bold text-xs text-text-primary outline-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="paid">Payment Done</option>
            <option value="pending">Payment Pending (COD)</option>
          </select>
        </div>

        {/* Delivery Status Filter */}
        <div className="flex items-center gap-1 bg-surface-app border border-border-subtle px-2 py-1.5 rounded-xl text-xs">
          <span className="text-[10px] font-bold text-text-muted uppercase shrink-0">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-transparent font-bold text-xs text-text-primary outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending / Preparing</option>
            <option value="out">Out for Delivery</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Delivery Bills Table */}
      <div className="flex-1 min-h-0 bg-surface-card border border-border-subtle rounded-2xl shadow-xs overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
            Loading delivery orders...
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
            <Truck size={36} className="opacity-25 mb-2" />
            <p className="text-sm font-bold text-text-secondary">No delivery bills found</p>
            <p className="text-xs text-text-muted mt-0.5">
              Bills marked as "Delivery" in the Billing screen will automatically show up here.
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-surface-panel border-b border-border-subtle text-text-muted font-extrabold uppercase text-[10px] z-10">
                <tr>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Customer & Address</th>
                  <th className="py-3 px-4 text-right">Bill Amount</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Delivery Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredDeliveries.map(delivery => {
                  const isPaid = delivery.payment_status === 'paid';
                  const isDelivered = delivery.status === 'delivered';
                  const isOut = delivery.status === 'out_for_delivery';
                  const billTotal = ((delivery.total_paise || 0) / 100).toFixed(2);
                  const deliveryFee = delivery.delivery_fee_paise ? (delivery.delivery_fee_paise / 100).toFixed(2) : null;

                  return (
                    <tr key={delivery.id} className="hover:bg-surface-hover/50 transition-colors">
                      {/* Bill # */}
                      <td className="py-3.5 px-4 font-mono font-black text-brand-500">
                        #{delivery.invoice_number || delivery.id}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-text-secondary">
                          {delivery.created_at ? new Date(delivery.created_at).toLocaleDateString() : '-'}
                        </div>
                        <div className="font-mono text-[10px] text-text-muted">
                          {delivery.created_at ? new Date(delivery.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      {/* Customer & Address */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-extrabold text-text-primary flex items-center gap-1.5">
                          <User size={12} className="text-text-muted shrink-0" />
                          <span className="truncate">{delivery.customer_name || 'Customer'}</span>
                        </div>
                        {delivery.customer_phone && (
                          <div className="font-mono text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
                            <Phone size={11} className="shrink-0" />
                            <span>{delivery.customer_phone}</span>
                          </div>
                        )}
                        {delivery.delivery_address_snapshot && (
                          <div className="text-[11px] text-text-secondary flex items-start gap-1.5 mt-1">
                            <MapPin size={12} className="text-brand-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{delivery.delivery_address_snapshot}</span>
                          </div>
                        )}
                      </td>

                      {/* Bill Amount */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-black text-sm text-text-primary">
                          ₹{billTotal}
                        </div>
                        {deliveryFee && (
                          <div className="text-[10px] text-text-muted font-mono">
                            incl. ₹{deliveryFee} fee
                          </div>
                        )}
                      </td>

                      {/* Payment Status (Clear Done vs Pending) */}
                      <td className="py-3.5 px-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-2xs">
                            <CheckCircle2 size={13} />
                            Payment Done
                          </span>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-2xs">
                              <Clock size={13} />
                              Pending (COD)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleMarkPaymentDone(delivery)}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-xs cursor-pointer transition-colors"
                            >
                              ✓ Mark Paid
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Delivery Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase ${
                          isDelivered
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isOut
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}>
                          {isDelivered ? '✓ Delivered' : isOut ? '🚚 On The Way' : '📦 Preparing'}
                        </span>
                        {delivery.driver_name && (
                          <div className="text-[10px] text-text-muted mt-1 font-semibold">
                            Driver: {delivery.driver_name}
                          </div>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isDelivered && !isOut && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStatus(delivery, 'out_for_delivery')}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                              Start Delivery
                            </button>
                          )}
                          {isOut && !isDelivered && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStatus(delivery, 'delivered')}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            >
                              Mark Delivered
                            </button>
                          )}
                          {isDelivered && (
                            <span className="text-[11px] font-bold text-text-muted">Completed</span>
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
    </div>
  );
};

export default DeliveryManagementView;
