import { db } from '../../../../core/backend/db';
import { logger } from '../../../../core/backend/logger';

export interface UpiMatchCandidate {
  customer_id: number;
  customer_code: string;
  name: string;
  phone: string | null;
  category: string;
  customer_segment?: string;
  confidence_score: number; // 0 - 100
  match_reason: string;
  vpa: string;
  payer_name?: string;
  verified_count: number;
  auto_link: boolean;
}

export interface UpiMatchResult {
  has_match: boolean;
  best_match: UpiMatchCandidate | null;
  candidates: UpiMatchCandidate[];
  raw_payload: {
    vpa?: string;
    payer_name?: string;
    amount_paise?: number;
    ref_number?: string;
  };
  quick_create_suggestion?: {
    name: string;
    phone?: string;
  };
}

export interface CustomerUpiIdentity {
  id: number;
  customer_id: number;
  vpa: string;
  payer_name: string | null;
  verified_count: number;
  auto_link: number;
  last_seen_at: string;
  created_at: string;
}

export class CustomerUpiService {
  /**
   * Matches an incoming UPI transaction payload against known customer profiles and VPA identities.
   * Never auto-assumes identity; returns match candidates with confidence scores.
   */
  public matchUpiPayment(payload: {
    vpa?: string | null;
    payer_name?: string | null;
    amount_paise?: number;
    ref_number?: string | null;
  }): UpiMatchResult {
    const rawVpa = (payload.vpa || '').trim().toLowerCase();
    const rawName = (payload.payer_name || '').trim();
    const candidates: UpiMatchCandidate[] = [];

    // 1. Check known VPA mappings in customer_upi_identities
    if (rawVpa) {
      const vpaRows = db.prepare(`
        SELECT ui.*, c.customer_code, c.name, c.phone, c.category, cac.segment as customer_segment
        FROM customer_upi_identities ui
        JOIN customers c ON ui.customer_id = c.id
        LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
        WHERE LOWER(ui.vpa) = LOWER(?) AND (c.status != 'merged' OR c.status IS NULL)
        ORDER BY ui.verified_count DESC, ui.last_seen_at DESC
      `).all(rawVpa) as any[];

      for (const row of vpaRows) {
        const score = row.verified_count >= 3 ? 98 : (row.verified_count >= 1 ? 92 : 85);
        candidates.push({
          customer_id: row.customer_id,
          customer_code: row.customer_code,
          name: row.name,
          phone: row.phone,
          category: row.category,
          customer_segment: row.customer_segment,
          confidence_score: score,
          match_reason: `Exact VPA match (${row.vpa}) • Verified ${row.verified_count}x previously`,
          vpa: row.vpa,
          payer_name: row.payer_name || rawName,
          verified_count: row.verified_count,
          auto_link: row.auto_link === 1,
        });
      }
    }

    // 2. Extract phone digits from VPA if format is e.g. 9844001122@upi, 9844001122@ybl, etc.
    if (rawVpa) {
      const phoneMatch = rawVpa.match(/^(\d{10})/);
      if (phoneMatch) {
        const extractedPhone = phoneMatch[1];
        const phoneRows = db.prepare(`
          SELECT c.id, c.customer_code, c.name, c.phone, c.category, cac.segment as customer_segment
          FROM customers c
          LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
          WHERE (c.phone = ? OR c.whatsapp = ?) AND (c.status != 'merged' OR c.status IS NULL)
        `).all(extractedPhone, extractedPhone) as any[];

        for (const row of phoneRows) {
          if (!candidates.some(c => c.customer_id === row.id)) {
            candidates.push({
              customer_id: row.id,
              customer_code: row.customer_code,
              name: row.name,
              phone: row.phone,
              category: row.category,
              customer_segment: row.customer_segment,
              confidence_score: 88,
              match_reason: `Mobile number extracted from UPI ID (${extractedPhone})`,
              vpa: rawVpa,
              payer_name: rawName,
              verified_count: 0,
              auto_link: false,
            });
          }
        }
      }
    }

    // 3. Match by Payer Name similarity if provided
    if (rawName && rawName.length >= 3) {
      const nameRows = db.prepare(`
        SELECT c.id, c.customer_code, c.name, c.phone, c.category, cac.segment as customer_segment
        FROM customers c
        LEFT JOIN customer_analytics_cache cac ON c.id = cac.customer_id
        WHERE LOWER(c.name) LIKE ? AND (c.status != 'merged' OR c.status IS NULL)
        LIMIT 5
      `).all(`%${rawName.toLowerCase()}%`) as any[];

      for (const row of nameRows) {
        if (!candidates.some(c => c.customer_id === row.id)) {
          const exact = row.name.trim().toLowerCase() === rawName.toLowerCase();
          candidates.push({
            customer_id: row.id,
            customer_code: row.customer_code,
            name: row.name,
            phone: row.phone,
            category: row.category,
            customer_segment: row.customer_segment,
            confidence_score: exact ? 80 : 65,
            match_reason: exact ? `Exact Payer Name match ("${row.name}")` : `Partial Payer Name match ("${row.name}")`,
            vpa: rawVpa,
            payer_name: rawName,
            verified_count: 0,
            auto_link: false,
          });
        }
      }
    }

    // Sort candidates by highest confidence score
    candidates.sort((a, b) => b.confidence_score - a.confidence_score);

    const hasMatch = candidates.length > 0;
    const bestMatch = hasMatch ? candidates[0] : null;

    // Quick-create suggestion if no exact match
    let quickCreateSuggestion: { name: string; phone?: string } | undefined;
    if (rawName || rawVpa) {
      const phoneDigits = rawVpa.match(/^(\d{10})/)?.[1];
      quickCreateSuggestion = {
        name: rawName || (phoneDigits ? `Customer ${phoneDigits.slice(-4)}` : 'UPI Customer'),
        phone: phoneDigits,
      };
    }

    return {
      has_match: hasMatch,
      best_match: bestMatch,
      candidates,
      raw_payload: {
        vpa: rawVpa || undefined,
        payer_name: rawName || undefined,
        amount_paise: payload.amount_paise,
        ref_number: payload.ref_number || undefined,
      },
      quick_create_suggestion: quickCreateSuggestion,
    };
  }

  /**
   * Confirms a VPA mapping for a customer. Stores/updates in customer_upi_identities.
   */
  public confirmUpiIdentity(customerId: number, vpa: string, payerName?: string | null, autoLink = false): CustomerUpiIdentity {
    const cleanVpa = vpa.trim().toLowerCase();
    if (!cleanVpa) {
      throw new Error('Valid VPA is required');
    }

    const cleanPayer = payerName ? payerName.trim() : null;

    db.prepare(`
      INSERT INTO customer_upi_identities (customer_id, vpa, payer_name, verified_count, auto_link, last_seen_at)
      VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(vpa, customer_id) DO UPDATE SET
        payer_name = COALESCE(excluded.payer_name, customer_upi_identities.payer_name),
        verified_count = customer_upi_identities.verified_count + 1,
        auto_link = CASE WHEN ? = 1 THEN 1 ELSE customer_upi_identities.auto_link END,
        last_seen_at = CURRENT_TIMESTAMP
    `).run(customerId, cleanVpa, cleanPayer, autoLink ? 1 : 0, autoLink ? 1 : 0);

    logger.info('Confirmed UPI VPA mapping for customer', { customerId, vpa: cleanVpa, autoLink });

    return db.prepare(`
      SELECT * FROM customer_upi_identities WHERE customer_id = ? AND LOWER(vpa) = LOWER(?)
    `).get(customerId, cleanVpa) as CustomerUpiIdentity;
  }

  /**
   * List all linked VPAs for a customer.
   */
  public getUpiIdentities(customerId: number): CustomerUpiIdentity[] {
    return db.prepare(`
      SELECT * FROM customer_upi_identities WHERE customer_id = ? ORDER BY verified_count DESC, last_seen_at DESC
    `).all(customerId) as CustomerUpiIdentity[];
  }
}

export const customerUpiService = new CustomerUpiService();
