import { invoiceSequenceRepository } from '../repository/invoice_sequence_repository';

function getCurrentDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatInvoiceNumber(dateKey: string, sequenceNumber: number): string {
  // Store as "1_YYYY-MM-DD" to bypass DB uniqueness constraint across days, 
  // but we will strip the suffix in the UI and printouts to just show "1".
  return `${sequenceNumber}_${dateKey}`;
}

const invoiceNumberingService = {
  generateNextNumber(): { invoiceNumber: string; financialYear: string } {
    const dateKey = getCurrentDateKey();
    const financialYear = dateKey; // using dateKey as the sequence grouping key in DB
    const sequenceNumber = invoiceSequenceRepository.getAndIncrement(financialYear);
    const invoiceNumber = formatInvoiceNumber(dateKey, sequenceNumber);
    return { invoiceNumber, financialYear };
  },

  getCurrentFinancialYear: getCurrentDateKey,
  formatInvoiceNumber,
};

export { invoiceNumberingService };
