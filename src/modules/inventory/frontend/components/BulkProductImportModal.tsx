import React, { useState } from 'react';
import { X, Upload, Download, CheckCircle2, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import { exportToCSV } from '../../../../core/shared/csv_exporter';

interface BulkProductImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  rowNum: number;
  product_code: string;
  name: string;
  variant_name: string;
  unit_type: 'weight' | 'piece';
  category: string;
  price_rupees: number;
  cost_price_rupees: number;
  isUpdate: boolean;
  isValid: boolean;
  error?: string;
}

export default function BulkProductImportModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkProductImportModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const headers = ['Product Code', 'Product Name', 'Variant Name', 'Unit Type (weight/piece)', 'Category', 'Selling Price (INR)', 'Cost Price (INR)'];
    const sampleRows = [
      ['PRD-00001', 'Chicken Curry Cut', '1kg Pack', 'weight', 'Fresh Cuts', '240.00', '210.00'],
      ['', 'Fresh Mutton Bone-in', '500g Pack', 'weight', 'Mutton', '550.00', '480.00'],
    ];
    exportToCSV('product_import_template', headers, sampleRows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setResultMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length <= 1) {
          setErrorMsg('CSV file is empty or missing data rows');
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.replace(/^"(.*)"$/, '$1').trim());
          const code = cols[0] || '';
          const name = cols[1] || '';
          const variantName = cols[2] || 'Default';
          const unitTypeStr = (cols[3] || 'weight').toLowerCase();
          const category = cols[4] || 'Fresh Cuts';
          const priceRupees = parseFloat(cols[5] || '0');
          const costRupees = parseFloat(cols[6] || '0');

          let isValid = true;
          let rowError: string | undefined;

          if (!name) {
            isValid = false;
            rowError = 'Missing required Product Name';
          } else if (!category) {
            isValid = false;
            rowError = 'Missing required Category';
          } else if (isNaN(priceRupees) || priceRupees < 0) {
            isValid = false;
            rowError = 'Invalid Selling Price';
          }

          const unitType: 'weight' | 'piece' = unitTypeStr === 'piece' ? 'piece' : 'weight';

          rows.push({
            rowNum: i + 1,
            product_code: code,
            name,
            variant_name: variantName,
            unit_type: unitType,
            category,
            price_rupees: priceRupees,
            cost_price_rupees: costRupees,
            isUpdate: !!code,
            isValid,
            error: rowError,
          });
        }

        setParsedRows(rows);
      } catch (err: any) {
        setErrorMsg(`Failed to parse CSV file: ${err.message}`);
      }
    };

    reader.readAsText(file);
  };

  const handleCommitImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('No valid rows to import');
      return;
    }

    setIsImporting(true);
    setErrorMsg(null);

    try {
      const res = await window.api.invoke(IPC_CHANNELS.INVENTORY.BULK_IMPORT_PRODUCTS, { rows: validRows });
      if (!res.success) throw new Error(res.error.message);

      const { createdCount, updatedCount } = res.data;
      setResultMsg(`Successfully imported! Created ${createdCount} new product(s), updated ${updatedCount} existing product(s). Stock quantities were preserved.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-500">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="font-bold text-base text-text-primary">Bulk Import Product Master (CSV)</h2>
              <p className="text-xs text-text-muted">Import/update products. Stock quantities & active batches are strictly preserved.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="px-3.5 py-1.5 bg-surface-card border border-border-subtle hover:bg-surface-hover rounded-xl text-xs font-bold text-text-primary flex items-center gap-1.5"
            >
              <Download size={14} /> Download CSV Template
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-card text-text-muted hover:text-text-primary">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Upload & Preview */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {parsedRows.length === 0 ? (
            <div className="border-2 border-dashed border-border-subtle rounded-2xl p-10 text-center flex flex-col items-center justify-center bg-surface-app hover:border-brand-500/50 transition-colors">
              <Upload className="text-brand-500 mb-3" size={32} />
              <div className="text-sm font-bold text-text-primary">Select CSV File to Preview & Import</div>
              <div className="text-xs text-text-muted mt-1 mb-4">Accepts .csv files formatted per the standard Product Master template.</div>
              <label className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-brand-500/20">
                Choose CSV File
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Validation Summary Bar */}
              <div className="flex items-center justify-between p-3.5 bg-surface-app border border-border-subtle rounded-xl text-xs font-bold">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-mono">✓ {validCount} Valid Rows</span>
                  {invalidCount > 0 && <span className="text-rose-400 font-mono">✗ {invalidCount} Invalid Rows</span>}
                </div>
                <label className="text-brand-500 hover:underline cursor-pointer">
                  Change File
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {/* Row Validation Preview Table */}
              <div className="border border-border-subtle rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-card text-text-muted font-bold text-[11px] uppercase tracking-wider sticky top-0 border-b border-border-subtle">
                    <tr>
                      <th className="p-3">Row</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Variant</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-medium">
                    {parsedRows.map((r) => (
                      <tr key={r.rowNum} className={!r.isValid ? 'bg-rose-500/10' : 'hover:bg-surface-hover'}>
                        <td className="p-3 font-mono text-text-muted">#{r.rowNum}</td>
                        <td className="p-3 font-mono font-bold text-text-primary">{r.product_code || 'Auto-Gen'}</td>
                        <td className="p-3 font-bold text-text-primary">{r.name}</td>
                        <td className="p-3 text-text-secondary">{r.variant_name}</td>
                        <td className="p-3 text-text-secondary">{r.category}</td>
                        <td className="p-3 text-right font-mono font-bold text-brand-500">₹{r.price_rupees.toFixed(2)}</td>
                        <td className="p-3">
                          {r.isValid ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                              <CheckCircle2 size={11} /> {r.isUpdate ? 'Update' : 'New'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-extrabold flex items-center gap-1 w-fit">
                              <AlertCircle size={11} /> {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 font-semibold flex items-center gap-2">
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}
          {resultMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 size={15} /> {resultMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover">
            Cancel
          </button>
          {parsedRows.length > 0 && (
            <button
              onClick={handleCommitImport}
              disabled={isImporting || validCount === 0}
              className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-all shadow-lg shadow-brand-500/20 disabled:opacity-40 flex items-center gap-1.5"
            >
              {isImporting ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />}
              Import {validCount} Valid Row(s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
