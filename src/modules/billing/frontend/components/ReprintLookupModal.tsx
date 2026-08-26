import { useState, useEffect, useRef } from 'react';
import { X, Search, Printer, Calendar, Filter, ChevronDown, Check } from 'lucide-react';

interface ReprintLookupModalProps {
  onClose: () => void;
  onPrintReceipt: (invoiceId: number) => void;
}

export default function ReprintLookupModal({ onClose, onPrintReceipt }: ReprintLookupModalProps) {
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

  const filteredProducts = catalogProducts.filter(p =>
    p.toLowerCase().includes(itemName.trim().toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface-panel border border-border-subtle rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-brand-500" />
            <h3 className="font-extrabold text-sm text-text-primary">Search & Reprint Bill Lookup</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Combinable Filters Form */}
        <form onSubmit={handleSearchSubmit} className="p-3 bg-surface-app border-b border-border-subtle flex-shrink-0 space-y-2 text-xs">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Date Range */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1 flex items-center gap-1">
                <Calendar size={10} /> From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1 flex items-center gap-1">
                <Calendar size={10} /> To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500"
              />
            </div>

            {/* Bill Number */}
            <div>
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1">Bill Number</label>
              <input
                type="text"
                placeholder="e.g. 8 or 1042"
                value={billNumber}
                onChange={e => setBillNumber(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md font-mono text-text-primary outline-none focus:border-brand-500 font-bold"
              />
            </div>

            {/* Searchable / Selectable Item Name Dropdown */}
            <div className="relative">
              <label className="block text-[9px] uppercase font-bold text-text-muted mb-1 flex items-center justify-between">
                <span>Item / Product Name</span>
                {itemName && (
                  <button
                    type="button"
                    onClick={() => { setItemName(''); setShowItemDropdown(false); }}
                    className="text-[9px] text-text-muted hover:text-text-primary"
                  >
                    Clear
                  </button>
                )}
              </label>
              <div className="relative">
                <input
                  ref={itemInputRef}
                  type="text"
                  placeholder="Type or select product..."
                  value={itemName}
                  onChange={e => {
                    setItemName(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                  className="w-full px-2 py-1.5 pr-7 bg-surface-card border border-border-subtle rounded-md text-text-primary outline-none focus:border-brand-500 font-medium"
                />
                <ChevronDown
                  size={14}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                />
              </div>

              {/* Scrollable Selectable Suggestions Dropdown */}
              {showItemDropdown && filteredProducts.length > 0 && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 right-0 top-full mt-1 bg-surface-panel border border-border-subtle rounded-lg shadow-elevation z-30 max-h-48 overflow-y-auto divide-y divide-border-subtle/50 text-xs"
                >
                  {filteredProducts.map((prodName, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setItemName(prodName);
                        setShowItemDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-brand-500/10 hover:text-brand-500 text-text-primary transition-colors flex items-center justify-between font-semibold"
                    >
                      <span>{prodName}</span>
                      {itemName.toLowerCase() === prodName.toLowerCase() && (
                        <Check size={12} className="text-brand-500" />
                      )}
                    </button>
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
                className="w-full px-2 py-1.5 bg-surface-card border border-border-subtle rounded-md text-text-primary outline-none focus:border-brand-500"
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
                className="btn-primary flex-1 py-1.5 text-xs font-extrabold flex items-center justify-center gap-1 shadow-subtle"
              >
                <Search size={12} /> Filter
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary py-1.5 px-2 text-xs font-bold"
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
              <p className="text-[10px]">Try adjusting your date range or search terms above.</p>
            </div>
          ) : (
            <div className="border border-border-subtle rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-surface-card border-b border-border-subtle text-[10px] uppercase font-extrabold text-text-muted select-none">
                  <tr>
                    <th className="p-2.5">Bill No</th>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Customer Name</th>
                    <th className="p-2.5 text-center">Items</th>
                    <th className="p-2.5 text-right">Total Amount</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60 font-medium">
                  {bills.map(bill => {
                    const invNo = bill.invoice_number ? `#${bill.invoice_number.split('_')[0]}` : `#${bill.id}`;
                    const createdDate = new Date(bill.created_at);
                    const dateFormatted = createdDate.toLocaleDateString();
                    const timeFormatted = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={bill.id} className="hover:bg-surface-hover/50">
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
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                            bill.status === 'completed'
                              ? 'bg-brand-500/10 border-brand-500/40 text-brand-500'
                              : 'bg-red-950/40 border-red-800/40 text-red-400'
                          }`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => onPrintReceipt(bill.id)}
                            className="px-3 py-1 bg-brand-500 hover:bg-brand-600 active:scale-[0.97] text-white rounded-md text-[11px] font-extrabold transition-all shadow-subtle flex items-center gap-1 ml-auto"
                          >
                            <Printer size={12} /> Reprint
                          </button>
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
    </div>
  );
}
