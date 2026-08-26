import { container } from '../../../../core/di/container';
import { db } from '../../../../core/backend/db';
import { ValidationError, NotFoundError } from '../../../../core/backend/errors';
import { CreateSupplierProfileSchema, UpdateSupplierProfileSchema } from '../validation/supplier_procurement.schema';
import {
  FullSupplierRow,
  SupplierCategoryRow,
  SupplierContactRow,
  SupplierAddressRow,
  SupplierBankAccountRow,
  SupplierPaymentTermsRow
} from '../../../../core/database/repositories/repository_interfaces';

export interface SupplierDocumentRow {
  id: number;
  supplier_id: number;
  document_name: string;
  document_type: string | null;
  file_path: string;
  uploaded_at: string;
}

export class SupplierService {
  private get supplierProfileRepo() {
    return container.supplierProfileRepository;
  }

  public get supplierProfileRepository() {
    return container.supplierProfileRepository;
  }

  public createSupplier(raw: unknown, userId: number): FullSupplierRow {
    const parsed = CreateSupplierProfileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid supplier profile creation input', parsed.error.flatten());
    }

    return container.databaseProvider.transaction(() => {
      const created = this.supplierProfileRepo.create(parsed.data);
      // Log activity
      db.prepare(`
        INSERT INTO supplier_activity_logs (supplier_id, action_type, performed_by, details)
        VALUES (?, 'CREATE', ?, ?)
      `).run(created.id, userId, JSON.stringify({ company_name: created.company_name }));
      return created;
    });
  }

  public updateSupplier(id: number, raw: unknown, userId: number): FullSupplierRow {
    const existing = this.supplierProfileRepo.findById(id);
    if (!existing) {
      throw new NotFoundError(`Supplier with id ${id} not found`);
    }

    const parsed = UpdateSupplierProfileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError('Invalid supplier profile update input', parsed.error.flatten());
    }

    return container.databaseProvider.transaction(() => {
      const updated = this.supplierProfileRepo.update(id, parsed.data);
      // Log activity
      db.prepare(`
        INSERT INTO supplier_activity_logs (supplier_id, action_type, performed_by, details)
        VALUES (?, 'UPDATE', ?, ?)
      `).run(id, userId, JSON.stringify(parsed.data));
      return updated;
    });
  }

  public getSupplier(id: number): FullSupplierRow & {
    contacts: SupplierContactRow[];
    addresses: SupplierAddressRow[];
    bankAccounts: SupplierBankAccountRow[];
    paymentTerms?: SupplierPaymentTermsRow;
    documents: SupplierDocumentRow[];
  } {
    const supplier = this.supplierProfileRepo.findById(id);
    if (!supplier) {
      throw new NotFoundError(`Supplier with id ${id} not found`);
    }

    const contacts = this.supplierProfileRepo.getContacts(id);
    const addresses = this.supplierProfileRepo.getAddresses(id);
    const bankAccounts = this.supplierProfileRepo.getBankAccounts(id);
    const paymentTerms = this.supplierProfileRepo.getPaymentTerms(id);
    const documents = db.prepare('SELECT * FROM supplier_documents WHERE supplier_id = ?').all(id) as SupplierDocumentRow[];

    return {
      ...supplier,
      contacts,
      addresses,
      bankAccounts,
      paymentTerms,
      documents,
    };
  }

  public listSuppliers(): FullSupplierRow[] {
    return this.supplierProfileRepo.findAll();
  }

  public createCategory(name: string, description?: string | null): SupplierCategoryRow {
    if (!name?.trim()) {
      throw new ValidationError('Category name is required');
    }
    return this.supplierProfileRepo.createCategory(name, description ?? null);
  }

  public listCategories(): SupplierCategoryRow[] {
    return this.supplierProfileRepo.findAllCategories();
  }

  public addContact(supplierId: number, contact: Omit<SupplierContactRow, 'id' | 'supplier_id' | 'created_at'>): SupplierContactRow {
    if (!contact.contact_name?.trim()) {
      throw new ValidationError('Contact name is required');
    }
    return this.supplierProfileRepo.addContact(supplierId, contact);
  }

  public getContacts(supplierId: number): SupplierContactRow[] {
    return this.supplierProfileRepo.getContacts(supplierId);
  }

  public removeContact(id: number): void {
    this.supplierProfileRepo.removeContact(id);
  }

  public addAddress(supplierId: number, address: Omit<SupplierAddressRow, 'id' | 'supplier_id' | 'created_at'>): SupplierAddressRow {
    if (!address.address_line1?.trim()) {
      throw new ValidationError('Address line 1 is required');
    }
    if (!address.address_type) {
      throw new ValidationError('Address type is required');
    }
    return this.supplierProfileRepo.addAddress(supplierId, address);
  }

  public getAddresses(supplierId: number): SupplierAddressRow[] {
    return this.supplierProfileRepo.getAddresses(supplierId);
  }

  public removeAddress(id: number): void {
    this.supplierProfileRepo.removeAddress(id);
  }

  public addBankAccount(supplierId: number, account: Omit<SupplierBankAccountRow, 'id' | 'supplier_id' | 'created_at'>): SupplierBankAccountRow {
    if (!account.bank_name?.trim() || !account.account_number?.trim() || !account.ifsc_code?.trim() || !account.account_holder_name?.trim()) {
      throw new ValidationError('Bank name, account number, IFSC code, and account holder name are required');
    }
    return this.supplierProfileRepo.addBankAccount(supplierId, account);
  }

  public getBankAccounts(supplierId: number): SupplierBankAccountRow[] {
    return this.supplierProfileRepo.getBankAccounts(supplierId);
  }

  public removeBankAccount(id: number): void {
    this.supplierProfileRepo.removeBankAccount(id);
  }

  public upsertPaymentTerms(supplierId: number, terms: { payment_terms_days?: number; grace_period_days?: number }): SupplierPaymentTermsRow {
    return this.supplierProfileRepo.upsertPaymentTerms(supplierId, terms);
  }

  public getPaymentTerms(supplierId: number): SupplierPaymentTermsRow | undefined {
    return this.supplierProfileRepo.getPaymentTerms(supplierId);
  }

  public rateSupplier(supplierId: number, rating: number, ratedBy: number, comments?: string | null): void {
    if (rating < 1 || rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5');
    }

    container.databaseProvider.transaction(() => {
      // 1. Insert into history
      db.prepare(`
        INSERT INTO supplier_rating_history (supplier_id, rating, rated_by, comments)
        VALUES (?, ?, ?, ?)
      `).run(supplierId, rating, ratedBy, comments ?? null);

      // 2. Compute average rating
      const row = db.prepare(`
        SELECT AVG(rating) as avg_rating FROM supplier_rating_history WHERE supplier_id = ?
      `).get(supplierId) as { avg_rating: number | null } | undefined;

      const avgRating = row?.avg_rating ?? rating;

      // 3. Update suppliers table
      this.supplierProfileRepo.update(supplierId, { rating: avgRating });
    });
  }

  // Document Management Operations
  public addDocument(supplierId: number, document: { document_name: string; document_type?: string | null; file_path: string }): SupplierDocumentRow {
    if (!document.document_name?.trim()) {
      throw new ValidationError('Document name is required');
    }
    if (!document.file_path?.trim()) {
      throw new ValidationError('File path is required');
    }
    const res = db.prepare(`
      INSERT INTO supplier_documents (supplier_id, document_name, document_type, file_path)
      VALUES (?, ?, ?, ?)
    `).run(supplierId, document.document_name, document.document_type ?? null, document.file_path);

    return db.prepare('SELECT * FROM supplier_documents WHERE id = ?').get(res.lastInsertRowid) as SupplierDocumentRow;
  }

  public getDocuments(supplierId: number): SupplierDocumentRow[] {
    return db.prepare('SELECT * FROM supplier_documents WHERE supplier_id = ?').all(supplierId) as SupplierDocumentRow[];
  }

  public removeDocument(id: number): void {
    db.prepare('DELETE FROM supplier_documents WHERE id = ?').run(id);
  }
}

export const supplierService = new SupplierService();
export default supplierService;
