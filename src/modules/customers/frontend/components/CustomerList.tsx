import { useState } from 'react';
import { Plus, Search, Eye, Edit3, UserCheck, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { useCustomers } from '../hooks/useCustomers';
import { formatPaise, getCategoryBadgeColor } from '../types/customer.types';
import type { Customer } from '../types/customer.types';
import CustomerForm from './CustomerForm';
import CustomerDetailView from './CustomerDetailView';

export default function CustomerList() {
  const { data: customerList, isLoading } = useCustomers(true);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive' | 'outstanding' | 'advance'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

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

  const handleEditClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setIsFormOpen(true);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-5 select-none text-xs text-text-primary bg-surface-app">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary font-outfit">Customer Accounts (CRM)</h2>
          <p className="text-xs text-text-muted mt-0.5">Manage credit limits, payments, ledgers and profiles</p>
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

      {/* Stats summary banner */}
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

      {/* Toolbar filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-panel border border-border-subtle p-3 rounded-xl shadow-elevation">
        <div className="relative w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone, shop code..."
            className="w-full bg-surface-card border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500"
          />
          <Search size={14} className="absolute left-3 top-3 text-text-muted" />
        </div>

        {/* Tab filters */}
        <div className="flex bg-surface-card p-0.5 rounded-lg border border-border-subtle">
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
          className="bg-surface-card border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-brand-500"
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
              <th className="erp-th">Phone</th>
              <th className="erp-th">Category</th>
              <th className="erp-th text-right text-red-400">Outstanding (₹)</th>
              <th className="erp-th text-right text-brand-500">Avail Credit (₹)</th>
              <th className="erp-th text-right text-brand-500">Advance (₹)</th>
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
                  </td>
                  <td className="erp-td font-mono text-text-secondary">{cust.phone || '—'}</td>
                  <td className="erp-td">
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] ${getCategoryBadgeColor(cust.category)}`}>
                      {cust.category}
                    </span>
                  </td>
                  <td className="erp-td text-right font-mono font-bold text-red-400">
                    {cust.outstanding_balance_paise > 0 ? formatPaise(cust.outstanding_balance_paise) : '—'}
                  </td>
                  <td className="erp-td text-right font-mono font-bold text-brand-500">
                    {cust.credit_allowed === 1
                      ? formatPaise(Math.max(0, cust.credit_limit_paise - cust.outstanding_balance_paise))
                      : 'No Credit'}
                  </td>
                  <td className="erp-td text-right font-mono font-bold text-brand-500">
                    {cust.advance_balance_paise > 0 ? formatPaise(cust.advance_balance_paise) : '—'}
                  </td>
                  <td className="erp-td text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                        cust.is_active === 1
                          ? 'bg-brand-500/10 border-brand-500/50 text-brand-500'
                          : 'bg-surface-card border-border-subtle text-text-muted'
                      }`}
                    >
                      {cust.is_active === 1 ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="erp-td text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleRowClick(cust)}
                        className="p-1.5 hover:bg-surface-card rounded text-text-muted hover:text-text-primary transition-colors"
                        title="View Ledger & Profile"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={(e) => handleEditClick(e, cust)}
                        className="p-1.5 hover:bg-surface-card rounded text-text-muted hover:text-text-primary transition-colors"
                        title="Edit Customer"
                      >
                        <Edit3 size={13} />
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
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-border-subtle bg-surface-panel flex items-center justify-between rounded-xl shadow-elevation">
          <span className="text-[10px] text-text-muted">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalItems)} of {totalItems} accounts
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] text-text-primary font-bold font-mono">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-border-subtle rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-30 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Edit/Create Form Modal */}
      {isFormOpen && (
        <CustomerForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedCustomer(null);
          }}
          customer={selectedCustomer}
        />
      )}

      {/* Details Side Drawer */}
      {isDetailOpen && selectedCustomer && (
        <CustomerDetailView
          customer={selectedCustomer}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedCustomer(null);
          }}
          onEdit={(c) => {
            setIsDetailOpen(false);
            setSelectedCustomer(c);
            setIsFormOpen(true);
          }}
        />
      )}
    </div>
  );
}
