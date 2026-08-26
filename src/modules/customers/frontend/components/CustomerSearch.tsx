import { useState, useEffect, useRef } from 'react';
import { Search, X, User } from 'lucide-react';
import type { Customer } from '../types/customer.types';
import { formatPaise } from '../types/customer.types';

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
  placeholder = 'Search by name, phone or code...',
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
        const res = await window.api.invoke('customers:search', { query, limit: 8 }) as { success: boolean; data?: Customer[] };
        if (res.success && res.data) {
          setResults(res.data);
        }
      } catch (err) {
        console.error('Customer search error', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {value ? (
        <div className="flex items-center justify-between bg-surface-panel border border-border-subtle rounded-lg px-3 py-2 text-text-primary">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent">
              <User size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate text-text-primary">{value.name}</p>
              {showBalance && (
                <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                  <span className="text-text-secondary font-mono">{value.customer_code}</span>
                  {value.outstanding_balance_paise > 0 && (
                    <span className="text-red-500 font-bold font-mono">
                      Bal: {formatPaise(value.outstanding_balance_paise)}
                    </span>
                  )}
                  {value.advance_balance_paise > 0 && (
                    <span className="text-brand-500 font-bold font-mono">
                      Adv: {formatPaise(value.advance_balance_paise)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-1 hover:bg-surface-hover rounded-full text-text-secondary hover:text-text-primary transition-colors"
              title="Clear customer"
            >
              <X size={14} />
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
            className="w-full bg-surface-card border border-border-subtle rounded-lg pl-9 pr-8 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 font-medium"
          />
          <Search size={14} className="absolute left-3 top-3 text-text-muted" />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-3 text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          )}

          {isOpen && (query.trim() !== '') && (
            <div className="absolute left-0 right-0 mt-1 bg-surface-panel border border-border-subtle rounded-lg shadow-2xl overflow-hidden z-50">
              {isLoading ? (
                <div className="px-4 py-3 text-xs text-text-secondary text-center animate-pulse">
                  Searching customers...
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-xs text-text-secondary text-center">
                  No customers found
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto divide-y divide-border-subtle">
                  {results.map((cust, idx) => (
                    <div
                      key={cust.id}
                      onClick={() => handleSelect(cust)}
                      className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-xs transition-colors ${
                        idx === activeIndex ? 'bg-brand-500/15 text-brand-500 font-bold' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-text-primary">{cust.name}</div>
                        <div className="text-[10px] text-text-muted font-mono">
                          {cust.customer_code} {cust.phone ? `· ${cust.phone}` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        {cust.outstanding_balance_paise > 0 && (
                          <div className="text-[10px] font-bold text-red-500 font-mono">
                            {formatPaise(cust.outstanding_balance_paise)}
                          </div>
                        )}
                        {cust.advance_balance_paise > 0 && (
                          <div className="text-[10px] font-bold text-brand-500 font-mono">
                            {formatPaise(cust.advance_balance_paise)} (Adv)
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
