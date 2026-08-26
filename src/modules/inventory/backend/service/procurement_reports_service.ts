import { container } from '../../../../core/di/container';
import { db } from '../../../../core/backend/db';
import { SupplierAgingRow } from '../../../../core/database/repositories/repository_interfaces';
import { supplierLedgerService } from './supplier_ledger_service';

export class ProcurementReportsService {
  public getPurchaseRegister(startDate: string, endDate: string): any {
    const invoices = db.prepare(`
      SELECT pi.*, s.company_name as supplier_name, s.code as supplier_code
      FROM purchase_invoices pi
      JOIN suppliers s ON pi.supplier_id = s.id
      WHERE DATE(pi.invoice_date) BETWEEN DATE(?) AND DATE(?)
      ORDER BY pi.invoice_date DESC, pi.id DESC
    `).all(startDate, endDate);

    const summary = db.prepare(`
      SELECT 
        COUNT(*) as invoice_count,
        COALESCE(SUM(subtotal_paise), 0) as total_subtotal_paise,
        COALESCE(SUM(gst_paise), 0) as total_gst_paise,
        COALESCE(SUM(cgst_paise), 0) as total_cgst_paise,
        COALESCE(SUM(sgst_paise), 0) as total_sgst_paise,
        COALESCE(SUM(igst_paise), 0) as total_igst_paise,
        COALESCE(SUM(freight_charges_paise), 0) as total_freight_charges_paise,
        COALESCE(SUM(loading_charges_paise), 0) as total_loading_charges_paise,
        COALESCE(SUM(packing_charges_paise), 0) as total_packing_charges_paise,
        COALESCE(SUM(other_charges_paise), 0) as total_other_charges_paise,
        COALESCE(SUM(discount_paise), 0) as total_discount_paise,
        COALESCE(SUM(total_amount_paise), 0) as total_amount_paise
      FROM purchase_invoices
      WHERE DATE(invoice_date) BETWEEN DATE(?) AND DATE(?)
    `).get(startDate, endDate);

    return {
      startDate,
      endDate,
      summary,
      invoices,
    };
  }

  public getSupplierAgingReport(): SupplierAgingRow[] {
    return container.supplierReportRepository.getSupplierAgingReport();
  }

  public getSupplierStatement(supplierId: number, startDate: string, endDate: string): any {
    return supplierLedgerService.getStatement(supplierId, startDate, endDate);
  }

  public getPriceHistoryTrend(productVariantId: number): any {
    const variant = container.productRepository.findVariantById(productVariantId);
    
    const trends = db.prepare(`
      SELECT sph.*, s.company_name as supplier_name, s.code as supplier_code
      FROM supplier_price_history sph
      JOIN suppliers s ON sph.supplier_id = s.id
      WHERE sph.product_variant_id = ?
      ORDER BY sph.effective_date DESC, sph.id DESC
    `).all(productVariantId);

    const stats = db.prepare(`
      SELECT 
        MIN(unit_price_paise) as min_price_paise,
        MAX(unit_price_paise) as max_price_paise,
        AVG(unit_price_paise) as avg_price_paise,
        (SELECT unit_price_paise FROM supplier_price_history WHERE product_variant_id = ? ORDER BY effective_date DESC, id DESC LIMIT 1) as latest_price_paise
      FROM supplier_price_history
      WHERE product_variant_id = ?
    `).get(productVariantId, productVariantId) as {
      min_price_paise: number | null;
      max_price_paise: number | null;
      avg_price_paise: number | null;
      latest_price_paise: number | null;
    } | undefined;

    return {
      productVariantId,
      variantName: variant ? `${variant.product_name} (${variant.variant_name})` : 'Unknown Variant',
      stats: stats || {
        min_price_paise: null,
        max_price_paise: null,
        avg_price_paise: null,
        latest_price_paise: null,
      },
      trends,
    };
  }

  public getCheapestSupplier(productVariantId: number): any {
    const cheapest = db.prepare(`
      SELECT sph.supplier_id, s.company_name, s.code as supplier_code, sph.unit_price_paise, sph.effective_date
      FROM supplier_price_history sph
      JOIN suppliers s ON sph.supplier_id = s.id
      WHERE sph.product_variant_id = ?
      ORDER BY sph.unit_price_paise ASC, sph.effective_date DESC
      LIMIT 1
    `).get(productVariantId) as {
      supplier_id: number;
      company_name: string;
      supplier_code: string;
      unit_price_paise: number;
      effective_date: string;
    } | undefined;

    if (!cheapest) {
      return {
        productVariantId,
        suggestedSupplier: null,
      };
    }

    return {
      productVariantId,
      suggestedSupplier: cheapest,
    };
  }

  public getSupplierPurchaseVolumes(startDate: string, endDate: string): any[] {
    return db.prepare(`
      SELECT 
        s.id as supplier_id,
        s.company_name,
        s.code as supplier_code,
        COUNT(pi.id) as invoice_count,
        COALESCE(SUM(pi.total_amount_paise), 0) as total_purchase_amount_paise
      FROM suppliers s
      LEFT JOIN purchase_invoices pi ON s.id = pi.supplier_id AND DATE(pi.invoice_date) BETWEEN DATE(?) AND DATE(?)
      GROUP BY s.id
      ORDER BY total_purchase_amount_paise DESC
    `).all(startDate, endDate);
  }
}

export const procurementReportsService = new ProcurementReportsService();
export default procurementReportsService;
