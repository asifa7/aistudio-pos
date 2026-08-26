import { db } from '../../../../core/backend/db';
import { logger, auditLogger } from '../../../../core/backend/logger';
import { authService } from '../../../auth/backend/service/auth_service';
import type { DailyMarketPrice, EggMarketPrice } from '../../../../core/types/enterprise_types';

export class MarketPriceService {
  public setChickenPrice(input: Partial<DailyMarketPrice>): DailyMarketPrice {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const today = new Date().toISOString().split('T')[0];
    const userId = authService.getCurrentUserId();

    const stmt = db.prepare(`
      INSERT INTO daily_market_prices (
        date, product_name, grade, market_rate_paise, wholesale_rate_paise,
        retail_rate_paise, selling_rate_paise, expected_margin_percent, supplier_name, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, product_name, grade) DO UPDATE SET
        market_rate_paise = excluded.market_rate_paise,
        wholesale_rate_paise = excluded.wholesale_rate_paise,
        retail_rate_paise = excluded.retail_rate_paise,
        selling_rate_paise = excluded.selling_rate_paise,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      input.date || today,
      input.product_name || 'Chicken Whole',
      input.grade || 'Standard',
      input.market_rate_paise || 20000,
      input.wholesale_rate_paise || 22000,
      input.retail_rate_paise || 26000,
      input.selling_rate_paise || 28000,
      input.expected_margin_percent || 15.0,
      input.supplier_name || null,
      input.notes || null,
      userId
    );

    auditLogger.log(userId, 'MARKET_PRICE_SET_CHICKEN', { date: input.date || today, sellingRate: input.selling_rate_paise });
    logger.info('Chicken daily market price updated', { sellingRate: input.selling_rate_paise });
    return db.prepare('SELECT * FROM daily_market_prices WHERE date = ? AND product_name = ? AND grade = ?').get(input.date || today, input.product_name || 'Chicken Whole', input.grade || 'Standard') as DailyMarketPrice;
  }

  public getChickenPrices(): DailyMarketPrice[] {
    return db.prepare('SELECT * FROM daily_market_prices ORDER BY date DESC, id DESC LIMIT 50').all() as DailyMarketPrice[];
  }

  public setEggPrice(input: Partial<EggMarketPrice>): EggMarketPrice {
    authService.requireRole(['ADMIN', 'MANAGER']);
    const today = new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
      INSERT INTO egg_market_prices (
        date, egg_type, tray_price_paise, single_price_paise, wholesale_price_paise, retail_price_paise
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, egg_type) DO UPDATE SET
        tray_price_paise = excluded.tray_price_paise,
        single_price_paise = excluded.single_price_paise,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      input.date || today,
      input.egg_type || 'Farm',
      input.tray_price_paise || 18000,
      input.single_price_paise || 700,
      input.wholesale_price_paise || 17000,
      input.retail_price_paise || 18000
    );

    return db.prepare('SELECT * FROM egg_market_prices WHERE date = ? AND egg_type = ?').get(input.date || today, input.egg_type || 'Farm') as EggMarketPrice;
  }

  public getEggPrices(): EggMarketPrice[] {
    return db.prepare('SELECT * FROM egg_market_prices ORDER BY date DESC, id DESC LIMIT 50').all() as EggMarketPrice[];
  }
}

export const marketPriceService = new MarketPriceService();
