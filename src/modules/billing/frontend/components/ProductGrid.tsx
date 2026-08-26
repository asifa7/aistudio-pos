import { useMemo, useState } from 'react';
import { LayoutGrid, Filter, Search } from 'lucide-react';
import { useActiveRates } from '../hooks/useActiveRates';
import type { ProductVariant } from '../types/billing.types';
import ProductCard from './ProductCard';

import { useAppearance } from '../../../../core/theme/AppearanceContext';

interface ProductGridProps {
  onSelectVariant: (variant: ProductVariant) => void;
  selectedVariant: ProductVariant | null;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

export default function ProductGrid({ onSelectVariant, selectedVariant, searchTerm, onSearchTermChange }: ProductGridProps) {
  const { config } = useAppearance();
  const { data: variants, isLoading } = useActiveRates();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const gridColsClass = config.tileSize === 'small' ? 'grid-cols-3' : config.tileSize === 'large' ? 'grid-cols-1' : 'grid-cols-2';

  const quickVariants = useMemo(
    () => [...(variants ?? [])].sort((a, b) => `${a.product_name} ${a.variant_name}`.localeCompare(`${b.product_name} ${b.variant_name}`)),
    [variants]
  );

  const categories = useMemo(() => {
    if (!variants) return [];
    const set = new Set<string>();
    variants.forEach(v => {
      if (v.product_name) {
        const cat = v.product_name.split(' ')[0] || v.product_name;
        set.add(cat);
      }
    });
    return Array.from(set);
  }, [variants]);

  const filteredVariants = useMemo(() => {
    let result = quickVariants;
    const term = searchTerm.trim().toLowerCase();
    
    if (term && !/^\d+$/.test(term)) {
      result = result.filter(v => `${v.product_name} ${v.variant_name}`.toLowerCase().includes(term));
    }
    
    if (selectedCategory !== 'all') {
      result = result.filter(v => v.product_name.toLowerCase().startsWith(selectedCategory.toLowerCase()));
    }
    
    return result;
  }, [quickVariants, searchTerm, selectedCategory]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-semibold text-text-muted">
        Loading product catalog...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-app overflow-hidden">
      {/* Top Header & Category Filter Bar */}
      <div className="p-3 bg-surface-panel border-b border-border-subtle flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
            <LayoutGrid size={15} className="text-brand-500" />
            <span>Product Catalog</span>
          </div>
          <span className="text-[10px] font-mono text-text-muted bg-surface-card px-2 py-0.5 rounded border border-border-subtle font-bold">
            {filteredVariants.length} items
          </span>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-medium">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap font-bold ${
              selectedCategory === 'all'
                ? 'bg-brand-500 text-white shadow-subtle'
                : 'bg-surface-card text-text-secondary hover:bg-surface-hover border border-border-subtle'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap font-bold ${
                selectedCategory === cat
                  ? 'bg-brand-500 text-white shadow-subtle'
                  : 'bg-surface-card text-text-secondary hover:bg-surface-hover border border-border-subtle'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Products by Name Bar (Positioned Top below Category Pills) */}
        <div className="relative pt-0.5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchTerm}
            onChange={e => onSearchTermChange(e.target.value)}
            placeholder="Search products by name..."
            className="w-full pl-9 pr-3 py-1.5 bg-surface-card border border-border-subtle rounded-lg text-xs font-bold text-text-primary outline-none focus:border-brand-500 transition-colors"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className={`grid ${gridColsClass} gap-2.5`}>
          {filteredVariants.map(variant => (
            <ProductCard
              key={variant.id}
              variant={variant}
              quickNumber={quickVariants.indexOf(variant) + 1}
              selected={selectedVariant?.id === variant.id}
              onClick={() => onSelectVariant(variant)}
            />
          ))}
        </div>

        {filteredVariants.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted space-y-1">
            <Filter size={24} className="opacity-40" />
            <p className="text-xs font-semibold">No products match search criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
