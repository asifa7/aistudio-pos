import { TrendingUp } from 'lucide-react';
import PurchasingSuggestionsPanel from './PurchasingSuggestionsPanel';
import FestivalCalendarSettings from './FestivalCalendarSettings';

export default function DemandForecastingView() {
  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-6 bg-surface-app text-text-primary">
      {/* Header */}
      <div className="border-b border-border-subtle pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
            <TrendingUp className="text-brand-500" />
            <span>AI Demand Forecasting & Purchase Suggestions</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">
            Predict inventory requirements based on historical POS sales, lead times, safety stocks, and festival surge multipliers.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1">
        <PurchasingSuggestionsPanel />
        <FestivalCalendarSettings />
      </div>
    </div>
  );
}
