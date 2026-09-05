import React from 'react';
import { PivotResult } from '../../types/reports.types';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

interface PivotTableViewProps {
  pivotData: PivotResult;
  loading?: boolean;
}

export const PivotTableView: React.FC<PivotTableViewProps> = ({
  pivotData,
  loading = false,
}) => {
  const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal, rowDimName, colDimName, valueMeasureName, valueType } = pivotData;

  const formatValue = (val: number | undefined) => {
    if (val === undefined || val === 0) return '—';
    if (valueType === 'currency') return formatPaise(val);
    if (valueType === 'weight') return `${(val / 1000).toFixed(2)} kg`;
    if (valueType === 'percent') return `${val.toFixed(1)}%`;
    return val.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        Computing Pivot Cross-Tabulation...
      </div>
    );
  }

  if (rowKeys.length === 0 || colKeys.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
        No records available for the selected pivot dimensions.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Pivot Meta Header */}
      <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs text-gray-600">
        <div>
          <span className="font-semibold text-gray-800">Pivot Cross-Tab:</span> Rows: <span className="font-medium text-blue-600">{rowDimName}</span> × Columns: <span className="font-medium text-blue-600">{colDimName}</span>
        </div>
        <div className="font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
          Value: {valueMeasureName}
        </div>
      </div>

      {/* Cross-Tab Table */}
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-gray-100 border-b border-gray-300 z-10">
            <tr>
              <th className="p-2.5 font-bold text-gray-800 border-r border-gray-200 sticky left-0 bg-gray-100 min-w-[160px]">
                {rowDimName} / {colDimName}
              </th>
              {colKeys.map(colKey => (
                <th key={colKey} className="p-2.5 font-bold text-gray-700 text-right min-w-[120px] border-r border-gray-200">
                  {colKey}
                </th>
              ))}
              <th className="p-2.5 font-bold text-blue-900 bg-blue-50 text-right min-w-[130px]">
                Row Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rowKeys.map(rowKey => (
              <tr key={rowKey} className="hover:bg-blue-50/40 transition-colors">
                <td className="p-2.5 font-semibold text-gray-900 border-r border-gray-200 sticky left-0 bg-white shadow-[1px_0_0_0_#e5e7eb]">
                  {rowKey}
                </td>
                {colKeys.map(colKey => {
                  const val = matrix[rowKey]?.[colKey];
                  return (
                    <td key={colKey} className="p-2.5 text-right font-mono border-r border-gray-100 text-gray-700">
                      {formatValue(val)}
                    </td>
                  );
                })}
                <td className="p-2.5 text-right font-mono font-bold text-blue-900 bg-blue-50/50">
                  {formatValue(rowTotals[rowKey])}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-100 font-bold border-t-2 border-gray-300 z-10">
            <tr>
              <td className="p-2.5 text-gray-900 border-r border-gray-200 sticky left-0 bg-gray-100">
                Column Total
              </td>
              {colKeys.map(colKey => (
                <td key={colKey} className="p-2.5 text-right font-mono text-gray-900 border-r border-gray-200">
                  {formatValue(colTotals[colKey])}
                </td>
              ))}
              <td className="p-2.5 text-right font-mono text-blue-900 bg-blue-100">
                {formatValue(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
