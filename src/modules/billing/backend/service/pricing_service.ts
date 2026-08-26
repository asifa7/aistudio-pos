import { productVariantsRepository } from '../repository/product_variants_repository';
import { UpdateVariantRateSchema } from '../validation/product_variant.schema';
import { ValidationError } from '../../../../core/backend/errors';
import { logger } from '../../../../core/backend/logger';
import { dbManager } from '../../../../core/backend/db';
import { calculateLineAmount, calculateLineTax as coreCalculateLineTax } from '../../../../core/shared/math';

import { authService } from '../../../auth/backend/service/auth_service';

function getCurrentUserId(): number {
  return authService.getCurrentUserId();
}

const pricingService = {
  getActiveVariants() {
    return productVariantsRepository.findAllActive();
  },

  getVariantById(variantId: number) {
    return productVariantsRepository.findById(variantId);
  },

  getVariantsByProduct(productId: number) {
    return productVariantsRepository.findByProductId(productId);
  },

  getRateHistory(variantId: number) {
    return productVariantsRepository.getRateHistory(variantId);
  },

  updateVariantRate(variantId: number, newRatePaise: number, setBy?: number) {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const parsed = UpdateVariantRateSchema.safeParse({
      variant_id: variantId,
      new_rate_paise: newRatePaise,
      set_by: setBy ?? getCurrentUserId(),
    });

    if (!parsed.success) {
      throw new ValidationError('Invalid rate update input', parsed.error.flatten());
    }

    const { variant_id, new_rate_paise, set_by } = parsed.data;

    dbManager.transaction(() => {
      productVariantsRepository.updateRate(variant_id, new_rate_paise);
      productVariantsRepository.insertRateHistory(variant_id, new_rate_paise, set_by);
    });

    logger.info('Variant rate updated with history record', {
      variantId: variant_id,
      newRatePaise: new_rate_paise,
      setBy: set_by,
    });

    return productVariantsRepository.findById(variant_id);
  },

  snapshotCurrentRate(variantId: number): number {
    const variant = productVariantsRepository.findById(variantId);
    return variant.current_rate_paise_per_unit;
  },

  calculateLineSubtotal(
    unitType: 'weight' | 'piece' | 'live_dual',
    quantityGrams: number | null,
    quantityUnits: number | null,
    ratePaiseSnapshot: number
  ): number {
    const amount = calculateLineAmount(unitType, quantityGrams, quantityUnits, ratePaiseSnapshot);
    const isWeightType = unitType === 'weight' || unitType === 'live_dual';
    if (amount === 0 && ((isWeightType && quantityGrams !== 0) || (unitType === 'piece' && quantityUnits !== 0))) {
      throw new ValidationError('Invalid quantity for unit type');
    }
    return amount;
  },

  calculateLineTax(lineSubtotalPaise: number, gstRatePercentSnapshot: number | null): {
    lineTaxPaise: number;
    cgstPaise: number;
    sgstPaise: number;
  } {
    return coreCalculateLineTax(lineSubtotalPaise, gstRatePercentSnapshot);
  },
};

export { pricingService };
