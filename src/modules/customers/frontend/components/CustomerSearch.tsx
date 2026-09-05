import { useState, useEffect, useRef } from 'react';
import { Search, X, User, UtensilsCrossed } from 'lucide-react';
import type { Customer } from '../types/customer.types';
import { formatPaise, getCategoryBadgeColor, getSegmentBadgeStyle } from '../types/customer.types';

interface CustomerSearchProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  placeholder?: string;
  showBalance?: boolean;
  className?: string;
}

export default function CustomerSearch({
  value,
  onChange,
  placeholder = 'Search customer by phone (e.g. 9844), name, code...',
  showBalance = true,
  className = '',
}: CustomerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await window.api.invoke('customers:search', { searchQuery: query, query, limit: 12 }) as { success: boolean; data?: Customer[] };
        if (res.success && res.data) {
          setResults(res.data);
        }
      } catch (err) {
        console.error('Customer search error', err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (customer: Customer) => {
    onChange(customer);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const valueSegmentStyle = value?.customer_segment ? getSegmentBadgeStyle(value.customer_segment) : null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {value ? (
        <div className="flex items-center justify-between bg-surface-card border border-brand-500/40 rounded-xl px-3 py-2 text-text-primary shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 flex-shrink-0">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-extrabold text-text-primary truncate">{value.name}</p>
                <span className={`px-1.5 py-0.2 border rounded-full text-[9px] font-bold ${getCategoryBadgeColor(value.category)}`}>
                  {value.category}
                </span>
                {valueSegmentStyle && (
                  <span className={`px-1.5 py-0.2 border rounded-full text-[8px] font-bold flex items-center gap-1 ${valueSegmentStyle.bg} ${valueSegmentStyle.text} ${valueSegmentStyle.border}`}>
                    <span>{valueSegmentStyle.icon}</span>
                    <span>{valueSegmentStyle.label}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                <span className="text-text-secondary font-mono">{value.customer_code}</span>
                {value.phone && <span className="text-text-secondary font-mono">📱 {value.phone}</span>}
                {showBalance && value.outstanding_balance_paise > 0 && (
                  <span className="text-red-600 dark:text-red-400 font-bold font-mono">
                    Bal: {formatPaise(value.outstanding_balance_paise)}
                  </span>
                )}
                {showBalance && value.advance_balance_paise > 0 && (
                  <span className="text-brand-600 dark:text-brand-400 font-bold font-mono">
                    Adv: {formatPaise(value.advance_balance_paise)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-1 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              title="Unlink customer from bill"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-surface-card border border-border-subtle rounded-xl pl-9 pr-8 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 font-medium shadow-sm"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}

          {isOpen && query.trim() !== '' && (
            <div className="absolute left-0 right-0 mt-1 bg-surface-card border border-border-subtle rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
              {isLoading ? (
                <div className="px-4 py-3 text-xs text-text-secondary text-center animate-pulse">
                  Searching customer accounts...
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-xs text-text-secondary text-center">
                  No customers found matching "<strong className="text-text-primary">{query}</strong>"
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-border-subtle">
                  {results.map((cust, idx) => {
                    const custSegStyle = cust.customer_segment ? getSegmentBadgeStyle(cust.customer_segment) : null;
                    return (
                      <div
                        key={cust.id}
                        onClick={() => handleSelect(cust)}
                        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-xs transition-colors ${
                          idx === activeIndex
                            ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400 font-bold'
                            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-text-primary">{cust.name}</span>
                            <span className={`px-1.5 py-0.2 border rounded-full text-[8px] font-bold ${getCategoryBadgeColor(cust.category)}`}>
                              {cust.category}
                            </span>
                            {custSegStyle && (
                              <span className={`px-1.5 py-0.2 border rounded-full text-[8px] font-bold flex items-center gap-0.5 ${custSegStyle.bg} ${custSegStyle.text} ${custSegStyle.border}`}>
                                <span>{custSegStyle.icon}</span>
                                <span>{custSegStyle.label}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-text-secondary font-mono mt-0.5">
                            {cust.customer_code} {cust.phone ? `· ${cust.phone}` : ''}
                          </div>
                          {(cust.preferred_cut || cust.cutting_preference) && (
                            <div className="text-[9px] text-brand-600 dark:text-brand-400 mt-0.5 flex items-center gap-1 font-medium">
                              <UtensilsCrossed size={10} />
                              <span>
                                {cust.preferred_cut ? `${cust.preferred_cut} cut` : ''} 
                                {cust.cutting_preference ? ` • ${cust.cutting_preference}` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {cust.outstanding_balance_paise > 0 && (
                            <div className="text-[10px] font-extrabold text-red-600 dark:text-red-400 font-mono">
                              {formatPaise(cust.outstanding_balance_paise)}
                            </div>
                          )}
                          {cust.advance_balance_paise > 0 && (
                            <div className="text-[10px] font-extrabold text-brand-600 dark:text-brand-400 font-mono">
                              {formatPaise(cust.advance_balance_paise)} (Adv)
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
