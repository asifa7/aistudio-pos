import { db } from '../../../../core/backend/db';
import { logger } from '../../../../core/backend/logger';

export interface CustomerVisitRow {
  id: number;
  customer_id: number | null;
  visit_timestamp: string;
  detection_method: 'camera_recognition' | 'manual' | 'phone_lookup';
  camera_snapshot_path: string | null;
  linked_invoice_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerFaceProfileRow {
  id: number;
  customer_id: number;
  face_embedding_data: string;
  reference_photo_path: string | null;
  enrolled_at: string;
  last_matched_at: string | null;
  match_confidence_threshold: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface MatchResult {
  customerId: number;
  confidence: number;
  faceProfileId: number;
  customerName: string;
}

export const recognitionService = {
  /**
   * Stub service method for camera face matching.
   * Compares input 512-dimension vector against enrolled face profiles where allow_face_recognition = 1.
   */
  async matchFace(embeddingVector: number[]): Promise<MatchResult | null> {
    try {
      if (!embeddingVector || embeddingVector.length === 0) return null;

      // Query active face profiles for customers who opted in to face recognition
      const profiles = db.prepare(`
        SELECT fp.*, c.name as customer_name
        FROM customer_face_profiles fp
        JOIN customers c ON fp.customer_id = c.id
        WHERE fp.is_active = 1 AND c.is_active = 1 AND c.allow_face_recognition = 1
      `).all() as (CustomerFaceProfileRow & { customer_name: string })[];

      let bestMatch: MatchResult | null = null;
      let maxScore = -1;

      for (const profile of profiles) {
        try {
          const storedVector = JSON.parse(profile.face_embedding_data) as number[];
          const score = recognitionService.cosineSimilarity(embeddingVector, storedVector);
          
          if (score >= profile.match_confidence_threshold && score > maxScore) {
            maxScore = score;
            bestMatch = {
              customerId: profile.customer_id,
              confidence: score,
              faceProfileId: profile.id,
              customerName: profile.customer_name,
            };
          }
        } catch (err) {
          logger.warn(`Failed to parse face embedding vector for profile #${profile.id}`, { error: String(err) });
        }
      }

      if (bestMatch) {
        // Update last_matched_at
        db.prepare('UPDATE customer_face_profiles SET last_matched_at = CURRENT_TIMESTAMP WHERE id = ?').run(bestMatch.faceProfileId);
      }

      return bestMatch;
    } catch (err) {
      logger.error('Error during face matching', { error: String(err) });
      return null;
    }
  },

  /**
   * Calculates Cosine Similarity between two N-dimensional numerical vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  },

  /**
   * Enrolls a face profile vector for a customer.
   */
  enrollFaceProfile(
    customerId: number,
    embeddingVector: number[],
    referencePhotoPath?: string,
    confidenceThreshold = 0.85
  ): number {
    const vectorJson = JSON.stringify(embeddingVector);
    const result = db.prepare(`
      INSERT INTO customer_face_profiles (
        customer_id, face_embedding_data, reference_photo_path, match_confidence_threshold, is_active
      ) VALUES (?, ?, ?, ?, 1)
    `).run(customerId, vectorJson, referencePhotoPath ?? null, confidenceThreshold);

    // Ensure customer has allow_face_recognition enabled
    db.prepare('UPDATE customers SET allow_face_recognition = 1 WHERE id = ?').run(customerId);

    return result.lastInsertRowid as number;
  },

  /**
   * Logs a store visit (from camera, manual lookup, or phone search).
   */
  logVisit(input: {
    customerId?: number | null;
    detectionMethod: 'camera_recognition' | 'manual' | 'phone_lookup';
    cameraSnapshotPath?: string | null;
    linkedInvoiceId?: number | null;
    notes?: string | null;
  }): number {
    const result = db.prepare(`
      INSERT INTO customer_visits (
        customer_id, detection_method, camera_snapshot_path, linked_invoice_id, notes
      ) VALUES (?, ?, ?, ?, ?)
    `).run(
      input.customerId ?? null,
      input.detectionMethod,
      input.cameraSnapshotPath ?? null,
      input.linkedInvoiceId ?? null,
      input.notes ?? null
    );

    return result.lastInsertRowid as number;
  },

  /**
   * Retroactively links an anonymous or unlinked visit to a customer and invoice.
   */
  linkVisitToCustomer(visitId: number, customerId: number, linkedInvoiceId?: number): void {
    if (linkedInvoiceId) {
      db.prepare(`
        UPDATE customer_visits
        SET customer_id = ?, linked_invoice_id = ?
        WHERE id = ?
      `).run(customerId, linkedInvoiceId, visitId);
    } else {
      db.prepare(`
        UPDATE customer_visits
        SET customer_id = ?
        WHERE id = ?
      `).run(customerId, visitId);
    }
  },

  /**
   * Retrieves visit history for a customer.
   */
  getCustomerVisits(customerId: number, limit = 50): CustomerVisitRow[] {
    return db.prepare(`
      SELECT * FROM customer_visits
      WHERE customer_id = ?
      ORDER BY visit_timestamp DESC
      LIMIT ?
    `).all(customerId, limit) as CustomerVisitRow[];
  }
};
