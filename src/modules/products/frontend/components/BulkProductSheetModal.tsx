import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import {
  X, Save, AlertTriangle, FileSpreadsheet, Plus, RefreshCw, CheckCircle2,
  Download, Upload, Trash2, Check
} from 'lucide-react';
import { useBulkAddProducts } from '../hooks/useProductMutations';
import { useAdminProducts } from '../hooks/useProducts';
import { FIXED_CATEGORIES } from '../../types/products.types';

interface BulkProductSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PosProductRow {
  product_code: string;
  name: string;
  category: string;
  type: string;
  unit_type: 'weight' | 'piece' | 'live_dual';
  cost_rupees: string;
  price_rupees: string;
  track_inventory: boolean;
}

const DEFAULT_CATEGORIES = [...FIXED_CATEGORIES];
const DEFAULT_TYPES = ['Unprocessed (Raw)', 'Processed (Cut/Minced)'];
const DEFAULT_UNIT_TYPES = [
  { value: 'weight', label: '⚖ Weight (kg)' },
  { value: 'piece', label: '🔢 Piece / Unit' },
  { value: 'live_dual', label: '🐔 Live Dual' },
];

export default function BulkProductSheetModal({ isOpen, onClose }: BulkProductSheetModalProps) {
  const { data: existingProducts = [] } = useAdminProducts();
  const bulkAddMutation = useBulkAddProducts();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PosProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ createdCount: number; updatedCount: number; errorRows: any[] } | null>(null);

  // Initialize fresh rows on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setImportResult(null);

      // Compute starting bill number from existing catalogue
      let highestNum = 0;
      existingProducts.forEach(p => {
        if (p.product_code) {
          const num = parseInt(p.product_code.replace(/^PRD-0*/, ''), 10);
          if (!isNaN(num) && num > highestNum) highestNum = num;
        }
      });

      const initialRows: PosProductRow[] = Array(6).fill(null).map((_, i) => ({
        product_code: String(highestNum + i + 1),
        name: '',
        category: 'Chicken',
        type: 'Unprocessed (Raw)',
        unit_type: 'weight',
        cost_rupees: '',
        price_rupees: '',
        track_inventory: false,
      }));

      setRows(initialRows);
    }
  }, [isOpen, existingProducts]);

  if (!isOpen) return null;

  const updateCell = (rowIndex: number, key: keyof PosProductRow, value: any) => {
    setRows(prev => {
      const copy = [...prev];
      copy[rowIndex] = { ...copy[rowIndex], [key]: value };
      return copy;
    });
  };

  const addRow = (count: number = 1) => {
    setRows(prev => {
      let highestCode = 0;
      prev.forEach(r => {
        const num = parseInt(r.product_code, 10);
        if (!isNaN(num) && num > highestCode) highestCode = num;
      });
      if (highestCode === 0) highestCode = prev.length;

      const newRows: PosProductRow[] = [];
      for (let i = 1; i <= count; i++) {
        newRows.push({
          product_code: String(highestCode + i),
          name: '',
          category: prev[prev.length - 1]?.category || 'Chicken',
          type: 'Unprocessed (Raw)',
          unit_type: 'weight',
          cost_rupees: '',
          price_rupees: '',
          track_inventory: false,
        });
      }
      return [...prev, ...newRows];
    });
  };

  const removeRow = (index: number) => {
    setRows(prev => {
      if (prev.length <= 1) {
        return [{
          product_code: '1',
          name: '',
          category: 'Chicken',
          type: 'Unprocessed (Raw)',
          unit_type: 'weight',
          cost_rupees: '',
          price_rupees: '',
          track_inventory: false,
        }];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearEmptyRows = () => {
    setRows(prev => {
      const filtered = prev.filter(r => r.name.trim() || r.price_rupees.trim());
      if (filtered.length === 0) {
        return [{
          product_code: '1',
          name: '',
          category: 'Chicken',
          type: 'Unprocessed (Raw)',
          unit_type: 'weight',
          cost_rupees: '',
          price_rupees: '',
          track_inventory: false,
        }];
      }
      return filtered;
    });
  };

  const fillCategoryForAll = (category: string) => {
    setRows(prev => prev.map(r => ({ ...r, category })));
  };

  // Keyboard navigation across the grid
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>, rowIndex: number, colName: string) => {
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && colName === 'price_rupees')) {
      if (e.key === 'Enter') e.preventDefault();
      if (rowIndex === rows.length - 1) {
        addRow(1);
      }
    }
  };

  // Copy-paste from Excel or Google Sheets
  const handlePaste = (e: ClipboardEvent<HTMLTableElement>) => {
    const clipboardData = e.clipboardData.getData('Text');
    if (!clipboardData) return;
    e.preventDefault();

    const pastedLines = clipboardData.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (pastedLines.length === 0) return;

    const parsedData = pastedLines.map(line => line.split('\t').map(c => c.trim()));

    // If first row looks like a header, skip it
    let startIdx = 0;
    const firstRowJoined = parsedData[0].join(' ').toLowerCase();
    if (firstRowJoined.includes('product') || firstRowJoined.includes('name') || firstRowJoined.includes('item') || firstRowJoined.includes('rate') || firstRowJoined.includes('code')) {
      startIdx = 1;
    }

    const dataRows = parsedData.slice(startIdx);
    if (dataRows.length === 0) return;

    const newRows: PosProductRow[] = [];
    let curCodeNum = rows.length > 0 ? parseInt(rows[0].product_code, 10) || 1 : 1;

    dataRows.forEach((cols, idx) => {
      // Possible column mapping:
      // Pattern 1: [Bill No, Name, Category, Type, Unit Type, Selling Rate]
      // Pattern 2: [Name, Category, Selling Rate]
      // Pattern 3: [Name, Selling Rate]
      let code = '';
      let name = '';
      let category = 'Chicken';
      let type = 'Unprocessed (Raw)';
      let unit_type: 'weight' | 'piece' | 'live_dual' = 'weight';
      let price = '';

      if (cols.length === 1) {
        name = cols[0];
      } else if (cols.length === 2) {
        name = cols[0];
        price = cols[1].replace(/[^0-9.]/g, '');
      } else if (cols.length === 3) {
        name = cols[0];
        category = cols[1] || 'Chicken';
        price = cols[2].replace(/[^0-9.]/g, '');
      } else if (cols.length >= 4) {
        // Check if first col is numeric code
        if (/^\d+$/.test(cols[0])) {
          code = cols[0];
          name = cols[1];
          category = cols[2] || 'Chicken';
          price = cols[cols.length - 1].replace(/[^0-9.]/g, '');
          if (cols.length >= 5) {
            type = cols[3].toLowerCase().includes('process') ? 'Processed (Cut/Minced)' : 'Unprocessed (Raw)';
            if (cols.length >= 6) {
              const u = cols[4].toLowerCase();
              unit_type = u.includes('pc') || u.includes('piece') ? 'piece' : u.includes('dual') ? 'live_dual' : 'weight';
            }
          }
        } else {
          name = cols[0];
          category = cols[1] || 'Chicken';
          type = cols[2].toLowerCase().includes('process') ? 'Processed (Cut/Minced)' : 'Unprocessed (Raw)';
          price = cols[cols.length - 1].replace(/[^0-9.]/g, '');
        }
      }

      if (!code) {
        code = String(curCodeNum + idx);
      }

      newRows.push({
        product_code: code,
        name,
        category,
        type,
        unit_type,
        cost_rupees: '',
        price_rupees: price,
        track_inventory: false,
      });
    });

    if (newRows.length > 0) {
      setRows(newRows);
      setError(null);
    }
  };

  // Download Sample Excel/CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = [
      'Bill No,Product Name,Category,Type,Unit Type,Selling Rate (₹)',
      '101,Chicken Curry Cut,Chicken,Unprocessed (Raw),weight,280.00',
      '102,Chicken Boneless Breast,Chicken,Processed (Cut/Minced),weight,360.00',
      '103,Mutton Curry Cut,Mutton,Unprocessed (Raw),weight,740.00',
      '104,Fresh Tiger Prawns,Seafood,Unprocessed (Raw),weight,550.00',
      '105,Eggs Tray of 30,Eggs,Unprocessed (Raw),piece,180.00',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'POS_Bulk_Products_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload and Parse CSV File
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;

      // Detect separator (, or \t)
      const separator = lines[0].includes('\t') ? '\t' : ',';
      let startLine = 0;

      // Check header
      const header = lines[0].toLowerCase();
      if (header.includes('name') || header.includes('product') || header.includes('rate') || header.includes('code')) {
        startLine = 1;
      }

      const parsedRows: PosProductRow[] = [];
      for (let i = startLine; i < lines.length; i++) {
        const parts = lines[i].split(separator).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length < 2) continue;

        let code = '';
        let name = '';
        let category = 'Chicken';
        let type = 'Unprocessed (Raw)';
        let unit_type: 'weight' | 'piece' | 'live_dual' = 'weight';
        let price = '';

        if (/^\d+$/.test(parts[0])) {
          code = parts[0];
          name = parts[1] || '';
          category = parts[2] || 'Chicken';
          if (parts.length >= 4) type = parts[3].toLowerCase().includes('process') ? 'Processed (Cut/Minced)' : 'Unprocessed (Raw)';
          if (parts.length >= 5) {
            const u = parts[4].toLowerCase();
            unit_type = u.includes('pc') || u.includes('piece') ? 'piece' : u.includes('dual') ? 'live_dual' : 'weight';
          }
          price = (parts[5] || parts[parts.length - 1] || '').replace(/[^0-9.]/g, '');
        } else {
          code = String(i + 1);
          name = parts[0];
          category = parts[1] || 'Chicken';
          price = (parts[parts.length - 1] || '').replace(/[^0-9.]/g, '');
        }

        if (name) {
          parsedRows.push({
            product_code: code,
            name,
            category,
            type,
            unit_type,
            cost_rupees: '',
            price_rupees: price,
            track_inventory: false,
          });
        }
      }

      if (parsedRows.length > 0) {
        setRows(parsedRows);
        setError(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // Submit to POS
  const handleSave = async () => {
    setError(null);
    const validRows = rows.filter(r => r.name.trim() && r.price_rupees.trim());
    if (validRows.length === 0) {
      setError('Please fill in at least one product with a Name and Selling Rate.');
      return;
    }

    // Check rate valid numbers
    for (let i = 0; i < validRows.length; i++) {
      const price = parseFloat(validRows[i].price_rupees);
      if (isNaN(price) || price <= 0) {
        setError(`Row #${i + 1} (${validRows[i].name}) has an invalid Selling Rate: "${validRows[i].price_rupees}".`);
        return;
      }
    }

    try {
      const payloadRows = validRows.map(r => ({
        name: r.name.trim(),
        category: r.category.trim() || 'Chicken',
        type: r.type.trim() || 'Unprocessed (Raw)',
        unit_type: r.unit_type,
        product_code: r.product_code.trim() || undefined,
        cost_rupees: parseFloat(r.cost_rupees) || 0,
        price_rupees: parseFloat(r.price_rupees) || 0,
        track_in_inventory: r.track_inventory ? 1 : 0,
      }));

      const result = await bulkAddMutation.mutateAsync(payloadRows as any);
      setImportResult(result);
    } catch (e: any) {
      setError(e.message || 'Failed to save products to catalogue');
    }
  };

  const validCount = rows.filter(r => r.name.trim() && parseFloat(r.price_rupees) > 0).length;
  const isSaving = bulkAddMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-surface-app rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col border border-border-subtle overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/15 text-brand-500 border border-brand-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-text-primary flex items-center gap-2">
                Bulk Add Products
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
                  POS Quick Entry Grid
                </span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Fast multi-item entry with auto bill numbers, or copy-paste directly from Excel / CSV spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Fast Action Controls */}
        <div className="px-6 py-3 bg-surface-panel border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left Tools: Add rows, Clear, Fill Category */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => addRow(1)}
              className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover hover:border-border-focus transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Plus size={14} className="text-brand-500" />
              <span>+ 1 Row</span>
            </button>
            <button
              type="button"
              onClick={() => addRow(5)}
              className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-subtle text-xs font-bold text-text-primary hover:bg-surface-hover hover:border-border-focus transition-all flex items-center gap-1.5 shadow-2xs"
            >
              <Plus size={14} className="text-brand-500" />
              <span>+ 5 Rows</span>
            </button>
            <button
              type="button"
              onClick={clearEmptyRows}
              className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-subtle text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-surface-hover transition-all"
            >
              Clear Empty Rows
            </button>

            <div className="h-4 w-px bg-border-subtle mx-1 hidden sm:block" />

            {/* Quick Category Setter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-text-muted hidden md:inline">Quick Category:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) fillCategoryForAll(e.target.value);
                }}
                defaultValue=""
                className="bg-surface-card border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-secondary outline-none focus:border-brand-500"
              >
                <option value="" disabled>Set All Category...</option>
                {DEFAULT_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Tools: Template download & CSV upload */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-xl bg-surface-card border border-border-subtle text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all flex items-center gap-1.5"
              title="Download CSV template to fill in Excel"
            >
              <Download size={13} className="text-brand-500" />
              <span>Download Template</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs font-bold text-brand-500 hover:bg-brand-500/20 transition-all flex items-center gap-1.5"
            >
              <Upload size={13} />
              <span>Upload CSV / Excel</span>
            </button>
          </div>
        </div>

        {/* Modal Main Grid View */}
        <div className="flex-1 overflow-auto p-6 relative">
          {importResult && (!importResult.errorRows || importResult.errorRows.length === 0) ? (
            <div className="absolute inset-0 bg-surface-app flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-4 shadow-subtle border border-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold text-text-primary mb-2">Products Successfully Added</h3>
              <p className="text-text-secondary text-sm mb-6 max-w-md">
                Successfully added <span className="font-bold text-emerald-400">{importResult.createdCount + (importResult.updatedCount || 0)} items</span> to your catalogue. They are now immediately ready with bill numbers on the POS billing screen!
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-brand-500 text-white font-bold hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition-all"
              >
                Done & Return to Catalogue
              </button>
            </div>
          ) : (
            <div className="min-w-[900px] space-y-4">
              {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs font-semibold">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{error}</p>
                    {importResult?.errorRows && importResult.errorRows.length > 0 && (
                      <ul className="list-disc list-inside mt-2 text-xs opacity-90 space-y-0.5">
                        {importResult.errorRows.slice(0, 5).map((er, i) => (
                          <li key={i}>Row {er.rowIndex + 1}: {er.messages?.join(', ') || er.message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="border border-border-subtle rounded-2xl overflow-hidden bg-surface-card shadow-sm">
                <table className="w-full text-left border-collapse" onPaste={handlePaste}>
                  <thead>
                    <tr className="bg-surface-panel border-b border-border-subtle text-[10px] font-extrabold text-text-muted uppercase tracking-wider">
                      <th className="w-12 px-3 py-3 text-center">#</th>
                      <th className="w-28 px-3 py-3 border-l border-border-subtle/50">
                        Bill No. / Code *
                      </th>
                      <th className="px-4 py-3 border-l border-border-subtle/50">
                        Product Name *
                      </th>
                      <th className="w-32 px-3 py-3 border-l border-border-subtle/50">
                        Category *
                      </th>
                      <th className="w-36 px-3 py-3 border-l border-border-subtle/50">
                        Type
                      </th>
                      <th className="w-32 px-3 py-3 border-l border-border-subtle/50">
                        Unit Type
                      </th>
                      <th className="w-32 px-3 py-3 border-l border-border-subtle/50 text-right">
                        Buying Rate (₹)
                      </th>
                      <th className="w-32 px-3 py-3 border-l border-border-subtle/50 text-right">
                        Selling Rate (₹) *
                      </th>
                      <th className="w-20 px-2 py-3 border-l border-border-subtle/50 text-center">
                        Track Inv
                      </th>
                      <th className="w-12 px-3 py-3 border-l border-border-subtle/50 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/40 text-xs">
                    {rows.map((row, rIdx) => {
                      const isValid = row.name.trim() && parseFloat(row.price_rupees) > 0;
                      const isPartial = row.name.trim() || row.price_rupees.trim();

                      return (
                        <tr
                          key={rIdx}
                          className="hover:bg-surface-panel/40 focus-within:bg-brand-500/5 group transition-colors"
                        >
                          {/* Row Status Indicator */}
                          <td className="px-2 py-2 text-center text-[10px] font-mono font-bold bg-surface-panel/30">
                            <div className="flex items-center justify-center gap-1">
                              {isValid ? (
                                <Check size={13} className="text-emerald-400" />
                              ) : isPartial ? (
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                              ) : (
                                <span className="text-text-muted">{rIdx + 1}</span>
                              )}
                            </div>
                          </td>

                          {/* 1. Bill No. / Code */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <div className="relative flex items-center px-2">
                              <span className="text-[11px] font-extrabold text-brand-500 font-mono select-none">#</span>
                              <input
                                type="text"
                                value={row.product_code}
                                onChange={(e) => updateCell(rIdx, 'product_code', e.target.value.toUpperCase())}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, 'product_code')}
                                placeholder={String(rIdx + 1)}
                                className="w-full h-10 pl-1 pr-2 bg-transparent text-xs font-mono font-extrabold text-text-primary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors"
                              />
                            </div>
                          </td>

                          {/* 2. Product Name */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => updateCell(rIdx, 'name', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rIdx, 'name')}
                              placeholder={rIdx === 0 ? 'e.g. Chicken Curry Cut' : 'Item name...'}
                              className="w-full h-10 px-3.5 bg-transparent text-xs font-bold text-text-primary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors"
                            />
                          </td>

                          {/* 3. Category */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <select
                              value={row.category}
                              onChange={(e) => updateCell(rIdx, 'category', e.target.value)}
                              className="w-full h-10 px-3 bg-transparent text-xs font-bold text-text-primary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors cursor-pointer"
                            >
                              {DEFAULT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat} className="bg-surface-card text-text-primary font-bold">
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 4. Type */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <select
                              value={row.type}
                              onChange={(e) => updateCell(rIdx, 'type', e.target.value)}
                              className="w-full h-10 px-3 bg-transparent text-[11px] font-semibold text-text-secondary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors cursor-pointer"
                            >
                              {DEFAULT_TYPES.map(t => (
                                <option key={t} value={t} className="bg-surface-card text-text-primary">
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 5. Unit Type */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <select
                              value={row.unit_type}
                              onChange={(e) => updateCell(rIdx, 'unit_type', e.target.value as any)}
                              className="w-full h-10 px-3 bg-transparent text-xs font-medium text-text-secondary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors cursor-pointer"
                            >
                              {DEFAULT_UNIT_TYPES.map(ut => (
                                <option key={ut.value} value={ut.value} className="bg-surface-card text-text-primary">
                                  {ut.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 6. Buying Rate (₹) */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <div className="relative flex items-center px-2">
                              <span className="text-xs font-bold text-text-muted select-none">₹</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.cost_rupees}
                                onChange={(e) => updateCell(rIdx, 'cost_rupees', e.target.value)}
                                placeholder="0.00"
                                className="w-full h-10 pl-1 pr-2 bg-transparent text-xs font-mono font-bold text-right text-text-secondary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors"
                              />
                            </div>
                          </td>

                          {/* 7. Selling Rate (₹) */}
                          <td className="p-0 border-l border-border-subtle/50">
                            <div className="relative flex items-center px-2">
                              <span className="text-xs font-bold text-text-muted select-none">₹</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={row.price_rupees}
                                onChange={(e) => updateCell(rIdx, 'price_rupees', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, rIdx, 'price_rupees')}
                                placeholder={rIdx === 0 ? '280.00' : '0.00'}
                                className="w-full h-10 pl-1 pr-2 bg-transparent text-xs font-mono font-extrabold text-right text-text-primary focus:outline-none focus:bg-surface-card focus:ring-1 focus:ring-inset focus:ring-brand-500 transition-colors"
                              />
                            </div>
                          </td>

                          {/* 8. Track Inv */}
                          <td className="p-0 border-l border-border-subtle/50 text-center">
                            <input
                              type="checkbox"
                              checked={row.track_inventory}
                              onChange={(e) => updateCell(rIdx, 'track_inventory', e.target.checked)}
                              className="rounded border-border-subtle text-brand-500 focus:ring-brand-500 cursor-pointer h-4 w-4"
                            />
                          </td>

                          {/* Delete Row Button */}
                          <td className="p-0 border-l border-border-subtle/50 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(rIdx)}
                              className="w-full h-10 flex items-center justify-center text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-40 group-hover:opacity-100"
                              title="Delete Row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Quick Row Adding Pill */}
              <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                <button
                  type="button"
                  onClick={() => addRow(1)}
                  className="px-4 py-2 text-xs font-bold text-brand-500 hover:bg-brand-500/10 rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Row (or press Enter in last cell)
                </button>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-semibold text-text-primary">{validCount}</span> items ready to add
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        {(!importResult || (importResult.errorRows && importResult.errorRows.length > 0)) && (
          <div className="px-6 py-4 border-t border-border-subtle bg-surface-card flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Keyboard shortcut tips */}
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <kbd className="px-1.5 py-0.5 rounded bg-surface-panel border border-border-subtle font-mono text-[10px] font-bold">Tab</kbd>
              <span>or</span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-panel border border-border-subtle font-mono text-[10px] font-bold">Enter</kbd>
              <span>moves between cells</span>
              <span className="mx-1.5 opacity-30">|</span>
              <kbd className="px-1.5 py-0.5 rounded bg-surface-panel border border-border-subtle font-mono text-[10px] font-bold">Ctrl+V</kbd>
              <span>pastes Excel data</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || validCount === 0}
                className="px-6 py-2.5 rounded-xl bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving Products...' : `Save & Add ${validCount} Products to POS`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
