// src/core/utils/date_validation.ts
// Centralized Reusable Date Range Validation Utility for MeatPOS

export interface DateRangeValidationResult {
  isValid: boolean;
  error?: string;
  normalizedStartDate?: string;
  normalizedEndDate?: string;
}

/**
 * Validates that fromDate <= toDate.
 * Rejects invalid date ranges with a clear, user-friendly error message.
 * Enforced on both frontend and backend handlers.
 */
export function validateDateRange(
  fromDate?: string | null,
  toDate?: string | null
): DateRangeValidationResult {
  // If either date is omitted, consider the partial range valid
  if (!fromDate || !toDate) {
    return {
      isValid: true,
      normalizedStartDate: fromDate ? normalizeDateString(fromDate) : undefined,
      normalizedEndDate: toDate ? normalizeDateString(toDate) : undefined,
    };
  }

  const start = normalizeDateString(fromDate);
  const end = normalizeDateString(toDate);

  // Compare lexicographically (works for YYYY-MM-DD) or via Date timestamps
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (isNaN(startTime) || isNaN(endTime)) {
    return {
      isValid: false,
      error: 'Invalid Date Format — please provide valid YYYY-MM-DD date values.',
    };
  }

  if (startTime > endTime) {
    return {
      isValid: false,
      error: 'Invalid Date Range — the To Date cannot be earlier than the From Date. Please select a valid date range.',
    };
  }

  return {
    isValid: true,
    normalizedStartDate: start,
    normalizedEndDate: end,
  };
}

/**
 * Backend enforcement guard that throws a ValidationError if date range is invalid.
 */
export function assertValidDateRange(fromDate?: string | null, toDate?: string | null): void {
  const result = validateDateRange(fromDate, toDate);
  if (!result.isValid) {
    const error = new Error(result.error);
    (error as any).statusCode = 400;
    (error as any).isValidationError = true;
    throw error;
  }
}

/**
 * Standardizes date string to YYYY-MM-DD
 */
export function normalizeDateString(dateInput: string): string {
  if (!dateInput) return '';
  // If input is ISO string (e.g. 2026-09-02T10:00:00.000Z), take date part
  if (dateInput.includes('T')) {
    return dateInput.split('T')[0];
  }
  return dateInput.trim().slice(0, 10);
}
