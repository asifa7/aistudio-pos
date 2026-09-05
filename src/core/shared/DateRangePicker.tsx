// src/core/shared/DateRangePicker.tsx
// Universal Date Range Picker Component with strict From <= To validation

import React, { useMemo } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import { validateDateRange } from '../utils/date_validation';

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  labelFrom?: string;
  labelTo?: string;
  disabled?: boolean;
  className?: string;
  showValidationAlert?: boolean;
  minDate?: string;
  maxDate?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  labelFrom = 'From Date',
  labelTo = 'To Date',
  disabled = false,
  className = '',
  showValidationAlert = true,
  minDate,
  maxDate,
}) => {
  const validation = useMemo(() => {
    return validateDateRange(startDate, endDate);
  }, [startDate, endDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    if (endDate && newStart > endDate) {
      // If new start is after current end, adjust end to match start or clear it
      onChange(newStart, newStart);
    } else {
      onChange(newStart, endDate);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    onChange(startDate, newEnd);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {/* From Date Input */}
        <div className="flex items-center gap-1.5 bg-surface-card border border-border-subtle px-2.5 py-1.5 rounded-xl text-xs">
          <Calendar size={13} className="text-text-muted shrink-0" />
          <span className="text-[10px] font-bold text-text-muted uppercase shrink-0">{labelFrom}:</span>
          <input
            type="date"
            value={startDate || ''}
            onChange={handleStartDateChange}
            disabled={disabled}
            min={minDate}
            max={maxDate}
            className="bg-transparent font-mono text-xs text-text-primary outline-none cursor-pointer"
          />
        </div>

        {/* To Date Input */}
        <div className="flex items-center gap-1.5 bg-surface-card border border-border-subtle px-2.5 py-1.5 rounded-xl text-xs">
          <Calendar size={13} className="text-text-muted shrink-0" />
          <span className="text-[10px] font-bold text-text-muted uppercase shrink-0">{labelTo}:</span>
          <input
            type="date"
            value={endDate || ''}
            onChange={handleEndDateChange}
            disabled={disabled}
            min={startDate || minDate}
            max={maxDate}
            className="bg-transparent font-mono text-xs text-text-primary outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Clear Validation Error Alert */}
      {showValidationAlert && !validation.isValid && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-semibold animate-shake">
          <AlertCircle size={14} className="shrink-0" />
          <span>{validation.error}</span>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
