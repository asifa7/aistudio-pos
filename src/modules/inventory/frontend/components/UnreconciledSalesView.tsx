import { AlertTriangle, Clock } from 'lucide-react';
import { useOversoldRecords } from '../hooks/useInventory';

export default function UnreconciledSalesView() {
  const { data: records, isLoading } = useOversoldRecords();

  if (isLoading) {
    return <div className="p-6 text-sm text-text-muted text-center flex-1">Loading unreconciled sales...</div>;
  }

  if (!records || records.length === 0) {
    return (
      <div className="p-6 flex-1 flex flex-col items-center justify-center text-text-muted">
        <CheckCircle size={32} className="text-green-500 mb-2" />
        <p className="text-sm">No unreconciled sales.</p>
        <p className="text-xs mt-1">All stock records are perfectly balanced.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 bg-red-950/20 border-b border-red-900/30 flex items-start gap-3">
        <AlertTriangle className="text-brand-red shrink-0 mt-0.5" size={20} />
        <div>
          <h3 className="font-bold text-brand-red text-sm">Unreconciled Sales Action Required</h3>
          <p className="text-xs text-text-subtle mt-1">
            The following items were sold despite showing 0 stock in the system. 
            A manager authorized these sales. You must investigate and record an inward stock adjustment to reconcile the physical stock with the system.
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-surface-card border border-border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-hover/50 text-text-muted uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4 font-bold border-b border-border">Date & Time</th>
                <th className="py-3 px-4 font-bold border-b border-border">Item / Variant</th>
                <th className="py-3 px-4 font-bold border-b border-border text-right">Shortfall</th>
                <th className="py-3 px-4 font-bold border-b border-border">Manager</th>
                <th className="py-3 px-4 font-bold border-b border-border">Override Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="py-3 px-4 text-xs text-text-secondary whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-text-muted" />
                      {new Date(record.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm font-medium text-text-primary">{record.product_name}</p>
                    <p className="text-xs text-text-muted">{record.variant_name}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-sm font-bold font-mono text-brand-red">
                      {record.shortfall_grams ? `${(record.shortfall_grams / 1000).toFixed(3)} kg` : `${record.shortfall_units} pcs`}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-text-primary">
                    {record.manager_name}
                  </td>
                  <td className="py-3 px-4 text-xs text-text-secondary max-w-xs truncate" title={record.override_reason}>
                    {record.override_reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CheckCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
