import { useState } from 'react';
import {
  Plus, Search, Eye, Edit3, UserCheck, ChevronLeft, ChevronRight,
  Ban, GitMerge, UtensilsCrossed, AlertTriangle, Sparkles, Clock,
  Calendar, Award, Activity, Phone, MessageSquare, ArrowUpDown
} from 'lucide-react';
import { useCustomers, useCrmAlertsSummary, useCustomersNeedingAttention } from '../hooks/useCustomers';
import { formatPaise, getCategoryBadgeColor, getSegmentBadgeStyle } from '../types/customer.types';
import type { Customer, AttentionCustomerItem } from '../types/customer.types';
import CustomerForm from './CustomerForm';
import CustomerDetailView from './CustomerDetailView';
import CustomerMergeModal from './CustomerMergeModal';

export default function CustomerList() {
  const { data: customerList, isLoading } = useCustomers(true);
  const { data: crmAlerts } = useCrmAlertsSummary();
  
  const [viewMode, setViewMode] = useState<'all' | 'retention'>('all');
  const [attentionSortBy, setAttentionSortBy] = useState<'days_overdue' | 'lifetime_value'>('days_overdue');
  const { data: attentionCustomers, isLoading: isAttentionLoading } = useCustomersNeedingAttention(attentionSortBy);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive' | 'outstanding' | 'advance'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeSourceCustomer, setMergeSourceCustomer] = useState<Customer | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const rawCustomers = customerList ?? [];

  // Client-side filtering
  const filtered = rawCustomers.filter((c) => {
    const query = search.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.includes(query)) ||
      (c.whatsapp && c.whatsapp.includes(query)) ||
      c.customer_code.toLowerCase().includes(query) ||
      (c.business_name && c.business_name.toLowerCase().includes(query));

    let matchesTab = true;
    if (activeTab === 'active') matchesTab = c.is_active === 1;
    else if (activeTab === 'inactive') matchesTab = c.is_active === 0;
    else if (activeTab === 'outstanding') matchesTab = c.outstanding_balance_paise > 0;
    else if (activeTab === 'advance') matchesTab = c.advance_balance_paise > 0;

    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;

    return matchesSearch && matchesTab && matchesCategory;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totalOutstanding = filtered.reduce((s, r) => s + r.outstanding_balance_paise, 0);
  const totalAdvance = filtered.reduce((s, r) => s + r.advance_balance_paise, 0);

  const categories: string[] = ['All', 'Hotel', 'Restaurant', 'Retail', 'Wholesale', 'Catering', 'Distributor', 'Contract'];

  const handleRowClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const handleAttentionCustomerClick = (att: AttentionCustomerItem) => {
    const fullCust = rawCustomers.find(c => c.id === att.customer_id);
    if (fullCust) {
      setSelectedCustomer(fullCust);
      setIsDetailOpen(true);
    }
  };

  const handleEditClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  const handleMergeClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setMergeSourceCustomer(customer);
    setIsMergeOpen(true);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-5 select-none text-xs text-text-primary bg-surface-app">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary font-outfit">Customer Accounts & CRM Hub</h2>
          <p className="text-xs text-text-muted mt-0.5">Manage customer profiles, purchase history, visit intelligence & retention alerts</p>
        </div>
        <button
          onClick={() => {
            setSelectedCustomer(null);
            setIsFormOpen(true);
          }}
          className="btn-primary px-4 py-2.5 text-xs font-bold flex items-center gap-2"
        >
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* Row 1: Financial & Account Stats Banner */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center justify-between shadow-elevation">
          <div>
            <p className="text-[10px] text-text-muted font-medium uppercase">Active Accounts</p>
            <p className="text-lg font-bold text-text-primary mt-1">{rawCustomers.filter(c => c.is_active === 1).length}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/50 flex items-center justify-center text-brand-500">
            <UserCheck size={18} />
          </div>
        </div>
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center justify-between shadow-elevation">
          <div>
            <p className="text-[10px] text-text-muted font-medium uppercase">Total A/R Outstanding</p>
            <p className="text-lg font-bold text-amber-400 mt-1 font-mono">{formatPaise(totalOutstanding)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <Ban size={18} />
          </div>
        </div>
        <div className="bg-surface-panel border border-border-subtle rounded-xl p-4 flex items-center justify-between shadow-elevation">
          <div>
            <p className="text-[10px] text-text-muted font-medium uppercase">Total Advance Deposits</p>
            <p className="text-lg font-bold text-brand-500 mt-1 font-mono">{formatPaise(totalAdvance)}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-500">
            <UserCheck size={18} />
          </div>
        </div>
      </div>

      {/* Row 2: CRM Intelligence & Retention Alerts (Phase 3 Dashboard) */}
      <div className="grid grid-cols-5 gap-3">
        {/* Due Today Card */}
        <div 
          onClick={() => { setViewMode('retention'); setAttentionSortBy('days_overdue'); }}
          className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 rounded-xl p-3 cursor-pointer hover:border-yellow-500/60 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold text-yellow-800 dark:text-yellow-400">Due Today</span>
            <Clock size={14} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-yellow-900 dark:text-yellow-300 font-mono">
              {crmAlerts ? crmAlerts.due_today_count : '—'}
            </span>
            <span className="text-[10px] text-yellow-800/80 dark:text-text-muted font-medium">expected</span>
          </div>
          <p className="text-[9px] text-yellow-800/90 dark:text-yellow-200/80 mt-1 truncate font-medium">Ready for their usual visit</p>
        </div>

        {/* At Risk Card */}
        <div 
          onClick={() => { setViewMode('retention'); setAttentionSortBy('days_overdue'); }}
          className="bg-orange-50 dark:bg-orange-500/10 border border-orange-300 dark:border-orange-500/30 rounded-xl p-3 cursor-pointer hover:border-orange-500/60 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold text-orange-800 dark:text-orange-400">At Risk</span>
            <AlertTriangle size={14} className="text-orange-600 dark:text-orange-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-orange-900 dark:text-orange-300 font-mono">
              {crmAlerts ? crmAlerts.at_risk_count : '—'}
            </span>
            <span className="text-[10px] text-orange-800/80 dark:text-text-muted font-medium">overdue</span>
          </div>
          <p className="text-[9px] text-orange-800/90 dark:text-orange-200/80 mt-1 truncate font-medium">&gt;2x normal visit gap</p>
        </div>

        {/* VIP Customers Card */}
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold text-amber-800 dark:text-amber-400">VIP Accounts</span>
            <Award size={14} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-amber-900 dark:text-amber-300 font-mono">
              {crmAlerts ? crmAlerts.vip_count : '—'}
            </span>
            <span className="text-[10px] text-amber-800/80 dark:text-text-muted font-medium">top spenders</span>
          </div>
          <p className="text-[9px] text-amber-800/90 dark:text-amber-200/80 mt-1 truncate font-medium">Highest lifetime value</p>
        </div>

        {/* Avg Shop Visit Frequency */}
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold text-emerald-800 dark:text-emerald-400">Shop Rhythm</span>
            <Activity size={14} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-emerald-900 dark:text-emerald-300 font-mono">
              {crmAlerts && crmAlerts.shop_avg_visit_interval > 0 ? `${crmAlerts.shop_avg_visit_interval}d` : '—'}
            </span>
            <span className="text-[10px] text-emerald-800/80 dark:text-text-muted font-medium">avg gap</span>
          </div>
          <p className="text-[9px] text-emerald-800/90 dark:text-emerald-200/80 mt-1 truncate font-medium">Shop-wide visit frequency</p>
        </div>

        {/* Inactive Customers Card */}
        <div className="bg-zinc-100 dark:bg-zinc-500/10 border border-zinc-300 dark:border-zinc-500/30 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold text-zinc-800 dark:text-zinc-400">Inactive</span>
            <Calendar size={14} className="text-zinc-600 dark:text-zinc-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-300 font-mono">
              {crmAlerts ? crmAlerts.inactive_count : '—'}
            </span>
            <span className="text-[10px] text-zinc-700/80 dark:text-text-muted font-medium">absent</span>
          </div>
          <p className="text-[9px] text-zinc-700 dark:text-zinc-400 mt-1 truncate font-medium">No visits in 60+ days</p>
        </div>
      </div>

      {/* View Mode Selector Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-border-subtle">
        <div className="flex bg-surface-card p-1 rounded-xl border border-border-subtle gap-1 shadow-sm">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'all'
                ? 'bg-brand-500 text-white shadow-subtle'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            👥 All Customers Database ({rawCustomers.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('retention')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'retention'
                ? 'bg-orange-500 text-white shadow-subtle'
                : 'text-orange-700 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300'
            }`}
          >
            <AlertTriangle size={13} />
            Retention Desk (Needing Attention) {attentionCustomers ? `(${attentionCustomers.length})` : ''}
          </button>
        </div>

        {viewMode === 'retention' && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
              <ArrowUpDown size={11} /> Sort by:
            </span>
            <button
              type="button"
              onClick={() => setAttentionSortBy('days_overdue')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                attentionSortBy === 'days_overdue'
                  ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-500/50 shadow-sm'
                  : 'bg-surface-card text-text-secondary border-border-subtle hover:text-text-primary'
              }`}
            >
              Most Overdue
            </button>
            <button
              type="button"
              onClick={() => setAttentionSortBy('lifetime_value')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                attentionSortBy === 'lifetime_value'
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-500/50 shadow-sm'
                  : 'bg-surface-card text-text-secondary border-border-subtle hover:text-text-primary'
              }`}
            >
              Highest Lifetime Value (LTV)
            </button>
          </div>
        )}
      </div>

      {/* VIEW A: RETENTION DESK (CUSTOMERS NEEDING ATTENTION) */}
      {viewMode === 'retention' ? (
        <div className="erp-table-container">
          <table className="erp-table">
            <thead>
              <tr>
                <th className="erp-th">Customer</th>
                <th className="erp-th">Segment & Health</th>
                <th className="erp-th text-center">Normal Gap</th>
                <th className="erp-th text-center">Last Visit</th>
                <th className="erp-th text-center text-orange-400">Overdue</th>
                <th className="erp-th">Their Usual Order</th>
                <th className="erp-th text-right text-brand-500">Lifetime Value (LTV)</th>
                <th className="erp-th text-right text-red-400">Due (₹)</th>
                <th className="erp-th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isAttentionLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="erp-td"><div className="h-2 bg-surface-card rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !attentionCustomers || attentionCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="erp-td text-center py-14 text-text-muted">
                    🎉 Excellent! All customer visits are currently on schedule.
                  </td>
                </tr>
              ) : (
                attentionCustomers.map((att: AttentionCustomerItem) => {
                  const segStyle = getSegmentBadgeStyle(att.customer_segment);
                  return (
                    <tr
                      key={att.customer_id}
                      onClick={() => handleAttentionCustomerClick(att)}
                      className="erp-tr-hover cursor-pointer"
                    >
                      <td className="erp-td">
                        <div className="font-bold text-text-primary">{att.name}</div>
                        <div className="text-[10px] text-text-muted font-mono">{att.customer_code}</div>
                      </td>

                      <td className="erp-td">
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold flex items-center gap-1 w-fit ${segStyle.bg} ${segStyle.text} ${segStyle.border}`}>
                          <span>{segStyle.icon}</span>
                          <span>{segStyle.label}</span>
                        </span>
                        <div className="text-[9px] text-text-muted mt-0.5 line-clamp-1">{att.segment_health_summary}</div>
                      </td>

                      <td className="erp-td text-center font-mono font-bold">
                        {att.average_visit_interval ? `${att.average_visit_interval}d` : '—'}
                      </td>

                      <td className="erp-td text-center font-mono text-[10px]">
                        {att.days_since_last_purchase != null ? `${att.days_since_last_purchase}d ago` : 'Never'}
                      </td>

                      <td className="erp-td text-center">
                        {att.days_overdue > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-500/40 font-mono">
                            +{att.days_overdue} days
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-500/40 font-mono">
                            Due Today
                          </span>
                        )}
                      </td>

                      <td className="erp-td text-[11px] text-brand-700 dark:text-brand-300 font-medium">
                        {att.typical_basket_summary ? (
                          <span className="line-clamp-1">✨ {att.typical_basket_summary}</span>
                        ) : '—'}
                      </td>

                      <td className="erp-td text-right font-mono font-extrabold text-brand-600 dark:text-brand-400">
                        {formatPaise(att.customer_lifetime_value_paise)}
                      </td>

                      <td className="erp-td text-right font-mono font-bold text-red-600 dark:text-red-400">
                        {att.outstanding_balance_paise > 0 ? formatPaise(att.outstanding_balance_paise) : '—'}
                      </td>

                      <td className="erp-td text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAttentionCustomerClick(att)}
                            className="p-1.5 bg-surface-card hover:bg-brand-500 hover:text-white rounded-lg text-text-secondary transition-colors"
                            title="View Full Profile & History"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* VIEW B: ALL CUSTOMERS DATABASE */
        <>
          {/* Toolbar filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-card border border-border-subtle p-3 rounded-xl shadow-sm">
            <div className="relative w-80">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, phone, shop code..."
                className="w-full bg-surface-panel border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500"
              />
              <Search size={14} className="absolute left-3 top-3 text-text-muted" />
            </div>

            {/* Tab filters */}
            <div className="flex bg-surface-panel p-0.5 rounded-lg border border-border-subtle">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'inactive', label: 'Inactive' },
                { key: 'outstanding', label: 'Outstanding' },
                { key: 'advance', label: 'With Advance' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key as any);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-colors ${
                    activeTab === t.key
                      ? 'bg-brand-500 text-white shadow-subtle'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="bg-surface-panel border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500 text-xs font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'All' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Main Table */}
          <div className="erp-table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th className="erp-th">Code</th>
                  <th className="erp-th">Name / Business</th>
                  <th className="erp-th">Contact</th>
                  <th className="erp-th">Category & Segment</th>
                  <th className="erp-th text-right text-red-600 dark:text-red-400">Outstanding (₹)</th>
                  <th className="erp-th text-right text-brand-600 dark:text-brand-500">Avail Credit (₹)</th>
                  <th className="erp-th text-right text-brand-600 dark:text-brand-500">Advance (₹)</th>
                  <th className="erp-th text-center">Status</th>
                  <th className="erp-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="erp-td"><div className="h-2 bg-surface-card rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="erp-td text-center py-14 text-text-muted">
                      No customers found matching current filters
                    </td>
                  </tr>
                ) : (
                  paginated.map((cust: Customer) => (
                    <tr
                      key={cust.id}
                      onClick={() => handleRowClick(cust)}
                      className="erp-tr-hover"
                    >
                      <td className="erp-td font-mono font-bold text-text-primary">{cust.customer_code}</td>
                      <td className="erp-td">
                        <div className="font-bold text-text-primary leading-tight">{cust.name}</div>
                        {cust.business_name && <div className="text-[10px] text-text-muted mt-0.5">{cust.business_name}</div>}
                        {(cust.preferred_cut || cust.cutting_preference) && (
                          <div className="text-[9px] text-brand-600 dark:text-brand-400 mt-0.5 flex items-center gap-1 font-medium">
                            <UtensilsCrossed size={10} />
                            <span>{cust.preferred_cut || ''} {cust.cutting_preference ? `• ${cust.cutting_preference}` : ''}</span>
                          </div>
                        )}
                      </td>
                      <td className="erp-td font-mono text-text-secondary">
                        <div>{cust.phone || '—'}</div>
                        {cust.whatsapp && cust.whatsapp !== cust.phone && (
                          <div className="text-[10px] text-text-muted">WA: {cust.whatsapp}</div>
                        )}
                      </td>
                      <td className="erp-td">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 border rounded-full text-[9px] ${getCategoryBadgeColor(cust.category)}`}>
                            {cust.category}
                          </span>
                          {cust.customer_segment && (
                            <span className={`px-1.5 py-0.2 border rounded-full text-[8px] font-bold flex items-center gap-1 ${getSegmentBadgeStyle(cust.customer_segment).bg} ${getSegmentBadgeStyle(cust.customer_segment).text} ${getSegmentBadgeStyle(cust.customer_segment).border}`}>
                              <span>{getSegmentBadgeStyle(cust.customer_segment).icon}</span>
                              <span>{getSegmentBadgeStyle(cust.customer_segment).label}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="erp-td text-right font-mono font-bold text-red-600 dark:text-red-400">
                        {cust.outstanding_balance_paise > 0 ? formatPaise(cust.outstanding_balance_paise) : '—'}
                      </td>
                      <td className="erp-td text-right font-mono font-bold text-brand-600 dark:text-brand-500">
                        {cust.credit_allowed === 1
                          ? formatPaise(Math.max(0, cust.credit_limit_paise - cust.outstanding_balance_paise))
                          : 'No Credit'}
                      </td>
                      <td className="erp-td text-right font-mono font-bold text-brand-600 dark:text-brand-500">
                        {cust.advance_balance_paise > 0 ? formatPaise(cust.advance_balance_paise) : '—'}
                      </td>
                      <td className="erp-td text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${cust.is_active === 1 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30' : 'bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-500/30'}`}>
                          {cust.is_active === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="erp-td text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleRowClick(cust)}
                            className="p-1.5 bg-surface-card hover:bg-brand-500 hover:text-white rounded-lg text-text-secondary transition-colors"
                            title="View Full Profile & Ledger"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(e, cust)}
                            className="p-1.5 bg-surface-card hover:bg-brand-500 hover:text-white rounded-lg text-text-secondary transition-colors"
                            title="Edit Customer"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={(e) => handleMergeClick(e, cust)}
                            className="p-1.5 bg-surface-card hover:bg-amber-500 hover:text-white rounded-lg text-text-secondary transition-colors"
                            title="Merge Duplicate Customer"
                          >
                            <GitMerge size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-[11px] text-text-muted pt-2">
            <div>
              Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} customers
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1.5 bg-surface-card border border-border-subtle rounded-lg disabled:opacity-30 hover:bg-surface-app text-text-secondary"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-mono font-bold text-text-primary">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 bg-surface-card border border-border-subtle rounded-lg disabled:opacity-30 hover:bg-surface-app text-text-secondary"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Customer Form Modal */}
      {isFormOpen && (
        <CustomerForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          customer={selectedCustomer}
        />
      )}

      {/* Customer Detail View Modal */}
      {isDetailOpen && (
        <CustomerDetailView
          customer={selectedCustomer}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onEdit={(cust) => {
            setIsDetailOpen(false);
            setSelectedCustomer(cust);
            setIsFormOpen(true);
          }}
        />
      )}

      {/* Customer Merge Modal */}
      {isMergeOpen && mergeSourceCustomer && (
        <CustomerMergeModal
          isOpen={isMergeOpen}
          onClose={() => {
            setIsMergeOpen(false);
            setMergeSourceCustomer(null);
          }}
          sourceCustomer={mergeSourceCustomer}
        />
      )}
    </div>
  );
}
