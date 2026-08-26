import React, { useState, useEffect, useRef } from 'react';
import { ProductVariant } from '../../../../billing/frontend/types/billing.types';

interface SpreadsheetProductSelectorProps {
  variants: ProductVariant[];
  selectedVariantId: number | null;
  onSelectVariant: (variant: ProductVariant | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}

function isProductCodeLookup(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  // Pure digits
  if (/^\d+$/.test(q)) return true;
  // prd- prefix
  if (/^prd-/i.test(q)) return true;
  // Has digit and has alphanumeric character with hyphen
  if (/\d/.test(q) && /^[a-zA-Z0-9-]+$/.test(q) && q.length >= 3) return true;
  return false;
}

export default function SpreadsheetProductSelector({
  variants,
  selectedVariantId,
  onSelectVariant,
  onKeyDown,
  inputRef,
}: SpreadsheetProductSelectorProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedVariant = variants.find(v => v.id === selectedVariantId);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement | null>(null);

  // Only sync state with selected variant name when dropdown is closed AND user has a variant selected
  useEffect(() => {
    if (!isOpen) {
      if (selectedVariant) {
        setSearch(selectedVariant.product_name);
      }
    }
  }, [selectedVariant?.id, isOpen]);

  const filtered = variants.filter(v => {
    if (!search.trim() || search === selectedVariant?.product_name) return true;
    const q = search.toLowerCase();
    
    if (isProductCodeLookup(search)) {
      const code = (v.product_code || '').toLowerCase();
      return code === q || code.endsWith(q) || code.includes(q);
    }

    return (
      (v.product_name || '').toLowerCase().includes(q) ||
      (v.product_code || '').toLowerCase().includes(q) ||
      (v.category || '').toLowerCase().includes(q)
    );
  });

  const handleLocalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      // Scroll highlighted item into view
      setTimeout(() => {
        const activeEl = dropdownRef.current?.querySelector(`[data-index="${Math.min(highlightedIndex + 1, filtered.length - 1)}"]`);
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
      }, 10);
    } else if (e.key === 'ArrowUp') {
      if (isOpen) {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        // Scroll highlighted item into view
        setTimeout(() => {
          const activeEl = dropdownRef.current?.querySelector(`[data-index="${Math.max(highlightedIndex - 1, 0)}"]`);
          if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        }, 10);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && filtered[highlightedIndex]) {
        e.preventDefault();
        onSelectVariant(filtered[highlightedIndex]);
        setIsOpen(false);
      } else {
        onKeyDown(e);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      if (isOpen && filtered[highlightedIndex]) {
        // Commits selection before tabbing out
        onSelectVariant(filtered[highlightedIndex]);
        setIsOpen(false);
      }
      onKeyDown(e);
    } else {
      onKeyDown(e);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [openUpward, setOpenUpward] = useState(false);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 250);
    }
  }, [isOpen]);

  const handleBlur = () => {
    // Delay blur slightly so clicks on options register before dropdown closes
    setTimeout(() => {
      if (dropdownRef.current && dropdownRef.current.contains(document.activeElement)) {
        return;
      }
      setIsOpen(false);
    }, 150);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center">
      <input
        ref={el => {
          internalInputRef.current = el;
          inputRef(el);
        }}
        type="text"
        value={search}
        onChange={e => {
          const val = e.target.value;
          setSearch(val);
          setHighlightedIndex(0);

          if (!val.trim()) {
            onSelectVariant(null);
            setIsOpen(false);
            return;
          }

          const q = val.trim().toLowerCase();
          if (isProductCodeLookup(val)) {
            // Product Code Lookup
            const codeMatches = variants.filter(v => {
              const code = (v.product_code || '').toLowerCase();
              return code === q || code.endsWith(q) || code.includes(q);
            });

            if (codeMatches.length === 1) {
              // Select directly, do not show dropdown
              onSelectVariant(codeMatches[0]);
              setIsOpen(false);
            } else if (codeMatches.length > 1) {
              setIsOpen(true);
            } else {
              setIsOpen(false);
            }
          } else {
            // Normal text search (letters)
            setIsOpen(val.trim().length >= 1);
          }
        }}
        onFocus={() => {
          // Do not open dropdown automatically on focus
        }}
        onBlur={handleBlur}
        onKeyDown={handleLocalKeyDown}
        placeholder="Search item..."
        className="w-full h-full bg-transparent px-3 text-xs text-text-primary focus:outline-none focus:bg-brand-500/10 focus:ring-1 focus:ring-brand-500"
      />
      {isOpen && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className={`absolute left-0 min-w-[320px] max-h-60 overflow-y-auto bg-surface-card border border-border-subtle rounded-lg shadow-2xl z-50 divide-y divide-border-subtle/50 ${
            openUpward ? 'bottom-full mb-2' : 'top-full mt-1'
          }`}
        >
          {filtered.map((v, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <div
                key={v.id}
                data-index={idx}
                onMouseDown={() => {
                  onSelectVariant(v);
                  setIsOpen(false);
                  internalInputRef.current?.focus();
                }}
                className={`px-3 py-2 cursor-pointer text-xs transition-colors flex flex-col gap-0.5 ${
                  isHighlighted ? 'bg-brand-500/20 text-brand-300 font-semibold' : 'hover:bg-surface-hover text-text-primary'
                }`}
              >
                <div className="font-semibold">{v.product_name}</div>
                <div className="text-[10px] text-text-muted flex gap-2">
                  <span>Code: {v.product_code || '-'}</span>
                  <span>Cat: {v.category || 'General'}</span>
                  <span>Unit: {v.unit_type === 'weight' ? 'Kg' : 'Pcs'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
