import { Award, HelpCircle } from 'lucide-react';
import { usePriceHistoryTrend, useCheapestSupplier } from '../../hooks/useSupplierProcurement';
import { formatPaise, formatDate } from '../../types/supplier.types';

interface PriceTrendChartProps {
  productVariantId: number;
}

export default function PriceTrendChart({ productVariantId }: PriceTrendChartProps) {
  const { data: trendData, isLoading: isLoadingTrend } = usePriceHistoryTrend(productVariantId);
  const { data: cheapestData, isLoading: isLoadingCheapest } = useCheapestSupplier(productVariantId);

  if (isLoadingTrend || isLoadingCheapest) {
    return <div className="p-4 text-center text-xs text-text-muted">Analyzing purchase price history...</div>;
  }

  if (!trendData || !trendData.trends || trendData.trends.length === 0) {
    return (
      <div className="p-6 bg-surface-app border border-border-subtle rounded-xl text-center space-y-2">
        <HelpCircle className="mx-auto text-text-muted" size={24} />
        <p className="text-xs text-text-muted font-medium">No historical price entries found for this variant.</p>
        <p className="text-[10px] text-text-muted">Price data will populate as goods receipts (GRNs) are filed.</p>
      </div>
    );
  }

  const { stats, trends } = trendData;
  const cheapest = cheapestData?.suggestedSupplier;

  // Process data for SVG chart plotting
  const minPrice = stats.min_price_paise || 0;
  const maxPrice = stats.max_price_paise || 1;
  const priceRange = maxPrice - minPrice || 1;

  // Chart Dimensions
  const width = 500;
  const height = 180;
  const padding = 20;

  // Generate SVG Points
  const points = trends.map((t, idx) => {
    const x = padding + (idx / (trends.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((t.unit_price_paise - minPrice) / priceRange) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="space-y-4">
      {/* Quick summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-3">
          <span className="text-[9px] uppercase font-bold text-text-muted">Latest Price</span>
          <p className="text-sm font-bold font-mono text-text-secondary mt-0.5">{formatPaise(stats.latest_price_paise || 0)}</p>
        </div>
        <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-3">
          <span className="text-[9px] uppercase font-bold text-text-muted">Average Price</span>
          <p className="text-sm font-bold font-mono text-text-secondary mt-0.5">{formatPaise(Math.round(stats.avg_price_paise || 0))}</p>
        </div>
        <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-3">
          <span className="text-[9px] uppercase font-bold text-rose-400">Peak Price</span>
          <p className="text-sm font-bold font-mono text-rose-400 mt-0.5">{formatPaise(stats.max_price_paise || 0)}</p>
        </div>
        <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-3">
          <span className="text-[9px] uppercase font-bold text-brand-500 font-outfit">Lowest Price</span>
          <p className="text-sm font-bold font-mono text-brand-500 mt-0.5">{formatPaise(stats.min_price_paise || 0)}</p>
        </div>
      </div>

      {/* SVG Chart area */}
      <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-4 flex flex-col justify-between shadow-inner">
        <h4 className="text-[10px] uppercase font-bold text-text-muted mb-2 tracking-wider">Purchase Price Timeline (₹ / Unit)</h4>
        <div className="relative w-full overflow-hidden h-[180px]">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />

            {/* Line Path */}
            {trends.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke="var(--color-accent, #3b82f6)"
                  strokeWidth="2.5"
                  points={points}
                />
                {/* Dots on Price entries */}
                {trends.map((t, idx) => {
                  const x = padding + (idx / (trends.length - 1)) * (width - padding * 2);
                  const y = height - padding - ((t.unit_price_paise - minPrice) / priceRange) * (height - padding * 2);
                  return (
                    <g key={idx} className="group cursor-pointer">
                      <circle cx={x} cy={y} r="3.5" fill="var(--color-accent, #3b82f6)" className="hover:scale-150 transition-transform" />
                      <title>
                        {formatDate(t.effective_date)}: {formatPaise(t.unit_price_paise)}
                      </title>
                    </g>
                  );
                })}
              </>
            )}
          </svg>
        </div>
        <div className="flex justify-between text-[8px] text-text-muted uppercase font-bold font-mono mt-1 px-4">
          <span>{formatDate(trends[0].effective_date)}</span>
          <span>{formatDate(trends[trends.length - 1].effective_date)}</span>
        </div>
      </div>

      {/* Suggested Supplier Card */}
      {cheapest && (
        <div className="p-3.5 bg-brand-500/10 border border-emerald-900/50 text-brand-500 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-brand-500/10 border border-emerald-900/50 flex items-center justify-center">
              <Award size={16} />
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase font-bold">Suggested Procurement Target</p>
              <h5 className="text-xs font-bold text-text-secondary mt-0.5">{cheapest.company_name} ({cheapest.supplier_code})</h5>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-text-muted uppercase font-bold">Best Contract Rate</p>
            <p className="text-xs font-bold font-mono text-brand-500 mt-0.5">{formatPaise(cheapest.unit_price_paise)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
