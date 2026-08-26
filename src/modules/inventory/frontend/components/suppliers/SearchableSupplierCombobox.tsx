import { useState, useRef, useEffect } from 'react';
import { Search, Plus, ChevronDown, Check, User } from 'lucide-react';
import type { FullSupplierRow } from '../../types/supplier.types';

interface SearchableSupplierComboboxProps {
  suppliers: FullSupplierRow[];
  selectedSupplierId: number | null;
  onSelectSupplier: (supplierId: number) => void;
  onAddNewSupplier?: () => void;
  placeholder?: string;
}

export default function SearchableSupplierCombobox({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  onAddNewSupplier,
  placeholder = ''
}: SearchableSupplierComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuppliers = suppliers.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const company = (s.company_name || '').toLowerCase();
    const firstName = ((s as any).first_name || '').toLowerCase();
    const lastName = ((s as any).last_name || '').toLowerCase();
    const displayName = ((s as any).display_name || '').toLowerCase();
    const ownerName = (s.owner_name || '').toLowerCase();
    const phone = (s.phone || (s as any).mobile_phone || (s as any).work_phone || '').toLowerCase();

    return (
      company.includes(q) ||
      firstName.includes(q) ||
      lastName.includes(q) ||
      displayName.includes(q) ||
      ownerName.includes(q) ||
      phone.includes(q)
    );
  });

  const highlightText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-brand-500/30 text-brand-300 font-bold px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className="w-full bg-surface-card border border-border-subtle hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-all shadow-sm min-h-[46px] box-border select-none outline-none"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <User size={18} className="text-brand-500 shrink-0" />
          {selectedSupplier ? (
            <div className="flex items-center gap-2 truncate text-sm font-bold text-text-primary">
              <span>{(selectedSupplier as any).display_name || selectedSupplier.company_name}</span>
              {selectedSupplier.phone && (
                <span className="text-xs font-normal text-text-muted font-mono">({selectedSupplier.phone})</span>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-text-muted">{placeholder || 'Supplier Name'}</span>
          )}
        </div>
        <ChevronDown size={18} className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-border-subtle rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col max-h-72">
          {/* Search Bar */}
          <div className="p-2 border-b border-border-subtle bg-surface-panel flex items-center gap-2">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search company, contact name or phone..."
              autoFocus
              className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none border-none p-1"
            />
          </div>

          {/* Add New Supplier Option */}
          {onAddNewSupplier && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onAddNewSupplier();
              }}
              className="w-full px-3 py-2.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-bold text-xs flex items-center gap-2 border-b border-border-subtle transition-colors"
            >
              <Plus size={14} className="text-brand-500" />
              <span>+ Add New Supplier</span>
            </button>
          )}

          {/* Supplier List */}
          <div className="overflow-y-auto flex-1 divide-y divide-border-subtle/50">
            {filteredSuppliers.length === 0 ? (
              <div className="p-4 text-center text-text-muted text-xs">No matching suppliers found</div>
            ) : (
              filteredSuppliers.map(s => {
                const isSelected = s.id === selectedSupplierId;
                const nameStr = (s as any).display_name || s.company_name;
                const contactStr = [s.owner_name, (s as any).first_name, (s as any).last_name].filter(Boolean).join(' ');
                const phoneStr = s.phone || (s as any).mobile_phone || (s as any).work_phone;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSupplier(s.id);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2.5 flex items-center justify-between cursor-pointer text-xs transition-colors ${
                      isSelected ? 'bg-brand-500/15 text-brand-300 font-bold' : 'hover:bg-surface-hover text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <div className="font-bold text-xs truncate">
                        {highlightText(nameStr, search)}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted">
                        {contactStr && <span>Contact: {highlightText(contactStr, search)}</span>}
                        {phoneStr && <span>Ph: {highlightText(phoneStr, search)}</span>}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="text-brand-500 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
