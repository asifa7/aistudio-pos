import React from 'react';
import { Banknote, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { SettingCard } from '../ui/SettingCard';
import { SettingRow } from '../ui/SettingRow';
import { SwitchControl } from '../ui/SwitchControl';
import { NumberStepper } from '../ui/NumberStepper';
import { DenominationToggles } from '../ui/DenominationToggles';
import { useSettingsDraftStore } from '../../hooks/useSettingsDraftStore';

export const CashBoxSettings: React.FC = () => {
  const { draftConfig, updateDraftConfig } = useSettingsDraftStore();
  const cash = draftConfig.cashbox;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Shift Protocol Card */}
      <SettingCard
        title="Cash Register & Shift Safeguards"
        description="Opening float, handover rules, and physical drawer reconciliation"
        icon={<Banknote size={16} />}
      >
        <SettingRow
          label="Enable Shift Management"
          description="Track cashier login sessions, drawer balances, and closing totals"
        >
          <SwitchControl
            checked={cash?.enableShifts ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: { ...(prev.cashbox || {}), enableShifts: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Require Opening Cash Count"
          description="Force cashier to declare opening cash float before ringing first bill"
        >
          <SwitchControl
            checked={cash?.requireOpeningCash ?? true}
            disabled={!cash?.enableShifts}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: { ...(prev.cashbox || {}), requireOpeningCash: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Require Physical Closing Denomination Count"
          description="Require cashier to enter notes and coins count when ending shift"
        >
          <SwitchControl
            checked={cash?.requireClosingCashCount ?? true}
            disabled={!cash?.enableShifts}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: { ...(prev.cashbox || {}), requireClosingCashCount: checked },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Active Cash Denominations"
          description="Denominations enabled in physical counter forms"
        >
          <DenominationToggles
            denominations={cash?.denominationsEnabled || [500, 200, 100, 50, 20, 10, 5, 2, 1]}
            onChange={(denoms) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: { ...(prev.cashbox || {}), denominationsEnabled: denoms },
              }))
            }
          />
        </SettingRow>
      </SettingCard>

      {/* Movement & Variance Limits */}
      <SettingCard
        title="Discrepancy Thresholds & Movements"
        description="Control manual cash drops, owner payouts, and variance warnings"
        icon={<ShieldAlert size={16} />}
      >
        <SettingRow
          label="Allow Mid-Shift Cash Deposit & Withdrawal"
          description="Allow recording petty expenses, vendor payouts, and cash drops"
        >
          <SwitchControl
            checked={cash?.allowWithdrawal ?? true}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: {
                  ...(prev.cashbox || {}),
                  allowWithdrawal: checked,
                  allowDeposit: checked,
                },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Discrepancy Warning Threshold (₹)"
          description="Alert manager if drawer shortage or excess exceeds this amount"
        >
          <NumberStepper
            value={(cash?.discrepancyThresholdPaise || 50000) / 100}
            min={0}
            max={50000}
            step={50}
            unit="₹"
            onChange={(val) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: { ...(prev.cashbox || {}), discrepancyThresholdPaise: val * 100 },
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label="Require Manager Approval for High Variance"
          description="Flag shifts exceeding discrepancy threshold for audit review"
        >
          <SwitchControl
            checked={cash?.managerApprovalRequired ?? false}
            onChange={(checked) =>
              updateDraftConfig((prev) => ({
                ...prev,
                cashbox: { ...(prev.cashbox || {}), managerApprovalRequired: checked },
              }))
            }
          />
        </SettingRow>
      </SettingCard>
    </div>
  );
};
