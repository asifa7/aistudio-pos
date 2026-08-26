/**
 * Pure math calculations library for billing rates, subtotals, and taxes.
 * Enforces strict round-half-up rounding rules.
 */

export function calculateLineAmount(
  unitType: 'weight' | 'piece' | 'live_dual',
  quantityGrams: number | null,
  quantityUnits: number | null,
  ratePaiseSnapshot: number
): number {
  if ((unitType === 'weight' || unitType === 'live_dual') && quantityGrams !== null) {
    // Round half up: standard Math.round handles positive numbers
    return Math.round((quantityGrams * ratePaiseSnapshot) / 1000);
  }
  if (unitType === 'piece' && quantityUnits !== null) {
    return quantityUnits * ratePaiseSnapshot;
  }
  return 0;
}

export function calculateLineTax(
  lineSubtotalPaise: number,
  gstRateBpsSnapshot: number | null
): {
  lineTaxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
} {
  if (gstRateBpsSnapshot === null || gstRateBpsSnapshot === 0) {
    return { lineTaxPaise: 0, cgstPaise: 0, sgstPaise: 0 };
  }
  const lineTaxPaise = Math.round((lineSubtotalPaise * gstRateBpsSnapshot) / 10000);
  const cgstPaise = Math.round(lineTaxPaise / 2);
  const sgstPaise = lineTaxPaise - cgstPaise;
  return { lineTaxPaise, cgstPaise, sgstPaise };
}

/**
 * Converts a float rupee value to integer paise using round-half-up.
 * Use this at every form boundary where users enter rupee amounts.
 * Never do inline multiplication by 100 — always call this shared function.
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
