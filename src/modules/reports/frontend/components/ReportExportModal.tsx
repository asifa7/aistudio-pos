import React, { useState } from 'react';
import { X, Download, Printer, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import { ReportExportRequest, ReportQueryResult } from '../../types/reports.types';
import { useExportReport } from '../hooks/useReportEngine';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ReportQueryResult;
}

export default function ReportExportModal({
  isOpen,
  onClose,
  result
}: ReportExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [scope, setScope] = useState<'current_page' | 'all_data' | 'selected_rows'>('all_data');
  const exportMutation = useExportReport();

  if (!isOpen) return null;

  const handleExport = async () => {
    if (format === 'pdf') {
      window.print();
      onClose();
      return;
    }

    try {
      const exportReq: ReportExportRequest = {
        reportId: result.reportId,
        format,
        scope,
        filters: {
          startDate: result.filterSummary.startDate,
          endDate: result.filterSummary.endDate,
        },
      };

      const res = await exportMutation.mutateAsync(exportReq);
      if (res && res.content) {
        const blob = new Blob([res.content], { type: res.mimeType || 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.filename || `${result.reportId}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        onClose();
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl max-w-md w-full overflow-hidden text-xs select-none">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-surface-card/80">
          <div className="flex items-center gap-2">
            <Download size={18} className="text-brand-500" />
            <h3 className="text-sm font-bold text-text-primary">Export & Print Report</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-surface-hover rounded-full text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-surface-card">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-text-secondary uppercase">Export Format</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  format === 'csv'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'border-border-subtle bg-surface-panel text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileText size={20} />
                <span>CSV File</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  format === 'excel'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'border-border-subtle bg-surface-panel text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileSpreadsheet size={20} />
                <span>Excel (.csv)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  format === 'pdf'
                    ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'border-border-subtle bg-surface-panel text-text-secondary hover:text-text-primary'
                }`}
              >
                <Printer size={20} />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-text-secondary uppercase">Export Scope</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-border-subtle bg-surface-panel hover:bg-surface-hover cursor-pointer text-text-primary font-medium">
                <input
                  type="radio"
                  name="scope"
                  value="all_data"
                  checked={scope === 'all_data'}
                  onChange={() => setScope('all_data')}
                  className="text-brand-500 focus:ring-brand-500"
                />
                <div>
                  <span className="font-bold block">All Filtered Records ({result.totalRows} rows)</span>
                  <span className="text-[10px] text-text-muted">Exports all matching data without pagination</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-border-subtle bg-surface-panel hover:bg-surface-hover cursor-pointer text-text-primary font-medium">
                <input
                  type="radio"
                  name="scope"
                  value="current_page"
                  checked={scope === 'current_page'}
                  onChange={() => setScope('current_page')}
                  className="text-brand-500 focus:ring-brand-500"
                />
                <div>
                  <span className="font-bold block">Current Page Only ({result.rows.length} rows)</span>
                  <span className="text-[10px] text-text-muted">Exports only the rows currently visible on page {result.page}</span>
                </div>
              </label>
            </div>
          </div>

          {/* Info Card */}
          <div className="p-3 bg-surface-panel border border-border-subtle rounded-xl text-[11px] text-text-secondary space-y-1">
            <div className="flex justify-between">
              <span>Report:</span>
              <span className="font-bold text-text-primary">{result.reportName}</span>
            </div>
            <div className="flex justify-between">
              <span>Generated for:</span>
              <span className="font-bold text-text-primary">{result.shopInfo.name}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border-subtle hover:bg-surface-hover text-text-secondary font-bold text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {exportMutation.isPending ? (
                <span>Exporting...</span>
              ) : (
                <>
                  {format === 'pdf' ? <Printer size={14} /> : <Download size={14} />}
                  <span>{format === 'pdf' ? 'Print Preview' : 'Download File'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
