interface CategoryFilterProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function CategoryFilter({
  categories,
  activeCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1.5 select-none scrollbar-none">
      {categories.map((cat) => {
        const isActive = activeCategory === cat;
        return (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap border transition-all duration-150 active:scale-[0.98] ${
              isActive
                ? 'bg-accent border-accent text-white shadow-sm font-extrabold'
                : 'bg-surface-card border-border-subtle text-text-secondary hover:bg-surface-panel hover:text-slate-800 dark:hover:text-slate-100'
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
