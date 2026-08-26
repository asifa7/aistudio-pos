-- Migration 027: Product Variant Cost & Stock Cache Columns
-- 1. Add columns to product_variants
ALTER TABLE product_variants ADD COLUMN last_purchase_cost INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN weighted_average_cost INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN fifo_current_cost INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN current_stock INTEGER DEFAULT 0;
ALTER TABLE product_variants ADD COLUMN inventory_value INTEGER DEFAULT 0;

-- 2. Initialize cached fields from existing batches & purchases
-- current_stock: Sum of current_quantity from active batches (using grams or units based on product unit_type)
UPDATE product_variants
SET current_stock = COALESCE(
  (
    SELECT SUM(COALESCE(current_quantity_grams, 0) + COALESCE(current_quantity_units, 0))
    FROM product_stock_batches
    WHERE product_variant_id = product_variants.id AND status = 'active'
  ),
  0
);

-- last_purchase_cost: unit_cost_paise of the most recent batch or purchase
UPDATE product_variants
SET last_purchase_cost = COALESCE(
  (
    SELECT unit_cost_paise
    FROM product_stock_batches
    WHERE product_variant_id = product_variants.id AND source_type = 'purchase'
    ORDER BY received_date DESC, id DESC
    LIMIT 1
  ),
  cost_price_paise_per_unit,
  0
);

-- weighted_average_cost: Weighted average cost from purchase history. Fall back to cost_price_paise_per_unit
UPDATE product_variants
SET weighted_average_cost = COALESCE(
  (
    SELECT CAST(ROUND(CAST(SUM(unit_cost_paise * initial_quantity) AS REAL) / SUM(initial_quantity)) AS INTEGER)
    FROM (
      SELECT unit_cost_paise, COALESCE(initial_quantity_grams, 0) + COALESCE(initial_quantity_units, 0) AS initial_quantity
      FROM product_stock_batches
      WHERE product_variant_id = product_variants.id
    )
    WHERE initial_quantity > 0
  ),
  cost_price_paise_per_unit,
  0
);

-- fifo_current_cost: Cost of the oldest remaining active batch (FIFO current cost)
UPDATE product_variants
SET fifo_current_cost = COALESCE(
  (
    SELECT unit_cost_paise
    FROM product_stock_batches
    WHERE product_variant_id = product_variants.id AND status = 'active'
    ORDER BY received_date ASC, id ASC
    LIMIT 1
  ),
  weighted_average_cost,
  cost_price_paise_per_unit,
  0
);

-- inventory_value: current_stock * weighted_average_cost.
-- For weight: (current_stock * weighted_average_cost) / 1000
-- For piece: current_stock * weighted_average_cost
UPDATE product_variants
SET inventory_value = CASE 
  WHEN id IN (SELECT pv.id FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE p.unit_type = 'weight') 
  THEN CAST(ROUND(CAST(current_stock * weighted_average_cost AS REAL) / 1000) AS INTEGER)
  ELSE current_stock * weighted_average_cost
END;
