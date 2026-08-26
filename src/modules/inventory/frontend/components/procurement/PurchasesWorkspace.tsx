import { useState } from 'react';
import { ShoppingCart, BookOpen, Truck } from 'lucide-react';
import QuickPurchaseEntry from './QuickPurchaseEntry';
import PassbookLedgerView from './PassbookLedgerView';
import { useQuickPurchaseStore } from '../../hooks/useQuickPurchaseStore';

export default function PurchasesWorkspace() {
  const [activeTab, setActiveTab] = useState<'quick' | 'passbook'>('quick');
  const hasUnsavedDraft = useQuickPurchaseStore(state => state.hasUnsavedDraft());

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-app text-text-primary">
      {/* Workspace Sub-Header Navigation */}
      <div className="bg-surface-panel border-b border-border-subtle px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Truck className="text-brand-500" size={20} />
          <h1 className="text-base font-bold font-outfit text-text-primary">Purchases Workspace</h1>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex items-center gap-1.5 bg-surface-app p-1 rounded-lg border border-border-subtle text-xs font-semibold">
          <button
            onClick={() => setActiveTab('quick')}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'quick'
                ? 'bg-brand-500 text-white shadow-sm font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <ShoppingCart size={14} />
            <span>Quick Purchase Entry</span>
            {hasUnsavedDraft && (
              <span className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 text-[9px] font-bold rounded border border-yellow-500/30 ml-1 shrink-0 animate-pulse">
                Draft
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('passbook')}
            className={`px-3.5 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
              activeTab === 'passbook'
                ? 'bg-brand-500 text-white shadow-sm font-bold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <BookOpen size={14} />
            <span>Passbook Ledger & History</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'quick' && <QuickPurchaseEntry />}
        {activeTab === 'passbook' && <PassbookLedgerView onSwitchToQuickTab={() => setActiveTab('quick')} />}
      </div>
    </div>
  );
}
