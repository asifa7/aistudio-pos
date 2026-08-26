import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Plus,
  Trash2,
  AlertCircle,
  Printer,
  DollarSign,
  PlusCircle,
  Clock,
  Briefcase
} from 'lucide-react';
import {
  useSupplierDetails,
  useAddSupplierContact,
  useRemoveSupplierContact,
  useAddSupplierAddress,
  useRemoveSupplierAddress,
  useAddSupplierBankAccount,
  useRemoveSupplierBankAccount,
  useUpsertSupplierPaymentTerms,
  useSupplierLedger,
  useSupplierStatement,
  useRecordSupplierAdjustment
} from '../../hooks/useSupplierProcurement';
import { formatPaise, formatDate } from '../../types/supplier.types';
import SupplierPaymentDialog from './SupplierPaymentDialog';

interface SupplierDetailsViewProps {
  supplierId: number;
  onBack: () => void;
}

export default function SupplierDetailsView({ supplierId, onBack }: SupplierDetailsViewProps) {
  const { data: details, isLoading, refetch: refetchDetails } = useSupplierDetails(supplierId);
  const { data: ledger, isLoading: isLoadingLedger, refetch: refetchLedger } = useSupplierLedger(supplierId);

  // Mutations
  const addContactMutation = useAddSupplierContact();
  const removeContactMutation = useRemoveSupplierContact(supplierId);
  const addAddressMutation = useAddSupplierAddress();
  const removeAddressMutation = useRemoveSupplierAddress(supplierId);
  const addBankMutation = useAddSupplierBankAccount();
  const removeBankMutation = useRemoveSupplierBankAccount(supplierId);
  const upsertTermsMutation = useUpsertSupplierPaymentTerms();
  const recordAdjustmentMutation = useRecordSupplierAdjustment();

  // Tab State
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'contacts' | 'ledger' | 'statement'>('overview');

  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [showAddContact, setShowAddContact] = useState(false);

  // Address Form State
  const [addrType, setAddrType] = useState<'billing' | 'shipping' | 'warehouse'>('billing');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [showAddAddr, setShowAddAddr] = useState(false);

  // Bank Form State
  const [bankName, setBankName] = useState('');
  const [bankAccNum, setBankAccNum] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankUpi, setBankUpi] = useState('');
  const [showAddBank, setShowAddBank] = useState(false);

  // Payment Terms Form State
  const [termsDays, setTermsDays] = useState('');
  const [graceDays, setGraceDays] = useState('');
  const [showEditTerms, setShowEditTerms] = useState(false);

  // Manual Adjustment Form State
  const [adjType, setAdjType] = useState<'debit' | 'credit'>('credit');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjDesc, setAdjDesc] = useState('');
  const [adjError, setAdjError] = useState('');
  const [adjSuccess, setAdjSuccess] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);

  // Statement Filters State
  const [stmtStart, setStmtStart] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [stmtEnd, setStmtEnd] = useState(new Date().toISOString().split('T')[0]);

  // Payment Dialog Trigger
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Statement Fetch
  const { data: statement, refetch: refetchStatement } = useSupplierStatement(
    supplierId,
    stmtStart,
    stmtEnd
  );

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-text-muted">Loading supplier data hub...</div>;
  }

  if (!details) {
    return (
      <div className="p-8 text-center text-xs text-text-muted space-y-4">
        <AlertCircle className="mx-auto text-rose-500" size={32} />
        <p>Supplier record not found.</p>
        <button onClick={onBack} className="text-accent underline font-bold">
          Go Back
        </button>
      </div>
    );
  }

  // Handle Contact Submit
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;
    try {
      await addContactMutation.mutateAsync({
        supplierId,
        contact: {
          contact_name: contactName.trim(),
          phone: contactPhone.trim() || null,
          email: contactEmail.trim() || null,
          role: contactRole.trim() || null,
        },
      });
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactRole('');
      setShowAddContact(false);
      refetchDetails();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Address Submit
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrLine1.trim()) return;
    try {
      await addAddressMutation.mutateAsync({
        supplierId,
        address: {
          address_type: addrType,
          address_line1: addrLine1.trim(),
          address_line2: addrLine2.trim() || null,
          city: addrCity.trim() || null,
          state: addrState.trim() || null,
          pincode: addrPincode.trim() || null,
        },
      });
      setAddrLine1('');
      setAddrLine2('');
      setAddrCity('');
      setAddrState('');
      setAddrPincode('');
      setShowAddAddr(false);
      refetchDetails();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Bank Submit
  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !bankAccNum.trim() || !bankIfsc.trim()) return;
    try {
      await addBankMutation.mutateAsync({
        supplierId,
        account: {
          bank_name: bankName.trim(),
          account_number: bankAccNum.trim(),
          ifsc_code: bankIfsc.trim(),
          account_holder_name: bankHolder.trim(),
          upi_id: bankUpi.trim() || null,
        },
      });
      setBankName('');
      setBankAccNum('');
      setBankIfsc('');
      setBankHolder('');
      setBankUpi('');
      setShowAddBank(false);
      refetchDetails();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Payment Terms Submit
  const handleSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertTermsMutation.mutateAsync({
        supplierId,
        terms: {
          payment_terms_days: termsDays ? parseInt(termsDays) : 0,
          grace_period_days: graceDays ? parseInt(graceDays) : 0,
        },
      });
      setShowEditTerms(false);
      refetchDetails();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Ledger Adjustment Submit
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjError('');
    setAdjSuccess(false);

    if (!adjAmount || parseFloat(adjAmount) <= 0) {
      setAdjError('Please enter a positive adjustment amount');
      return;
    }
    if (!adjDesc.trim()) {
      setAdjError('Auditor description note is mandatory');
      return;
    }

    try {
      await recordAdjustmentMutation.mutateAsync({
        supplierId,
        amountPaise: Math.round(parseFloat(adjAmount) * 100),
        type: adjType,
        description: adjDesc.trim(),
      });
      setAdjSuccess(true);
      setAdjAmount('');
      setAdjDesc('');
      setShowAdjustmentForm(false);
      refetchDetails();
      refetchLedger();
    } catch (err: any) {
      setAdjError(err.message || 'Failed to apply adjustment');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-6">
      {/* Detail Header Summary card */}
      <div className="bg-surface-panel rounded-2xl border border-border-subtle p-6 shadow-sm flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={onBack}
              className="p-2 bg-surface-card hover:bg-surface-hover border border-border-subtle rounded-xl text-xs font-bold text-text-muted hover:text-text-primary transition-all shrink-0"
            >
              ← Back
            </button>

            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
              <User size={24} className="text-brand-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-outfit text-text-primary">
                  {(details as any).display_name || details.company_name}
                </h2>
                {details.is_preferred === 1 && (
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full">
                    ★ Preferred Vendor
                  </span>
                )}
                <span className="bg-surface-card border border-border-subtle text-text-muted text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full font-mono">
                  {details.code}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1 font-medium flex items-center gap-3 flex-wrap">
                <span>Company: <strong className="text-text-primary">{details.company_name}</strong></span>
                <span>Contact: <strong className="text-text-primary">{(details as any).salutation || ''} {(details as any).first_name || ''} {(details as any).last_name || details.owner_name || ''}</strong></span>
                {details.email && <span>Email: <strong className="text-text-primary">{details.email}</strong></span>}
                {(details.phone || (details as any).mobile_phone) && (
                  <span>Phone: <strong className="text-text-primary">{details.phone || (details as any).mobile_phone}</strong></span>
                )}
              </p>
            </div>
          </div>

          {/* Record Payment Button */}
          <button
            onClick={() => setShowPaymentDialog(true)}
            className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all shrink-0"
          >
            <CreditCard size={16} /> Record Payment 💳
          </button>
        </div>

        {/* Extended Vendor Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface-card border border-border-subtle rounded-xl p-4 shadow-sm">
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Outstanding Balance</span>
            <p className={`text-base font-bold font-mono mt-0.5 ${details.outstanding_balance_paise > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {formatPaise(details.outstanding_balance_paise)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Credit Limit</span>
            <p className="text-base font-bold font-mono text-text-primary mt-0.5">
              {formatPaise(details.credit_limit_paise)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Payment Terms</span>
            <p className="text-xs font-bold text-brand-400 mt-1">
              {(details as any).payment_terms || 'NET 30'}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-text-muted">Bank Payout Info</span>
            <p className="text-xs font-medium text-text-primary mt-1 truncate">
              {(details as any).bank_name ? `${(details as any).bank_name} (${(details as any).account_number || ''})` : 'Not Configured'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface-panel rounded-xl border border-border-subtle overflow-hidden">
        {/* Navigation Tab list */}
        <div className="flex bg-surface-app/40 border-b border-border-subtle p-1 gap-1">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'overview'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Overview & Terms
          </button>
          <button
            onClick={() => setActiveSubTab('contacts')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'contacts'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Contacts & Locations
          </button>
          <button
            onClick={() => setActiveSubTab('ledger')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'ledger'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Ledger & Auditing
          </button>
          <button
            onClick={() => setActiveSubTab('statement')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeSubTab === 'statement'
                ? 'bg-surface-card border border-border-subtle text-text-secondary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Account Statement
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: OVERVIEW */}
          {activeSubTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Profile Details column */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-4 space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5 border-b border-border-subtle pb-2">
                    <Briefcase size={12} /> Supplier Master Identity
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">Company Name</span>
                      <p className="text-text-secondary font-bold mt-0.5">{details.company_name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">Primary Email</span>
                      <p className="text-text-secondary font-semibold font-mono mt-0.5">{details.email || 'None logged'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">PAN ID</span>
                      <p className="text-text-secondary font-mono font-semibold mt-0.5 uppercase">{details.pan || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">GSTIN Registration</span>
                      <p className="text-text-secondary font-mono font-bold mt-0.5 uppercase text-accent">{details.gstin || 'Unregistered / None'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">Preferred Payment Mode</span>
                      <p className="text-text-secondary font-bold mt-0.5 uppercase text-xs">{details.preferred_payment_method?.replace('_', ' ') || 'None Selected'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted uppercase">Opening Balance Details</span>
                      <p className="text-text-muted font-semibold mt-0.5">
                        <span className="font-bold text-text-secondary font-mono">{formatPaise(details.opening_balance_paise)}</span> on {details.opening_balance_date ? formatDate(details.opening_balance_date) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes card */}
                <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-4 space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Internal Logistics Notes</h3>
                  <p className="text-xs text-text-secondary italic whitespace-pre-wrap leading-relaxed">
                    {details.notes || 'No custom logistics notes or agreements configured for this supplier profile.'}
                  </p>
                </div>
              </div>

              {/* Payment Terms Column */}
              <div className="space-y-4">
                <div className="bg-surface-app/30 border border-border-subtle rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                      <Clock size={12} /> Credit Terms
                    </h3>
                    <button
                      onClick={() => {
                        setTermsDays(String(details.paymentTerms?.payment_terms_days ?? ''));
                        setGraceDays(String(details.paymentTerms?.grace_period_days ?? ''));
                        setShowEditTerms(!showEditTerms);
                      }}
                      className="text-[10px] font-bold text-accent hover:underline"
                    >
                      {showEditTerms ? 'Close' : 'Configure'}
                    </button>
                  </div>

                  {!showEditTerms ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text-muted font-medium">Standard Due Cycle:</span>
                        <span className="font-bold text-text-secondary">{details.paymentTerms?.payment_terms_days ?? 0} Days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted font-medium">Overdue Grace Window:</span>
                        <span className="font-bold text-text-secondary">{details.paymentTerms?.grace_period_days ?? 0} Days</span>
                      </div>
                      <div className="p-3 bg-surface-app border border-border-subtle rounded-lg text-[10px] text-text-muted leading-normal">
                        Automatic alerts flag invoices that cross { (details.paymentTerms?.payment_terms_days ?? 0) + (details.paymentTerms?.grace_period_days ?? 0) } days as overdue.
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTerms} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-text-muted">Standard Due (Days)</label>
                        <input
                          type="number"
                          value={termsDays}
                          onChange={e => setTermsDays(e.target.value)}
                          className="w-full px-2.5 py-1 bg-surface-app border border-border-subtle text-text-secondary text-xs rounded font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase font-bold text-text-muted">Grace period (Days)</label>
                        <input
                          type="number"
                          value={graceDays}
                          onChange={e => setGraceDays(e.target.value)}
                          className="w-full px-2.5 py-1 bg-surface-app border border-border-subtle text-text-secondary text-xs rounded font-mono"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={upsertTermsMutation.isPending}
                        className="w-full py-1.5 bg-accent text-white rounded text-xs font-bold hover:bg-accent/90"
                      >
                        {upsertTermsMutation.isPending ? 'Saving...' : 'Save Terms'}
                      </button>
                    </form>
                  )}
                </div>

                {/* Operations tools */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPaymentDialog(true)}
                    className="w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                  >
                    <DollarSign size={14} /> Record Payment / Advance
                  </button>
                  <button
                    onClick={() => setShowAdjustmentForm(!showAdjustmentForm)}
                    className="w-full py-2.5 bg-surface-card hover:bg-surface-app border border-border-subtle text-text-secondary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                  >
                    <PlusCircle size={14} /> Record Balance Audit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTS & LOCATIONS */}
          {activeSubTab === 'contacts' && (
            <div className="space-y-6">
              {/* Contacts Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <User size={14} /> Contacts Directory
                  </h3>
                  <button
                    onClick={() => setShowAddContact(!showAddContact)}
                    className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={10} /> Add Contact
                  </button>
                </div>

                {showAddContact && (
                  <form onSubmit={handleAddContact} className="p-4 bg-surface-app border border-border-subtle rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Name *"
                      required
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={contactPhone}
                      onChange={e => setContactPhone(e.target.value)}
                      className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Role (e.g. Dispatch)"
                        value={contactRole}
                        onChange={e => setContactRole(e.target.value)}
                        className="flex-1 px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      />
                      <button type="submit" className="bg-accent text-white font-bold text-xs px-3 rounded hover:bg-accent/90">Add</button>
                    </div>
                  </form>
                )}

                {details.contacts.length === 0 ? (
                  <p className="text-[10px] text-text-muted italic">No contacts added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {details.contacts.map(c => (
                      <div key={c.id} className="bg-surface-app/40 border border-border-subtle rounded-xl p-3 flex items-start justify-between gap-2 shadow-sm">
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-text-secondary">{c.contact_name}</p>
                          {c.role && <p className="text-[9px] uppercase font-bold text-accent">{c.role}</p>}
                          {c.phone && <p className="text-[10px] text-text-secondary font-mono flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                          {c.email && <p className="text-[10px] text-text-muted font-mono flex items-center gap-1"><Mail size={10} /> {c.email}</p>}
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Delete contact?')) {
                              await removeContactMutation.mutateAsync(c.id);
                              refetchDetails();
                            }
                          }}
                          className="text-text-muted hover:text-rose-400 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Addresses List */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <MapPin size={14} /> Addresses & Dispatch Points
                  </h3>
                  <button
                    onClick={() => setShowAddAddr(!showAddAddr)}
                    className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={10} /> Add Address
                  </button>
                </div>

                {showAddAddr && (
                  <form onSubmit={handleAddAddress} className="p-4 bg-surface-app border border-border-subtle rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] uppercase font-bold text-text-muted">Type</label>
                        <select
                          value={addrType}
                          onChange={e => setAddrType(e.target.value as any)}
                          className="w-full px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                        >
                          <option value="billing">Billing Address</option>
                          <option value="shipping">Shipping Origin</option>
                          <option value="warehouse">Warehouse</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[9px] uppercase font-bold text-text-muted">Address Line 1 *</label>
                        <input
                          type="text"
                          required
                          value={addrLine1}
                          onChange={e => setAddrLine1(e.target.value)}
                          className="w-full px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Line 2"
                        value={addrLine2}
                        onChange={e => setAddrLine2(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      />
                      <input
                        type="text"
                        placeholder="City"
                        value={addrCity}
                        onChange={e => setAddrCity(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={addrState}
                        onChange={e => setAddrState(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Pincode"
                          value={addrPincode}
                          onChange={e => setAddrPincode(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                        />
                        <button type="submit" className="bg-accent text-white font-bold text-xs px-3 rounded hover:bg-accent/90">Add</button>
                      </div>
                    </div>
                  </form>
                )}

                {details.addresses.length === 0 ? (
                  <p className="text-[10px] text-text-muted italic">No addresses added yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {details.addresses.map(a => (
                      <div key={a.id} className="bg-surface-app/40 border border-border-subtle rounded-xl p-3.5 flex items-start justify-between gap-3 shadow-sm">
                        <div className="space-y-1">
                          <span className="bg-surface-app border border-border-subtle text-text-secondary text-[8px] uppercase font-bold px-1.5 py-0.5 rounded">
                            {a.address_type}
                          </span>
                          <p className="text-xs font-semibold text-text-secondary mt-1">{a.address_line1}</p>
                          {a.address_line2 && <p className="text-xs text-text-muted">{a.address_line2}</p>}
                          <p className="text-[11px] text-text-secondary font-medium">
                            {a.city ? a.city + ', ' : ''}{a.state ? a.state : ''} {a.pincode ? '(' + a.pincode + ')' : ''}
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Delete address?')) {
                              await removeAddressMutation.mutateAsync(a.id);
                              refetchDetails();
                            }
                          }}
                          className="text-text-muted hover:text-rose-400 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bank Accounts Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                    <CreditCard size={14} /> Bank & Payment Details
                  </h3>
                  <button
                    onClick={() => setShowAddBank(!showAddBank)}
                    className="text-[10px] font-bold text-accent hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={10} /> Add Account
                  </button>
                </div>

                {showAddBank && (
                  <form onSubmit={handleAddBank} className="p-4 bg-surface-app border border-border-subtle rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Bank Name *"
                        required
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Account Number *"
                        required
                        value={bankAccNum}
                        onChange={e => setBankAccNum(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                      />
                      <input
                        type="text"
                        placeholder="IFSC Code *"
                        required
                        value={bankIfsc}
                        onChange={e => setBankIfsc(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono uppercase"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Beneficiary Name"
                        value={bankHolder}
                        onChange={e => setBankHolder(e.target.value)}
                        className="px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="UPI ID (e.g. upi@okbank)"
                          value={bankUpi}
                          onChange={e => setBankUpi(e.target.value)}
                          className="flex-1 px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                        />
                        <button type="submit" className="bg-accent text-white font-bold text-xs px-3 rounded hover:bg-accent/90">Add</button>
                      </div>
                    </div>
                  </form>
                )}

                {details.bankAccounts.length === 0 ? (
                  <p className="text-[10px] text-text-muted italic">No bank accounts registered.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {details.bankAccounts.map(b => (
                      <div key={b.id} className="bg-surface-app/40 border border-border-subtle rounded-xl p-3.5 flex items-start justify-between gap-2 shadow-sm">
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs font-bold text-text-secondary">{b.bank_name}</p>
                          <p className="text-[11px] text-text-secondary/80 font-mono font-medium truncate">A/C: {b.account_number}</p>
                          <p className="text-[10px] text-text-muted font-mono font-semibold">IFSC: {b.ifsc_code}</p>
                          <p className="text-[10px] text-text-muted truncate">Name: {b.account_holder_name}</p>
                          {b.upi_id && (
                            <p className="text-[10px] text-accent font-semibold font-mono truncate mt-1">UPI: {b.upi_id}</p>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm('Delete bank account?')) {
                              await removeBankMutation.mutateAsync(b.id);
                              refetchDetails();
                            }
                          }}
                          className="text-text-muted hover:text-rose-400 p-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LEDGER HISTORY */}
          {activeSubTab === 'ledger' && (
            <div className="space-y-6">
              {/* Balance Audit inline form */}
              {showAdjustmentForm && (
                <div className="p-4 bg-surface-app border border-border-subtle rounded-xl space-y-4 animate-in slide-in-from-top duration-200">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1">
                    Record Balance Adjustment / Audit
                  </h3>
                  {adjError && <p className="text-[10px] text-rose-400 font-semibold">{adjError}</p>}
                  {adjSuccess && <p className="text-[10px] text-accent font-semibold">Adjustment applied successfully!</p>}
                  <form onSubmit={handleAdjustmentSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-text-muted">Type</label>
                      <select
                        value={adjType}
                        onChange={e => setAdjType(e.target.value as any)}
                        className="w-full px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none"
                      >
                        <option value="credit">Credit (Owe MORE balance)</option>
                        <option value="debit">Debit (Owe LESS balance)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-text-muted">Amount (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={adjAmount}
                        onChange={e => setAdjAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                      />
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                      <div className="flex-1">
                        <label className="text-[9px] uppercase font-bold text-text-muted">Auditor Explanation *</label>
                        <input
                          type="text"
                          required
                          value={adjDesc}
                          onChange={e => setAdjDesc(e.target.value)}
                          placeholder="e.g. Audit reconciliation for invoice load"
                          className="w-full px-2.5 py-1 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-semibold"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={recordAdjustmentMutation.isPending}
                        className="bg-accent text-white font-bold text-xs px-3 rounded hover:bg-accent/90 self-end h-[28px]"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Ledger Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Supplier General Ledger History
                </h3>

                {isLoadingLedger ? (
                  <p className="text-xs text-text-muted py-8 text-center">Loading ledger history...</p>
                ) : ledger?.length === 0 ? (
                  <p className="text-xs text-text-muted py-8 text-center italic">No ledger transaction entries logged yet.</p>
                ) : (
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                          <th className="p-3">Entry Date</th>
                          <th className="p-3">Ref Type</th>
                          <th className="p-3">Ref ID</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Debit (Reduce Balance)</th>
                          <th className="p-3 text-right">Credit (Increase Balance)</th>
                          <th className="p-3 text-right">Running Balance</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                        {ledger?.map(entry => (
                          <tr key={entry.id} className="hover:bg-surface-app/40 transition-colors">
                            <td className="p-3 text-text-muted font-mono font-medium">{formatDate(entry.entry_date)}</td>
                            <td className="p-3 uppercase text-[9px] font-bold text-text-muted">
                              <span className="bg-surface-app border border-border-subtle rounded px-1 py-0.5">
                                {entry.ref_type.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-text-muted font-bold">
                              {entry.ref_id ? `#${entry.ref_id}` : '-'}
                            </td>
                            <td className="p-3 text-text-secondary/80 max-w-[200px] truncate">{entry.description}</td>
                            <td className="p-3 text-right font-mono font-bold text-brand-500">
                              {entry.debit_paise > 0 ? formatPaise(entry.debit_paise) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-rose-400">
                              {entry.credit_paise > 0 ? formatPaise(entry.credit_paise) : '-'}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-text-secondary">
                              {formatPaise(entry.running_balance_paise)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STATEMENT GENERATOR */}
          {activeSubTab === 'statement' && (
            <div className="space-y-6">
              {/* Date Filters bar */}
              <div className="bg-surface-app/40 border border-border-subtle p-4 rounded-xl flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-text-muted">Start Date</label>
                  <input
                    type="date"
                    value={stmtStart}
                    onChange={e => setStmtStart(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-text-muted">End Date</label>
                  <input
                    type="date"
                    value={stmtEnd}
                    onChange={e => setStmtEnd(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface-panel border border-border-subtle text-xs text-text-secondary rounded outline-none font-mono"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => refetchStatement()}
                    className="px-4 py-1.5 bg-surface-card hover:bg-surface-app border border-border-subtle text-text-secondary text-xs font-bold rounded-lg"
                  >
                    Load Statement
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                  >
                    <Printer size={13} /> Print Statement
                  </button>
                </div>
              </div>

              {/* Statement Report details */}
              {statement && (
                <div className="space-y-6">
                  {/* Summary row cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3.5 shadow-sm text-center">
                      <span className="text-[9px] uppercase font-bold text-text-muted">Opening Balance</span>
                      <p className="text-sm font-bold font-mono text-text-secondary mt-1">
                        {formatPaise(statement.openingBalancePaise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3.5 shadow-sm text-center">
                      <span className="text-[9px] uppercase font-bold text-text-muted">Total Debits</span>
                      <p className="text-sm font-bold font-mono text-brand-500 mt-1">
                        {formatPaise(statement.totalDebitPaise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3.5 shadow-sm text-center">
                      <span className="text-[9px] uppercase font-bold text-text-muted">Total Credits</span>
                      <p className="text-sm font-bold font-mono text-rose-400 mt-1">
                        {formatPaise(statement.totalCreditPaise)}
                      </p>
                    </div>
                    <div className="bg-surface-app/20 border border-border-subtle rounded-xl p-3.5 shadow-sm text-center border-l-2 border-l-accent">
                      <span className="text-[9px] uppercase font-bold text-text-muted">Closing Balance</span>
                      <p className="text-sm font-bold font-mono text-text-secondary mt-1">
                        {formatPaise(statement.closingBalancePaise)}
                      </p>
                    </div>
                  </div>

                  {/* Statements entries list */}
                  <div className="border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface-app text-[9px] font-bold uppercase text-text-muted border-b border-border-subtle">
                          <th className="p-3">Entry Date</th>
                          <th className="p-3">Ref Type</th>
                          <th className="p-3">Ref ID</th>
                          <th className="p-3">Description</th>
                          <th className="p-3 text-right">Debit (Payments/Adj)</th>
                          <th className="p-3 text-right">Credit (Invoices/Adj)</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs font-medium divide-y divide-border-subtle/50">
                        {statement.entries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center text-text-muted italic">
                              No transactions logged within date range.
                            </td>
                          </tr>
                        ) : (
                          statement.entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-surface-app/40 transition-colors">
                              <td className="p-3 text-text-muted font-mono font-medium">{formatDate(entry.entry_date)}</td>
                              <td className="p-3 uppercase text-[9px] font-bold text-text-muted">
                                <span className="bg-surface-app border border-border-subtle rounded px-1.5 py-0.5">
                                  {entry.ref_type.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="p-3 font-mono text-text-muted font-bold">
                                {entry.ref_id ? `#${entry.ref_id}` : '-'}
                              </td>
                              <td className="p-3 text-text-secondary/80 max-w-[250px] truncate">{entry.description}</td>
                              <td className="p-3 text-right font-mono font-bold text-brand-500">
                                {entry.debit_paise > 0 ? formatPaise(entry.debit_paise) : '-'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-rose-400">
                                {entry.credit_paise > 0 ? formatPaise(entry.credit_paise) : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment dialog overlay */}
      {showPaymentDialog && (
        <SupplierPaymentDialog
          supplierId={details.id}
          supplierName={details.company_name}
          outstandingBalancePaise={details.outstanding_balance_paise}
          onClose={() => setShowPaymentDialog(false)}
          onSuccess={() => {
            refetchDetails();
            refetchLedger();
            refetchStatement();
          }}
        />
      )}
    </div>
  );
}


