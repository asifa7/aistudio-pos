import React, { useState, useEffect } from 'react';
import { X, Save, Shield, MapPin, ClipboardList, Info, MoreHorizontal } from 'lucide-react';
import { useCreateCustomer, useUpdateCustomer, useCustomerGroups } from '../hooks/useCustomers';
import type { Customer, CustomerCategory, PriceTier, PaymentMethodType } from '../types/customer.types';

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

type Tab = 'basic' | 'extra' | 'address' | 'credit' | 'notes';

export default function CustomerForm({ isOpen, onClose, customer = null }: CustomerFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  // Address
  const [billingLine1, setBillingLine1] = useState('');
  const [billingLine2, setBillingLine2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPincode, setBillingPincode] = useState('');
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingLine2, setShippingLine2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPincode, setShippingPincode] = useState('');

  // Classification & Credit
  const [category, setCategory] = useState<CustomerCategory>('Retail');
  const [groupId, setGroupId] = useState<string>('');
  const [creditAllowed, setCreditAllowed] = useState(false);
  const [creditLimitRupees, setCreditLimitRupees] = useState('0');
  const [openingBalanceRupees, setOpeningBalanceRupees] = useState('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState('');
  const [priceTier, setPriceTier] = useState<PriceTier>('standard');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [prefPayment, setPrefPayment] = useState<PaymentMethodType>('cash');
  const [prefDeliveryTime, setPrefDeliveryTime] = useState('');

  // Notes
  const [notes, setNotes] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Mutations
  const { data: groups } = useCustomerGroups();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setBusinessName(customer.business_name || '');
      setGstin(customer.gstin || '');
      setPan(customer.pan || '');
      setPhone(customer.phone || '');
      setPhone2(customer.phone2 || '');
      setWhatsapp(customer.whatsapp || '');
      setEmail(customer.email || '');

      setBillingLine1(customer.billing_address_line1 || '');
      setBillingLine2(customer.billing_address_line2 || '');
      setBillingCity(customer.billing_city || '');
      setBillingState(customer.billing_state || '');
      setBillingPincode(customer.billing_pincode || '');

      const isSame =
        customer.billing_address_line1 === customer.shipping_address_line1 &&
        customer.billing_city === customer.shipping_city &&
        customer.billing_pincode === customer.shipping_pincode;

      setShippingSameAsBilling(isSame);
      setShippingLine1(customer.shipping_address_line1 || '');
      setShippingLine2(customer.shipping_address_line2 || '');
      setShippingCity(customer.shipping_city || '');
      setShippingState(customer.shipping_state || '');
      setShippingPincode(customer.shipping_pincode || '');

      setCategory(customer.category);
      setGroupId(customer.group_id ? String(customer.group_id) : '');
      setCreditAllowed(customer.credit_allowed === 1);
      setCreditLimitRupees(String(customer.credit_limit_paise / 100));
      setOpeningBalanceRupees(String(customer.opening_balance_paise / 100));
      setOpeningBalanceDate(customer.opening_balance_date || '');
      setPriceTier(customer.price_tier as PriceTier);
      setDiscountPercent(String(customer.discount_percent));
      setPrefPayment(customer.preferred_payment_method as PaymentMethodType);
      setPrefDeliveryTime(customer.preferred_delivery_time || '');
      setNotes(customer.notes || '');
      setDeliveryNotes(customer.delivery_notes || '');
    } else {
      // Clear form
      setName('');
      setBusinessName('');
      setGstin('');
      setPan('');
      setPhone('');
      setPhone2('');
      setWhatsapp('');
      setEmail('');
      setBillingLine1('');
      setBillingLine2('');
      setBillingCity('');
      setBillingState('');
      setBillingPincode('');
      setShippingSameAsBilling(true);
      setShippingLine1('');
      setShippingLine2('');
      setShippingCity('');
      setShippingState('');
      setShippingPincode('');
      setCategory('Retail');
      setGroupId('');
      setCreditAllowed(false);
      setCreditLimitRupees('0');
      setOpeningBalanceRupees('0');
      setOpeningBalanceDate('');
      setPriceTier('standard');
      setDiscountPercent('0');
      setPrefPayment('cash');
      setPrefDeliveryTime('');
      setNotes('');
      setDeliveryNotes('');
    }
    setErrors({});
    setActiveTab('basic');
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const sanitizeCustomerPayload = (raw: Record<string, any>) => {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        sanitized[key] = trimmed === '' ? null : trimmed;
      } else if (key === 'credit_allowed' || key === 'allow_face_recognition') {
        sanitized[key] = Boolean(val);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Customer name is required';
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      errs.gstin = 'GSTIN format is invalid (e.g. 22AAAAA1111A1Z1)';
    }
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      errs.pan = 'PAN format is invalid (e.g. ABCDE1234F)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const billingPayload = {
      billing_address_line1: billingLine1,
      billing_address_line2: billingLine2,
      billing_city: billingCity,
      billing_state: billingState,
      billing_pincode: billingPincode,
    };
    const shippingPayload = shippingSameAsBilling
      ? {
          shipping_address_line1: billingLine1,
          shipping_address_line2: billingLine2,
          shipping_city: billingCity,
          shipping_state: billingState,
          shipping_pincode: billingPincode,
        }
      : {
          shipping_address_line1: shippingLine1,
          shipping_address_line2: shippingLine2,
          shipping_city: shippingCity,
          shipping_state: shippingState,
          shipping_pincode: shippingPincode,
        };

    const rawPayload = {
      name,
      business_name: businessName,
      gstin,
      pan,
      phone,
      phone2,
      whatsapp,
      email,
      ...billingPayload,
      ...shippingPayload,
      category,
      group_id: groupId ? Number(groupId) : null,
      credit_allowed: creditAllowed,
      credit_limit_paise: Math.round(parseFloat(creditLimitRupees || '0') * 100),
      opening_balance_paise: Math.round(parseFloat(openingBalanceRupees || '0') * 100),
      opening_balance_date: openingBalanceDate,
      preferred_payment_method: prefPayment,
      preferred_delivery_time: prefDeliveryTime,
      price_tier: priceTier,
      discount_percent: parseFloat(discountPercent || '0'),
      notes,
      delivery_notes: deliveryNotes,
    };

    const payload = sanitizeCustomerPayload(rawPayload);

    try {
      if (customer) {
        await updateCustomer.mutateAsync({ id: customer.id, fields: payload });
      } else {
        await createCustomer.mutateAsync(payload);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrors({ api: err.message || 'Saving failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-xs text-text-secondary select-none">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">
            {customer ? `Edit Customer — ${customer.customer_code}` : 'Add New Customer'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-app/40 rounded-full text-text-secondary hover:text-text-primary transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-border-subtle bg-surface-app/40">
          {[
            { id: 'basic', label: 'Basic Info', icon: <Info size={14} /> },
            { id: 'extra', label: 'Extra Details', icon: <MoreHorizontal size={14} /> },
            { id: 'address', label: 'Addresses', icon: <MapPin size={14} /> },
            { id: 'credit', label: 'Credit Terms', icon: <Shield size={14} /> },
            { id: 'notes', label: 'Notes & Terms', icon: <ClipboardList size={14} /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as Tab)}
              className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 font-semibold transition-colors ${
                activeTab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-auto p-6 space-y-4">
          {errors.api && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 font-medium">
              {errors.api}
            </div>
          )}

          {activeTab === 'basic' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-text-secondary mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full bg-surface-app border ${errors.name ? 'border-red-500' : 'border-border-subtle'} rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent`}
                  placeholder="e.g. John Doe"
                  required
                />
                {errors.name && <span className="text-red-400 text-[10px] mt-1">{errors.name}</span>}
              </div>

              <div className="col-span-2">
                <label className="block text-text-secondary mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full bg-surface-app border ${errors.phone ? 'border-red-500' : 'border-border-subtle'} rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent`}
                  placeholder="e.g. 9876543210 (Optional)"
                />
                {errors.phone && <span className="text-red-400 text-[10px] mt-1">{errors.phone}</span>}
              </div>
            </div>
          )}

          {activeTab === 'extra' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-text-secondary mb-1">Business/Enterprise Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                  placeholder="e.g. Grand Plaza Hotel"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CustomerCategory)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="Retail">Retail</option>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Catering">Catering</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Contract">Contract</option>
                </select>
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Customer Group</label>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">No Group</option>
                  {groups?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-text-secondary mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className={`w-full bg-surface-app border ${errors.gstin ? 'border-red-500' : 'border-border-subtle'} rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent`}
                  placeholder="e.g. 22AAAAA1111A1Z1"
                />
                {errors.gstin && <span className="text-red-400 text-[10px] mt-1">{errors.gstin}</span>}
              </div>

              <div>
                <label className="block text-text-secondary mb-1">PAN Number</label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value.toUpperCase())}
                  className={`w-full bg-surface-app border ${errors.pan ? 'border-red-500' : 'border-border-subtle'} rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent`}
                  placeholder="e.g. ABCDE1234F"
                />
                {errors.pan && <span className="text-red-400 text-[10px] mt-1">{errors.pan}</span>}
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Alternate Phone</label>
                <input
                  type="text"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1">WhatsApp No</label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-text-secondary mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {activeTab === 'address' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-text-primary text-xs border-b border-border-subtle pb-1">Billing Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-text-secondary mb-1">Address Line 1</label>
                  <input
                    type="text"
                    value={billingLine1}
                    onChange={(e) => setBillingLine1(e.target.value)}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-text-secondary mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={billingLine2}
                    onChange={(e) => setBillingLine2(e.target.value)}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">City</label>
                  <input
                    type="text"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">State</label>
                  <input
                    type="text"
                    value={billingState}
                    onChange={(e) => setBillingState(e.target.value)}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Pincode</label>
                  <input
                    type="text"
                    value={billingPincode}
                    onChange={(e) => setBillingPincode(e.target.value)}
                    className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="same-addr"
                  checked={shippingSameAsBilling}
                  onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                  className="rounded bg-surface-app border-border-subtle focus:ring-0 text-accent"
                />
                <label htmlFor="same-addr" className="text-text-primary text-xs cursor-pointer">
                  Shipping Address is same as Billing Address
                </label>
              </div>

              {!shippingSameAsBilling && (
                <div className="space-y-4 pt-2">
                  <h4 className="font-semibold text-text-primary text-xs border-b border-border-subtle pb-1">Shipping Address</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-text-secondary mb-1">Address Line 1</label>
                      <input
                        type="text"
                        value={shippingLine1}
                        onChange={(e) => setShippingLine1(e.target.value)}
                        className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-text-secondary mb-1">Address Line 2</label>
                      <input
                        type="text"
                        value={shippingLine2}
                        onChange={(e) => setShippingLine2(e.target.value)}
                        className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1">City</label>
                      <input
                        type="text"
                        value={shippingCity}
                        onChange={(e) => setShippingCity(e.target.value)}
                        className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1">State</label>
                      <input
                        type="text"
                        value={shippingState}
                        onChange={(e) => setShippingState(e.target.value)}
                        className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary mb-1">Pincode</label>
                      <input
                        type="text"
                        value={shippingPincode}
                        onChange={(e) => setShippingPincode(e.target.value)}
                        className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'credit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-surface-app/40 border border-border-subtle rounded-lg p-3">
                <div>
                  <p className="text-text-primary text-xs font-semibold">Enable Credit Sales</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">Allows the cashier to place orders on credit terms</p>
                </div>
                <input
                  type="checkbox"
                  checked={creditAllowed}
                  onChange={(e) => setCreditAllowed(e.target.checked)}
                  className="w-9 h-5 bg-surface-app rounded-full checked:bg-accent focus:ring-0 text-accent cursor-pointer"
                />
              </div>

              {creditAllowed && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-secondary mb-1">Credit Limit (₹)</label>
                    <input
                      type="number"
                      value={creditLimitRupees}
                      onChange={(e) => setCreditLimitRupees(e.target.value)}
                      className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary font-mono"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  {!customer && (
                    <>
                      <div>
                        <label className="block text-text-secondary mb-1">Opening Outstanding Balance (₹)</label>
                        <input
                          type="number"
                          value={openingBalanceRupees}
                          onChange={(e) => setOpeningBalanceRupees(e.target.value)}
                          className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary font-mono"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-text-secondary mb-1">Opening Balance Date</label>
                        <input
                          type="date"
                          value={openingBalanceDate}
                          onChange={(e) => setOpeningBalanceDate(e.target.value)}
                          className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                        />
                      </div>
                    </>
                  )}
                  
                  <div>
                    <label className="block text-text-secondary mb-1">Price Tier</label>
                    <select
                      value={priceTier}
                      onChange={(e) => setPriceTier(e.target.value as PriceTier)}
                      className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                    >
                      <option value="standard">Standard</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1">Discount %</label>
                    <input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary font-mono"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1">Preferred Payment Method</label>
                    <select
                      value={prefPayment}
                      onChange={(e) => setPrefPayment(e.target.value as PaymentMethodType)}
                      className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-text-primary"
                    >
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="credit">Credit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-text-secondary mb-1">Preferred Delivery Time</label>
                    <input
                      type="text"
                      value={prefDeliveryTime}
                      onChange={(e) => setPrefDeliveryTime(e.target.value)}
                      className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white"
                      placeholder="e.g. 8:00 AM - 10:00 AM"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary mb-1">General Remarks / Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white h-24 focus:outline-none focus:border-accent"
                  placeholder="Internal notes about the customer preferences..."
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Delivery Instructions / Notes</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full bg-surface-app border border-border-subtle rounded-lg px-3 py-2 text-white h-24 focus:outline-none focus:border-accent"
                  placeholder="Instructions for packaging or delivery boy..."
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle bg-surface-app flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border-subtle hover:border-white rounded-lg text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-2 bg-accent hover:bg-brand-500 rounded-lg text-white font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {isSubmitting ? 'Saving...' : 'Save Customer'}
          </button>
        </div>
      </div>
    </div>
  );
}
