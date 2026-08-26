import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Package } from 'lucide-react';
import type { ProductVariant } from '../../../../billing/frontend/types/billing.types';

interface SearchableProductComboboxProps {
  variants: ProductVariant[];
  selectedVariantId: number | null;
  onSelectVariant: (variant: ProductVariant) => void;
  placeholder?: string;
  excludeProcessedCuts?: boolean;
}

export default function SearchableProductCombobox({
  variants,
  selectedVariantId,
  onSelectVariant,
  placeholder = 'Select meat item / product...',
  excludeProcessedCuts = false
}: SearchableProductComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedVariant = variants.find(v => v.id === selectedVariantId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredVariants = variants.filter(v => {
    if (excludeProcessedCuts && (v as any).is_processed_cut === 1) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = (v.product_name || '').toLowerCase();
    const code = (v.product_code || '').toLowerCase();
    const category = (v.category || '').toLowerCase();
    const variantName = (v.variant_name || '').toLowerCase();

    return name.includes(q) || code.includes(q) || category.includes(q) || variantName.includes(q);
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
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-surface-card border border-border-subtle hover:border-brand-500 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition-all text-sm"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Package size={14} className="text-brand-500 shrink-0" />
          {selectedVariant ? (
            <div className="flex items-center gap-1.5 truncate font-bold text-text-primary">
              <span>{selectedVariant.product_name}</span>
              <span className="text-text-muted font-normal">({selectedVariant.unit_type === 'weight' ? 'Per Kg' : 'Per Unit'})</span>
            </div>
          ) : (
            <span className="text-text-muted font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 min-w-[350px] w-full bg-surface-card border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-80">
          {/* Search Bar */}
          <div className="p-2 border-b border-border-subtle bg-surface-panel flex items-center gap-2">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search product name, code or category..."
              autoFocus
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none border-none p-2"
            />
          </div>

          {/* Product List */}
          <div className="overflow-y-auto flex-1 divide-y divide-border-subtle/50">
            {filteredVariants.length === 0 ? (
              <div className="p-3 text-center text-text-muted text-xs">No matching products found</div>
            ) : (
              filteredVariants.map(v => {
                const isSelected = v.id === selectedVariantId;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      onSelectVariant(v);
                      setIsOpen(false);
                    }}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer text-sm transition-colors ${
                      isSelected ? 'bg-brand-500/15 text-brand-300 font-bold' : 'hover:bg-surface-hover text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                      <div className="font-bold truncate">
                        {highlightText(v.product_name, search)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted">
                        <span>Code: {highlightText(v.product_code || '-', search)}</span>
                        <span>Cat: {highlightText(v.category || 'General', search)}</span>
                        <span>Unit: {v.unit_type === 'weight' ? 'Kg (Grams)' : 'Units'}</span>
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
