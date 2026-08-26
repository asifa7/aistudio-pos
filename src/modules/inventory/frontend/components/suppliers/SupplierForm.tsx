import { useState, useEffect } from 'react';
import { X, AlertCircle, Save, Building2, User, FileText, MapPin, CreditCard, Upload } from 'lucide-react';
import {
  useCreateSupplier,
  useUpdateSupplier,
  useSupplierDetails
} from '../../hooks/useSupplierProcurement';
import { CreateSupplierProfileSchema } from '../../validation/supplier_procurement.schema';

interface SupplierFormProps {
  supplierId?: number;
  onSuccess?: (supplier: any) => void;
  onCancel?: () => void;
}

export default function SupplierForm({ supplierId, onSuccess, onCancel }: SupplierFormProps) {
  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier();
  const { data: existingDetails, isLoading: isLoadingDetails } = useSupplierDetails(supplierId);

  // Tab State
  const [activeTab, setActiveTab] = useState<'other' | 'address' | 'bank' | 'remarks'>('other');

  // Form states
  const [formData, setFormData] = useState({
    salutation: 'Mr.',
    first_name: '',
    last_name: '',
    company_name: '',
    display_name: '',
    work_phone: '',
    mobile_phone: '',
    phone: '',
    whatsapp: '',
    email: '',
    category_id: '',
    gstin: '',
    pan: '',
    payment_terms: 'NET 30',
    currency: 'INR',
    // Address
    billing_address_line1: '',
    billing_address_line2: '',
    billing_city: '',
    billing_state: '',
    billing_pincode: '',
    // Bank Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    // Financials & Settings
    is_preferred: false,
    credit_limit: '',
    opening_balance: '',
    opening_balance_date: new Date().toISOString().split('T')[0],
    preferred_payment_method: 'bank_transfer',
    remarks: '',
    notes: '',
    tags: '',
    document_paths: [] as string[],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (existingDetails) {
      const addr = existingDetails.billing_address_json ? JSON.parse(existingDetails.billing_address_json) : {};
      const docs = existingDetails.document_paths_json ? JSON.parse(existingDetails.document_paths_json) : [];

      setFormData({
        salutation: (existingDetails as any).salutation || 'Mr.',
        first_name: (existingDetails as any).first_name || '',
        last_name: (existingDetails as any).last_name || '',
        company_name: existingDetails.company_name || '',
        display_name: (existingDetails as any).display_name || existingDetails.company_name || '',
        work_phone: (existingDetails as any).work_phone || '',
        mobile_phone: (existingDetails as any).mobile_phone || existingDetails.phone || '',
        phone: existingDetails.phone || '',
        whatsapp: existingDetails.whatsapp || '',
        email: existingDetails.email || '',
        category_id: existingDetails.category_id ? String(existingDetails.category_id) : '',
        gstin: existingDetails.gstin || '',
        pan: existingDetails.pan || '',
        payment_terms: (existingDetails as any).payment_terms || 'NET 30',
        currency: (existingDetails as any).currency || 'INR',
        billing_address_line1: addr.line1 || '',
        billing_address_line2: addr.line2 || '',
        billing_city: addr.city || '',
        billing_state: addr.state || '',
        billing_pincode: addr.pincode || '',
        bank_name: (existingDetails as any).bank_name || '',
        account_number: (existingDetails as any).account_number || '',
        ifsc_code: (existingDetails as any).ifsc_code || '',
        is_preferred: existingDetails.is_preferred === 1,
        credit_limit: String(existingDetails.credit_limit_paise / 100),
        opening_balance: String(existingDetails.opening_balance_paise / 100),
        opening_balance_date: existingDetails.opening_balance_date
          ? existingDetails.opening_balance_date.slice(0, 10)
          : new Date().toISOString().split('T')[0],
        preferred_payment_method: existingDetails.preferred_payment_method || 'bank_transfer',
        remarks: (existingDetails as any).remarks || '',
        notes: existingDetails.notes || '',
        tags: existingDetails.tags || '',
        document_paths: docs,
      });
    }
  }, [existingDetails]);

  // Auto-suggest Display Name
  const handleNameChange = (field: string, val: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: val };
      if (field === 'company_name' || field === 'first_name' || field === 'last_name') {
        const contactName = [updated.salutation, updated.first_name, updated.last_name].filter(Boolean).join(' ');
        if (!prev.display_name || prev.display_name === prev.company_name || prev.display_name === contactName) {
          updated.display_name = updated.company_name || contactName;
        }
      }
      return updated;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    if (['company_name', 'first_name', 'last_name', 'salutation'].includes(name)) {
      handleNameChange(name, String(val));
    } else {
      setFormData(prev => ({ ...prev, [name]: val }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }
    const path = (file as any).path || file.name;
    setFormData(prev => ({
      ...prev,
      document_paths: [...prev.document_paths, path]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setErrorMsg('');

    const phoneFinal = formData.mobile_phone || formData.work_phone || formData.phone || null;
    const ownerNameFinal = [formData.salutation, formData.first_name, formData.last_name].filter(Boolean).join(' ') || null;

    const billingAddressJson = (formData.billing_address_line1 || formData.billing_city)
      ? JSON.stringify({
          line1: formData.billing_address_line1,
          line2: formData.billing_address_line2,
          city: formData.billing_city,
          state: formData.billing_state,
          pincode: formData.billing_pincode,
        })
      : null;

    const validationInput = {
      salutation: formData.salutation,
      first_name: formData.first_name.trim() || null,
      last_name: formData.last_name.trim() || null,
      company_name: formData.company_name.trim(),
      display_name: formData.display_name.trim() || formData.company_name.trim(),
      owner_name: ownerNameFinal,
      gstin: formData.gstin.trim() || null,
      pan: formData.pan.trim() || null,
      phone: phoneFinal,
      work_phone: formData.work_phone.trim() || null,
      mobile_phone: formData.mobile_phone.trim() || null,
      whatsapp: formData.whatsapp.trim() || null,
      email: formData.email.trim() || null,
      category_id: formData.category_id ? parseInt(formData.category_id) : null,
      payment_terms: formData.payment_terms,
      currency: formData.currency,
      billing_address_json: billingAddressJson,
      bank_name: formData.bank_name.trim() || null,
      account_number: formData.account_number.trim() || null,
      ifsc_code: formData.ifsc_code.trim() || null,
      remarks: formData.remarks.trim() || null,
      document_paths_json: formData.document_paths.length > 0 ? JSON.stringify(formData.document_paths) : null,
      is_preferred: formData.is_preferred ? 1 : 0,
      credit_limit_paise: formData.credit_limit ? Math.round(parseFloat(formData.credit_limit) * 100) : 0,
      opening_balance_paise: formData.opening_balance ? Math.round(parseFloat(formData.opening_balance) * 100) : 0,
      opening_balance_date: formData.opening_balance_date || null,
      preferred_payment_method: formData.preferred_payment_method || null,
      notes: formData.notes.trim() || null,
      tags: formData.tags.trim() || null,
    };

    const parsed = CreateSupplierProfileSchema.safeParse(validationInput);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((err: any) => {
        if (err.path[0]) {
          errors[String(err.path[0])] = err.message;
        }
      });
      setFormErrors(errors);
      setErrorMsg('Please check form fields for errors.');
      return;
    }

    try {
      let result;
      if (supplierId) {
        result = await updateSupplierMutation.mutateAsync({
          id: supplierId,
          fields: parsed.data as any,
        });
      } else {
        result = await createSupplierMutation.mutateAsync(parsed.data as any);
      }
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save supplier profile.');
    }
  };

  if (supplierId && isLoadingDetails) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading supplier details...</div>;
  }

  return (
    <div className="bg-surface-panel rounded-2xl border border-border-subtle overflow-hidden flex flex-col h-full shadow-elevation max-h-[88vh]">
      {/* Form Header */}
      <div className="border-b border-border-subtle p-4 flex items-center justify-between bg-surface-card">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 text-brand-400 rounded-xl">
            <Building2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold font-outfit text-text-primary">
              {supplierId ? 'Edit Vendor Profile' : 'New Vendor Profile'}
            </h3>
            <p className="text-xs text-text-muted">
              Configure primary contact, company name, tax details, bank account, and payment terms.
            </p>
          </div>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-hover">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/30 border border-rose-800/60 rounded-xl text-xs font-semibold text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Top Primary Section: Contact & Company */}
          <div className="bg-surface-card border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-2">
              <User size={14} /> Primary Contact & Business Name
            </h4>

            {/* Salutation + First Name + Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Salutation</label>
                <select
                  name="salutation"
                  value={formData.salutation}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Dr.">Dr.</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  placeholder="e.g. Rahul"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  placeholder="e.g. Sharma"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Company Name & Display Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  placeholder="e.g. Royal Poultry Farms Ltd"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-bold outline-none focus:border-brand-500"
                />
                {formErrors.company_name && (
                  <span className="text-[10px] text-red-400 font-semibold">{formErrors.company_name}</span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">
                  Vendor Display Name (Auto-suggested)
                </label>
                <input
                  type="text"
                  name="display_name"
                  placeholder="e.g. Royal Poultry"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Email & Phone Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Work Email</label>
                <input
                  type="email"
                  name="email"
                  placeholder="vendor@company.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Work Phone</label>
                <input
                  type="text"
                  name="work_phone"
                  placeholder="080-23456789"
                  value={formData.work_phone}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Mobile Phone</label>
                <input
                  type="text"
                  name="mobile_phone"
                  placeholder="9876543210"
                  value={formData.mobile_phone}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Zoho Books Style Tabbed Navigation Bar */}
          <div className="border-b border-border-subtle flex items-center gap-4 text-xs font-bold text-text-muted">
            <button
              type="button"
              onClick={() => setActiveTab('other')}
              className={`py-2 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'other'
                  ? 'border-brand-500 text-brand-400 bg-brand-500/10 rounded-t-lg'
                  : 'border-transparent hover:text-text-primary'
              }`}
            >
              <FileText size={14} /> Other Details & Tax
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('address')}
              className={`py-2 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'address'
                  ? 'border-brand-500 text-brand-400 bg-brand-500/10 rounded-t-lg'
                  : 'border-transparent hover:text-text-primary'
              }`}
            >
              <MapPin size={14} /> Address
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bank')}
              className={`py-2 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'bank'
                  ? 'border-brand-500 text-brand-400 bg-brand-500/10 rounded-t-lg'
                  : 'border-transparent hover:text-text-primary'
              }`}
            >
              <CreditCard size={14} /> Bank Payout Details
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('remarks')}
              className={`py-2 px-3 flex items-center gap-1.5 border-b-2 transition-all ${
                activeTab === 'remarks'
                  ? 'border-brand-500 text-brand-400 bg-brand-500/10 rounded-t-lg'
                  : 'border-transparent hover:text-text-primary'
              }`}
            >
              <Upload size={14} /> Remarks & Documents
            </button>
          </div>

          {/* TAB 1: OTHER DETAILS */}
          {activeTab === 'other' && (
            <div className="bg-surface-card border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">GSTIN</label>
                  <input
                    type="text"
                    name="gstin"
                    placeholder="29ABCDE1234F1Z5"
                    value={formData.gstin}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono uppercase outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">PAN Number</label>
                  <input
                    type="text"
                    name="pan"
                    placeholder="ABCDE1234F"
                    value={formData.pan}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono uppercase outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Payment Terms</label>
                  <select
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="NET 7">NET 7 (7 Days)</option>
                    <option value="NET 15">NET 15 (15 Days)</option>
                    <option value="NET 30">NET 30 (30 Days)</option>
                    <option value="NET 60">NET 60 (60 Days)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border-subtle/60 pt-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="opening_balance"
                    placeholder="0.00"
                    value={formData.opening_balance}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Opening Balance Date</label>
                  <input
                    type="date"
                    name="opening_balance_date"
                    value={formData.opening_balance_date}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Credit Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="credit_limit"
                    placeholder="e.g. 50000.00"
                    value={formData.credit_limit}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADDRESS */}
          {activeTab === 'address' && (
            <div className="bg-surface-card border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
              <h5 className="text-xs font-bold text-text-secondary">Billing Address</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Address Line 1</label>
                  <input
                    type="text"
                    name="billing_address_line1"
                    placeholder="Building / Street Address"
                    value={formData.billing_address_line1}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Address Line 2</label>
                  <input
                    type="text"
                    name="billing_address_line2"
                    placeholder="Area / Landmark"
                    value={formData.billing_address_line2}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">City</label>
                  <input
                    type="text"
                    name="billing_city"
                    placeholder="e.g. Bengaluru"
                    value={formData.billing_city}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">State</label>
                  <input
                    type="text"
                    name="billing_state"
                    placeholder="e.g. Karnataka"
                    value={formData.billing_state}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Pincode</label>
                  <input
                    type="text"
                    name="billing_pincode"
                    placeholder="560001"
                    value={formData.billing_pincode}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BANK DETAILS */}
          {activeTab === 'bank' && (
            <div className="bg-surface-card border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
              <h5 className="text-xs font-bold text-text-secondary">Vendor Payout Bank Account</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Bank Name</label>
                  <input
                    type="text"
                    name="bank_name"
                    placeholder="e.g. HDFC Bank"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">Account Number</label>
                  <input
                    type="text"
                    name="account_number"
                    placeholder="5010023456789"
                    value={formData.account_number}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-text-secondary mb-1">IFSC Code</label>
                  <input
                    type="text"
                    name="ifsc_code"
                    placeholder="HDFC0001234"
                    value={formData.ifsc_code}
                    onChange={handleInputChange}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono uppercase outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REMARKS & DOCUMENTS */}
          {activeTab === 'remarks' && (
            <div className="bg-surface-card border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Internal Remarks</label>
                <textarea
                  name="remarks"
                  rows={3}
                  placeholder="Add notes on delivery schedules, quality benchmarks, or terms..."
                  value={formData.remarks}
                  onChange={handleInputChange}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary mb-1">Attach Documents (Agreements, Bills)</label>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-muted file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-brand-500/10 file:text-brand-400"
                />
                {formData.document_paths.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.document_paths.map((doc, idx) => (
                      <p key={idx} className="text-[10px] text-brand-400 font-medium">✓ {doc}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-border-subtle text-text-muted hover:text-text-primary rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={createSupplierMutation.isPending || updateSupplierMutation.isPending}
              className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all disabled:opacity-40"
            >
              <Save size={16} />
              <span>{supplierId ? 'Update Vendor' : 'Save Vendor Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
