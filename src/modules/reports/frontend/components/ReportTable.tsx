import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Layers,
  AlertTriangle,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Search
} from 'lucide-react';
import {
  ReportColumnDefinition,
  ReportGroupSummary,
  ReportQueryResult
} from '../../types/reports.types';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

interface ReportTableProps {
  result?: ReportQueryResult;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortChange?: (sortBy: { field: string; direction: 'asc' | 'desc' }[]) => void;
  onGroupByChange?: (groupBy: string[]) => void;
  onDrillDownInvoice?: (invoiceId: number) => void;
  onDrillDownFilter?: (filterKey: string, filterValue: any) => void;
}

export default function ReportTable({
  result,
  isLoading,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onGroupByChange,
  onDrillDownInvoice,
  onDrillDownFilter,
}: ReportTableProps) {
  // Local state for column visibility
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(new Set());
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [localSearch, setLocalSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Toggle group expansion
  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Toggle column visibility
  const toggleColumn = (colId: string) => {
    setHiddenColumnIds(prev => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };

  // Sort handler
  const handleSort = (colId: string) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (sortField === colId) {
      if (sortDir === 'asc') nextDir = 'desc';
      else {
        setSortField(null);
        if (onSortChange) onSortChange([]);
        return;
      }
    }
    setSortField(colId);
    setSortDir(nextDir);
    if (onSortChange) {
      onSortChange([{ field: colId, direction: nextDir }]);
    }
  };

  const visibleColumns = useMemo(() => {
    if (!result?.columns) return [];
    return result.columns.filter(c => !hiddenColumnIds.has(c.id));
  }, [result?.columns, hiddenColumnIds]);

  // Formatter helper for values
  const formatCellValue = (col: ReportColumnDefinition, val: any, row?: any) => {
    if (val === undefined || val === null) return '—';
    if (col.type === 'currency') {
      return formatPaise(Number(val));
    }
    if (col.type === 'percent') {
      return `${Number(val).toFixed(2)}%`;
    }
    if (col.type === 'weight') {
      return typeof val === 'number' ? `${val.toFixed(3)} kg` : String(val);
    }
    return String(val);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-text-muted space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Running report calculations & aggregations...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-text-muted text-xs">
        Select a report from the menu to begin.
      </div>
    );
  }

  const isGrouped = result.groupedData && result.groupedData.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface-panel border border-border-subtle rounded-2xl overflow-hidden shadow-sm select-none">
      {/* 1. Data Quality Warning Banner */}
      {result.dataQualityWarnings && result.dataQualityWarnings.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs font-medium shrink-0">
          <AlertTriangle size={15} className="text-amber-500 shrink-0" />
          <span>{result.dataQualityWarnings.join(' ')}</span>
        </div>
      )}

      {/* 2. Table Control Toolbar */}
      <div className="p-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-3 bg-surface-card shrink-0">
        <div className="flex items-center gap-2">
          {/* Column Visibility Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
              className="px-2.5 py-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-lg text-xs font-bold text-text-primary flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Eye size={13} className="text-brand-500" />
              <span>Columns ({visibleColumns.length}/{result.columns.length})</span>
              <ChevronDown size={11} />
            </button>

            {isColumnDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-60 bg-surface-panel border border-border-subtle rounded-xl shadow-2xl p-2 z-50 max-h-72 overflow-y-auto space-y-1">
                <div className="text-[10px] font-bold uppercase text-text-muted px-2 py-1 border-b border-border-subtle mb-1 flex justify-between items-center">
                  <span>Toggle Columns</span>
                  <button
                    onClick={() => setHiddenColumnIds(new Set())}
                    className="text-brand-500 hover:underline text-[10px]"
                  >
                    Show All
                  </button>
                </div>
                {result.columns.map(c => {
                  const isChecked = !hiddenColumnIds.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-surface-hover rounded-lg cursor-pointer text-xs text-text-primary font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColumn(c.id)}
                        className="rounded border-border-subtle text-brand-500 focus:ring-brand-500"
                      />
                      <span>{c.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grouping Dimension Quick Selector */}
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Layers size={13} className="text-brand-500 ml-2" />
            <span className="font-bold text-[11px]">Group by:</span>
            <select
              onChange={e => {
                const val = e.target.value;
                if (onGroupByChange) {
                  onGroupByChange(val === 'none' ? [] : [val]);
                }
              }}
              defaultValue="none"
              className="bg-surface-panel border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary font-medium outline-none"
            >
              <option value="none">Flat (No Grouping)</option>
              <option value="category">Category</option>
              <option value="customer_name">Customer</option>
              <option value="payment_method">Payment Method</option>
              <option value="cashier_name">Cashier</option>
              <option value="invoice_date">Date</option>
              <option value="location_name">Branch</option>
            </select>
          </div>
        </div>

        {/* Right side item counts */}
        <div className="text-xs text-text-muted font-medium">
          Showing <span className="font-bold text-text-primary font-mono">{result.rows.length}</span> rows (Total: <span className="font-bold text-text-primary font-mono">{result.totalRows}</span>)
        </div>
      </div>

      {/* 3. The Interactive Data Table Container */}
      <div className="flex-1 overflow-auto min-h-0 bg-surface-panel relative">
        <table className="w-full text-xs text-left border-collapse">
          {/* Sticky Header */}
          <thead className="sticky top-0 z-20 bg-surface-card border-b-2 border-border-subtle shadow-sm">
            <tr className="text-text-secondary text-[11px]">
              <th className="py-2.5 px-3 font-bold w-12 text-center border-r border-border-subtle">#</th>
              {visibleColumns.map(col => {
                const isSorted = sortField === col.id;
                return (
                  <th
                    key={col.id}
                    onClick={() => handleSort(col.id)}
                    className={`py-2.5 px-3 font-bold cursor-pointer hover:bg-surface-hover transition-colors whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${isSorted ? 'text-brand-600 dark:text-brand-400 bg-brand-500/5' : ''}`}
                  >
                    <div className={`inline-flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                      <span>{col.name}</span>
                      {isSorted ? (
                        sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={11} className="opacity-30 hover:opacity-100" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-border-subtle text-text-primary">
            {isGrouped ? (
              // Grouped Rows Mode
              result.groupedData!.map(group => {
                const isExpanded = expandedGroups.has(group.groupKey);
                return (
                  <React.Fragment key={group.groupKey}>
                    {/* Group Header Row with Subtotals */}
                    <tr
                      onClick={() => toggleGroup(group.groupKey)}
                      className="bg-surface-card/90 hover:bg-surface-hover font-bold cursor-pointer transition-colors border-y border-border-subtle text-xs"
                    >
                      <td className="py-2.5 px-3 text-center text-brand-500">
                        {isExpanded ? <ChevronDown size={14} className="inline" /> : <ChevronRight size={14} className="inline" />}
                      </td>
                      {visibleColumns.map((col, idx) => {
                        if (idx === 0) {
                          return (
                            <td key={col.id} className="py-2.5 px-3">
                              <span className="text-brand-600 dark:text-brand-400 font-extrabold mr-2">
                                {group.groupLabel}
                              </span>
                              <span className="text-[10px] text-text-muted font-normal px-2 py-0.5 bg-surface-panel rounded-full border border-border-subtle">
                                {group.count} records
                              </span>
                            </td>
                          );
                        }
                        if (col.isMeasure && group.subtotals[col.id] !== undefined) {
                          return (
                            <td key={col.id} className="py-2.5 px-3 text-right font-mono font-bold text-text-primary">
                              {formatCellValue(col, group.subtotals[col.id])}
                            </td>
                          );
                        }
                        return <td key={col.id} className="py-2.5 px-3" />;
                      })}
                    </tr>

                    {/* Group Itemized Children Rows */}
                    {isExpanded && group.rows && group.rows.map((row, rowIdx) => (
                      <tr key={row._row_id || `${group.groupKey}-${rowIdx}`} className="bg-surface-panel hover:bg-surface-hover/70 transition-colors">
                        <td className="py-2 px-3 text-center text-text-muted font-mono text-[10px] border-r border-border-subtle">
                          {rowIdx + 1}
                        </td>
                        {visibleColumns.map(col => {
                          const val = row[col.id];
                          const isInvoiceLink = col.id === 'invoice_number' || col.id === 'invoice_id';

                          return (
                            <td
                              key={col.id}
                              className={`py-2 px-3 whitespace-nowrap ${col.align === 'right' ? 'text-right font-mono' : ''}`}
                            >
                              {isInvoiceLink && onDrillDownInvoice ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDrillDownInvoice(row.invoice_id);
                                  }}
                                  className="text-brand-600 dark:text-brand-400 font-bold hover:underline inline-flex items-center gap-1"
                                >
                                  <span>{String(val)}</span>
                                  <ExternalLink size={10} className="opacity-70" />
                                </button>
                              ) : (
                                formatCellValue(col, val, row)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })
            ) : (
              // Standard Flat Rows Mode
              result.rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="py-16 text-center text-text-muted italic">
                    No transactions match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                result.rows.map((row, idx) => {
                  const rowNum = (result.page - 1) * result.pageSize + idx + 1;
                  return (
                    <tr key={row._row_id || idx} className="hover:bg-surface-hover transition-colors">
                      <td className="py-2 px-3 text-center text-text-muted font-mono text-[10px] border-r border-border-subtle">
                        {rowNum}
                      </td>
                      {visibleColumns.map(col => {
                        const val = row[col.id];
                        const isInvoiceLink = col.id === 'invoice_number' || col.id === 'invoice_id';

                        return (
                          <td
                            key={col.id}
                            className={`py-2 px-3 whitespace-nowrap ${col.align === 'right' ? 'text-right font-mono' : ''}`}
                          >
                            {isInvoiceLink && onDrillDownInvoice ? (
                              <button
                                onClick={() => onDrillDownInvoice(row.invoice_id)}
                                className="text-brand-600 dark:text-brand-400 font-bold hover:underline inline-flex items-center gap-1"
                              >
                                <span>{String(val)}</span>
                                <ExternalLink size={10} className="opacity-70" />
                              </button>
                            ) : (
                              formatCellValue(col, val, row)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )
            )}
          </tbody>

          {/* Grand Total Footer Row */}
          <tfoot className="sticky bottom-0 z-20 bg-surface-card border-t-2 border-border-subtle shadow-md font-bold">
            <tr className="text-xs text-text-primary">
              <td className="py-3 px-3 text-center uppercase font-black tracking-wider text-[10px] text-brand-500 border-r border-border-subtle">
                TOTAL
              </td>
              {visibleColumns.map((col, idx) => {
                if (idx === 0) {
                  return (
                    <td key={col.id} className="py-3 px-3 font-extrabold uppercase tracking-wider text-xs">
                      Grand Total ({result.totalRows} records)
                    </td>
                  );
                }
                if (col.isMeasure && result.grandTotals[col.id] !== undefined) {
                  return (
                    <td key={col.id} className="py-3 px-3 text-right font-mono font-extrabold text-brand-600 dark:text-brand-400">
                      {formatCellValue(col, result.grandTotals[col.id])}
                    </td>
                  );
                }
                return <td key={col.id} className="py-3 px-3" />;
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 4. Pagination & Page Size Footer */}
      {!isGrouped && result.totalPages > 1 && (
        <div className="p-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 bg-surface-card shrink-0">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span>Rows per page:</span>
            <select
              value={result.pageSize}
              onChange={e => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
              className="bg-surface-panel border border-border-subtle rounded-lg px-2 py-1 text-xs text-text-primary font-medium outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={-1}>All (Unpaginated)</option>
            </select>
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange && onPageChange(1)}
              disabled={result.page <= 1}
              className="p-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-lg text-text-secondary disabled:opacity-40"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => onPageChange && onPageChange(result.page - 1)}
              disabled={result.page <= 1}
              className="p-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-lg text-text-secondary disabled:opacity-40"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <span className="px-3 py-1 text-xs font-mono font-bold text-text-primary bg-surface-panel border border-border-subtle rounded-lg">
              Page {result.page} of {result.totalPages}
            </span>

            <button
              onClick={() => onPageChange && onPageChange(result.page + 1)}
              disabled={result.page >= result.totalPages}
              className="p-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-lg text-text-secondary disabled:opacity-40"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => onPageChange && onPageChange(result.totalPages)}
              disabled={result.page >= result.totalPages}
              className="p-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-lg text-text-secondary disabled:opacity-40"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
