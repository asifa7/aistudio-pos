import React from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { SwitchControl } from '../ui/SwitchControl';
import { NumberStepper } from '../ui/NumberStepper';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const ReturnsSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsDraftStore();
  const ret = draftConfig.returns;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Returns Policy Card */}
      <SettingCard
        title="Sales Return & Exchange Rules"
        description="Configure return period eligibility, reasons, and ledger adjustments"
        icon={<RotateCcw size={16} />}
      >
        <SettingRow
          label="Enable Customer Returns & Refunds"
          description="Allow cashiers to process item returns from invoice history"
        >
          <SwitchControl
            checked={ret?.returnsEnabled ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), returnsEnabled: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Return Window Period (Days)"
          description="Maximum days allowed from invoice issue date to accept returns"
        >
          <NumberStepper
            value={ret?.returnPeriodDays ?? 7}
            min={1}
            max={30}
            step={1}
            unit="days"
            disabled={!ret?.returnsEnabled}
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), returnPeriodDays: val },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Allow Partial Quantity Return"
          description="Customer can return a single line item without refunding whole bill"
        >
          <SwitchControl
            checked={ret?.allowPartialReturn ?? true}
            disabled={!ret?.returnsEnabled}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), allowPartialReturn: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Require Written Return Reason"
          description="Enforce selecting a reason (e.g. Quality Issue, Weight Variance, Wrong Item)"
        >
          <SwitchControl
            checked={ret?.requireReturnReason ?? true}
            disabled={!ret?.returnsEnabled}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), requireReturnReason: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Auto-Restock Returned Goods to Inventory"
          description="Automatically increment active stock ledger when refund is processed"
        >
          <SwitchControl
            checked={ret?.autoRestock ?? true}
            disabled={!ret?.returnsEnabled}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), autoRestock: checked },
              }))
            }
          />
        </SettingRow>
      </SettingCard>

      {/* Allowed Refund Modes */}
      <SettingCard
        title="Approved Refund Payout Modes"
        description="Payout channels permitted when issuing return refunds"
        icon={<ShieldCheck size={16} />}
      >
        <SettingRow
          label="Refund to Original Tender"
          description="Return funds through original payment method (Cash to Cash, UPI to UPI)"
        >
          <SwitchControl
            checked={ret?.refundToOriginal ?? true}
            disabled={!ret?.returnsEnabled}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), refundToOriginal: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Instant Cash Refund"
          description="Allow physical cash payout directly from current cash drawer"
        >
          <SwitchControl
            checked={ret?.cashRefund ?? true}
            disabled={!ret?.returnsEnabled}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), cashRefund: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Store Credit / Khata Adjustment"
          description="Credit the customer ledger account balance for future purchases"
        >
          <SwitchControl
            checked={ret?.storeCredit ?? true}
            disabled={!ret?.returnsEnabled}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                returns: { ...(prev.returns || {}), storeCredit: checked },
              }))
            }
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
