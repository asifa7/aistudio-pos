import React from 'react';
import { CreditCard, Banknote, Smartphone, SplitSquareVertical, CheckCircle2 } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { SwitchControl } from '../ui/SwitchControl';
import { SelectControl } from '../ui/SelectControl';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const PaymentSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsDraftStore();
  const pay = draftConfig.payments;
  const enabled = pay?.enabledMethods || ['cash', 'upi', 'card', 'split'];

  const toggleMethod = (method: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'credit' | 'split') => {
    let next: typeof enabled;
    if (enabled.includes(method)) {
      if (enabled.length <= 1) return; // Keep at least one
      next = enabled.filter((m) => m !== method);
    } else {
      next = [...enabled, method];
    }
    updateDraftConfig((prev) => ({
      ...prev,
      payments: { ...(prev.payments || {}), enabledMethods: next },
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Tender Channels Card */}
      <SettingCard
        title="Accepted Payment Methods"
        description="Enable or disable payment rails available during bill checkout"
        icon={<CreditCard size={16} />}
      >
        <SettingRow
          label="Cash Payment"
          description="Physical currency collection with change calculation"
        >
          <SwitchControl
            checked={enabled.includes('cash')}
            onChange={() => toggleMethod('cash')}
          />
        </SettingRow>

        <SettingRow
          label="UPI & QR Digital Payments"
          description="PhonePe, Google Pay, Paytm, and BHIM QR scan"
        >
          <SwitchControl
            checked={enabled.includes('upi')}
            onChange={() => toggleMethod('upi')}
          />
        </SettingRow>

        <SettingRow
          label="Debit & Credit Cards"
          description="POS card terminal swiping / chip insert"
        >
          <SwitchControl
            checked={enabled.includes('card')}
            onChange={() => toggleMethod('card')}
          />
        </SettingRow>

        <SettingRow
          label="Split Tender Checkout"
          description="Allow customers to pay across multiple modes (e.g. Part Cash + Part UPI)"
        >
          <SwitchControl
            checked={enabled.includes('split')}
            onChange={() => toggleMethod('split')}
          />
        </SettingRow>

        <SettingRow
          label="Customer Store Credit / Khata (A/R)"
          description="Allow approved wholesale/regular customers to buy on credit ledger"
        >
          <SwitchControl
            checked={enabled.includes('credit')}
            onChange={() => toggleMethod('credit')}
          />
        </SettingRow>
      </SettingCard>

      {/* Default Checkout Payment Mode */}
      <SettingCard
        title="Checkout Defaults"
        description="Standard tender mode focused on opening checkout"
        icon={<Banknote size={16} />}
      >
        <SettingRow
          label="Default Payment Mode"
          description="Pre-selected payment method on invoice creation"
        >
          <SelectControl
            value={pay?.defaultPaymentMethod || 'cash'}
            options={[
              { value: 'cash', label: 'Cash Tender' },
              { value: 'upi', label: 'UPI / QR Scan' },
              { value: 'card', label: 'Card Payment' },
              { value: 'split', label: 'Split Tender' },
              { value: 'credit', label: 'Customer Credit (A/R)' },
            ]}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                payments: { ...(prev.payments || {}), defaultPaymentMethod: val as any },
                billingSettings: { ...(prev.billingSettings || {}), defaultPaymentMethod: val as any },
              }))
            }
            className="w-72"
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
