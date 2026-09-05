import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { METRIC_DEFINITIONS } from '../../types/metric_definitions';

interface MetricDefinitionTooltipProps {
  metricKey: string;
  className?: string;
}

export const MetricDefinitionTooltip: React.FC<MetricDefinitionTooltipProps> = ({
  metricKey,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const metric = METRIC_DEFINITIONS[metricKey];

  if (!metric) return null;

  return (
    <div className={`relative inline-flex items-center ml-1 ${className}`}>
      <button
        type="button"
        className="text-gray-400 hover:text-blue-500 transition-colors focus:outline-none"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`Definition: ${metric.name}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white rounded-lg shadow-xl text-xs space-y-1.5 border border-gray-700 pointer-events-none"
        >
          <div className="font-semibold text-blue-400 border-b border-gray-700 pb-1 flex items-center justify-between">
            <span>{metric.name}</span>
          </div>
          <div className="font-mono bg-gray-800 p-1.5 rounded text-amber-300 text-[11px]">
            📐 {metric.formula}
          </div>
          <p className="text-gray-300 leading-relaxed">
            {metric.description}
          </p>
          {metric.reconciliationTip && (
            <div className="text-[10px] text-emerald-400 pt-1 border-t border-gray-800">
              💡 {metric.reconciliationTip}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
