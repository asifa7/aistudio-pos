import { create } from 'zustand';

export interface QuickPurchaseItemInput {
  product_variant_id: string;
  quantity: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  unit_price: string;
  subtotal: number;
}

export interface QuickPurchaseDraft {
  supplierId: string;
  receivedDate: string;
  billNumber: string;
  billAmount: string;
  notes: string;
  billPhotoPath: string | null;
  paymentMethod: 'cash' | 'credit';
  editingInvoiceId: number | null;
  items: QuickPurchaseItemInput[];
}

interface QuickPurchaseStore {
  draft: QuickPurchaseDraft;
  setDraftField: <K extends keyof QuickPurchaseDraft>(field: K, value: QuickPurchaseDraft[K]) => void;
  setItems: (itemsOrFn: QuickPurchaseItemInput[] | ((prev: QuickPurchaseItemInput[]) => QuickPurchaseItemInput[])) => void;
  resetDraft: () => void;
  hasUnsavedDraft: () => boolean;
  startEditInvoice: (invoice: any, items: any[]) => void;
}

const initialDraft = (): QuickPurchaseDraft => ({
  supplierId: '',
  receivedDate: new Date().toISOString().split('T')[0],
  billNumber: '',
  billAmount: '',
  notes: '',
  billPhotoPath: null,
  paymentMethod: 'credit',
  editingInvoiceId: null,
  items: [],
});

export const useQuickPurchaseStore = create<QuickPurchaseStore>((set, get) => ({
  draft: initialDraft(),
  setDraftField: (field, value) => set((state) => ({
    draft: {
      ...state.draft,
      [field]: value,
    },
  })),
  setItems: (itemsOrFn) => set((state) => ({
    draft: {
      ...state.draft,
      items: typeof itemsOrFn === 'function' ? itemsOrFn(state.draft.items) : itemsOrFn,
    },
  })),
  resetDraft: () => set({ draft: initialDraft() }),
  hasUnsavedDraft: () => {
    const d = get().draft;
    // Don't flag draft if we are just editing an existing invoice and haven't modified it,
    // or flag if there are items entered.
    return !!(
      !d.editingInvoiceId && (
        d.supplierId ||
        d.billNumber ||
        d.billAmount ||
        d.notes ||
        d.billPhotoPath ||
        d.items.length > 0
      )
    );
  },
  startEditInvoice: (invoice, items) => set(() => ({
    draft: {
      supplierId: String(invoice.supplier_id),
      receivedDate: invoice.invoice_date,
      billNumber: invoice.supplier_invoice_number,
      billAmount: String(invoice.total_amount_paise / 100),
      notes: invoice.notes || '',
      billPhotoPath: invoice.file_path || null,
      paymentMethod: invoice.outstanding_amount_paise === 0 ? 'cash' : 'credit',
      editingInvoiceId: invoice.id,
      items: items.map(item => ({
        product_variant_id: String(item.product_variant_id),
        quantity: String(item.quantity),
        unit_type: item.unit_type || 'piece',
        unit_price: String(item.unit_price_paise / 100),
        subtotal: item.total_amount_paise,
      })),
    }
  })),
}));
