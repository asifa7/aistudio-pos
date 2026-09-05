import React from 'react';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

interface ReportChartViewProps {
  data: any[];
  dimensionKey: string;
  dimensionLabel: string;
  measureKey: string;
  measureLabel: string;
  measureType?: string;
  chartType?: 'bar' | 'line';
}

export const ReportChartView: React.FC<ReportChartViewProps> = ({
  data,
  dimensionKey,
  dimensionLabel,
  measureKey,
  measureLabel,
  measureType = 'currency',
  chartType = 'bar',
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
        No chart data available for the selected filters.
      </div>
    );
  }

  // Take top 15 data items
  const chartItems = data.slice(0, 15);
  const values = chartItems.map(item => Number(item[measureKey] || 0));
  const maxVal = Math.max(...values, 1);

  const formatVal = (v: number) => {
    if (measureType === 'currency') return formatPaise(v);
    if (measureType === 'weight') return `${(v / 1000).toFixed(2)} kg`;
    if (measureType === 'percent') return `${v.toFixed(1)}%`;
    return v.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">
            {measureLabel} by {dimensionLabel}
          </h4>
          <p className="text-xs text-gray-500">Visual trend overview (Top {chartItems.length} records)</p>
        </div>
        <div className="text-xs font-mono text-gray-500 bg-gray-50 px-2.5 py-1 rounded">
          Max: <span className="font-semibold text-gray-800">{formatVal(maxVal)}</span>
        </div>
      </div>

      {chartType === 'bar' && (
        <div className="space-y-3 pt-2">
          {chartItems.map((item, idx) => {
            const label = String(item[dimensionKey] ?? `Item ${idx + 1}`);
            const val = Number(item[measureKey] || 0);
            const percent = Math.min(Math.max((val / maxVal) * 100, 2), 100);

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-700 truncate max-w-[240px]">{label}</span>
                  <span className="font-mono text-gray-900 font-bold">{formatVal(val)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
