import React, { useState } from 'react';
import { X, Plus, Trash2, Save, Play, CheckSquare, Square } from 'lucide-react';
import { CustomReportBuilderConfig } from '../../types/reports.types';

const DATA_SOURCE_OPTIONS = [
  { id: 'sales_transactions', name: 'Sales Transactions', category: 'Sales' },
  { id: 'stock_on_hand', name: 'Stock on Hand Inventory', category: 'Inventory' },
  { id: 'inventory_movement_ledger', name: 'Stock Movement Ledger', category: 'Inventory' },
  { id: 'customer_sales_intelligence', name: 'Customer Sales & CRM', category: 'Customers' },
  { id: 'purchase_transactions', name: 'Purchase Transactions', category: 'Purchases' },
  { id: 'expense_records', name: 'Store Expense Records', category: 'Expenses' },
  { id: 'cash_box_shifts', name: 'Cash Box & Shift Closings', category: 'Operations' },
];

const AVAILABLE_DIMENSIONS_BY_SOURCE: Record<string, { id: string; name: string }[]> = {
  sales_transactions: [
    { id: 'invoice_date', name: 'Date' },
    { id: 'product_name', name: 'Product' },
    { id: 'category', name: 'Category' },
    { id: 'customer_name', name: 'Customer' },
    { id: 'cashier_name', name: 'Cashier' },
    { id: 'payment_method', name: 'Payment Method' },
    { id: 'day_of_week', name: 'Day of Week' },
    { id: 'hour_of_day', name: 'Hour of Day' },
  ],
  stock_on_hand: [
    { id: 'product_name', name: 'Product' },
    { id: 'variant_name', name: 'Variant' },
    { id: 'category', name: 'Category' },
    { id: 'batch_number', name: 'Batch #' },
  ],
  customer_sales_intelligence: [
    { id: 'customer_name', name: 'Customer Name' },
    { id: 'category', name: 'Customer Category' },
    { id: 'frequency_segment', name: 'Frequency Segment' },
    { id: 'payment_preference', name: 'Payment Preference' },
  ],
  expense_records: [
    { id: 'expense_date', name: 'Date' },
    { id: 'category_name', name: 'Category' },
    { id: 'vendor_name', name: 'Vendor' },
    { id: 'payment_method', name: 'Payment Method' },
  ],
  cash_box_shifts: [
    { id: 'shift_date', name: 'Date' },
    { id: 'employee_name', name: 'Cashier' },
    { id: 'reconciliation_status', name: 'Status' },
  ],
  purchase_transactions: [
    { id: 'purchase_date', name: 'Date' },
    { id: 'supplier_name', name: 'Supplier' },
    { id: 'product_name', name: 'Product' },
  ],
};

const AVAILABLE_MEASURES_BY_SOURCE: Record<string, { id: string; name: string }[]> = {
  sales_transactions: [
    { id: 'net_amount_paise', name: 'Net Sales (₹)' },
    { id: 'gross_amount_paise', name: 'Gross Sales (₹)' },
    { id: 'tax_paise', name: 'Tax (₹)' },
    { id: 'discount_paise', name: 'Discounts (₹)' },
    { id: 'weight_kg', name: 'Weight (kg)' },
    { id: 'quantity_units', name: 'Quantity Units' },
    { id: 'gross_profit_paise', name: 'Gross Profit (₹)' },
    { id: 'margin_percent', name: 'Margin %' },
  ],
  stock_on_hand: [
    { id: 'stock_quantity_units', name: 'Stock Units' },
    { id: 'stock_weight_kg', name: 'Stock Weight (kg)' },
    { id: 'stock_valuation_paise', name: 'Stock Value (₹)' },
  ],
  customer_sales_intelligence: [
    { id: 'total_orders_count', name: 'Total Orders' },
    { id: 'total_spend_paise', name: 'Total Spend (₹)' },
    { id: 'avg_bill_paise', name: 'Average Bill (₹)' },
    { id: 'advance_balance_paise', name: 'Advance Balance (₹)' },
  ],
  expense_records: [
    { id: 'amount_paise', name: 'Total Amount (₹)' },
    { id: 'gst_paise', name: 'GST (₹)' },
    { id: 'net_amount_paise', name: 'Net Amount (₹)' },
  ],
  cash_box_shifts: [
    { id: 'opening_cash_paise', name: 'Opening Cash (₹)' },
    { id: 'cash_sales_paise', name: 'Cash Sales (₹)' },
    { id: 'expenses_paise', name: 'Expenses (₹)' },
    { id: 'expected_cash_paise', name: 'Expected Cash (₹)' },
    { id: 'actual_cash_paise', name: 'Actual Cash (₹)' },
    { id: 'variance_paise', name: 'Variance (₹)' },
  ],
  purchase_transactions: [
    { id: 'total_cost_paise', name: 'Total Cost (₹)' },
    { id: 'weight_kg', name: 'Weight (kg)' },
    { id: 'quantity_units', name: 'Quantity Units' },
  ],
};

interface CustomReportBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunReport: (config: CustomReportBuilderConfig) => void;
  onSaveReport?: (config: CustomReportBuilderConfig) => void;
}

export const CustomReportBuilderModal: React.FC<CustomReportBuilderModalProps> = ({
  isOpen,
  onClose,
  onRunReport,
  onSaveReport,
}) => {
  const [reportName, setReportName] = useState('My Custom Report');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState('sales_transactions');
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(['product_name', 'category']);
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>(['net_amount_paise', 'weight_kg']);
  const [selectedGroupBy, setSelectedGroupBy] = useState<string>('category');

  if (!isOpen) return null;

  const availableDims = AVAILABLE_DIMENSIONS_BY_SOURCE[dataSource] || AVAILABLE_DIMENSIONS_BY_SOURCE['sales_transactions'];
  const availableMeas = AVAILABLE_MEASURES_BY_SOURCE[dataSource] || AVAILABLE_MEASURES_BY_SOURCE['sales_transactions'];

  const handleToggleDimension = (id: string) => {
    if (selectedDimensions.includes(id)) {
      if (selectedDimensions.length > 1) {
        setSelectedDimensions(selectedDimensions.filter(d => d !== id));
      }
    } else {
      setSelectedDimensions([...selectedDimensions, id]);
    }
  };

  const handleToggleMeasure = (id: string) => {
    if (selectedMeasures.includes(id)) {
      if (selectedMeasures.length > 1) {
        setSelectedMeasures(selectedMeasures.filter(m => m !== id));
      }
    } else {
      setSelectedMeasures([...selectedMeasures, id]);
    }
  };

  const handleDataSourceChange = (newSource: string) => {
    setDataSource(newSource);
    const newDims = AVAILABLE_DIMENSIONS_BY_SOURCE[newSource] || [];
    const newMeas = AVAILABLE_MEASURES_BY_SOURCE[newSource] || [];
    setSelectedDimensions(newDims.slice(0, 2).map(d => d.id));
    setSelectedMeasures(newMeas.slice(0, 2).map(m => m.id));
    setSelectedGroupBy('');
  };

  const buildConfig = (): CustomReportBuilderConfig => ({
    name: reportName,
    description,
    dataSource,
    dimensions: selectedDimensions,
    measures: selectedMeasures,
    groupBy: selectedGroupBy ? [selectedGroupBy] : undefined,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-base font-bold text-gray-900">Custom Report Builder</h3>
            <p className="text-xs text-gray-500">Construct custom dimensions, measures & groupings dynamically</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* 1. Report Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-gray-700 mb-1">Report Name</label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. Monthly Chicken Sales"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Data Source</label>
              <select
                value={dataSource}
                onChange={(e) => handleDataSourceChange(e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {DATA_SOURCE_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.category}: {opt.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Choose Dimensions (Rows) */}
          <div>
            <label className="block font-medium text-gray-700 mb-1.5">
              Select Dimensions / Rows ({selectedDimensions.length} selected)
            </label>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {availableDims.map(d => {
                const isSelected = selectedDimensions.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleToggleDimension(d.id)}
                    className={`flex items-center space-x-2 text-left p-1.5 rounded transition-colors ${
                      isSelected ? 'bg-blue-100 text-blue-900 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
                    <span>{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Choose Measures (Columns / Values) */}
          <div>
            <label className="block font-medium text-gray-700 mb-1.5">
              Select Measures / Values ({selectedMeasures.length} selected)
            </label>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
              {availableMeas.map(m => {
                const isSelected = selectedMeasures.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleMeasure(m.id)}
                    className={`flex items-center space-x-2 text-left p-1.5 rounded transition-colors ${
                      isSelected ? 'bg-indigo-100 text-indigo-900 font-semibold' : 'hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-gray-400" />}
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Group By Selection */}
          <div>
            <label className="block font-medium text-gray-700 mb-1">Group By Hierarchy</label>
            <select
              value={selectedGroupBy}
              onChange={(e) => setSelectedGroupBy(e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">No Grouping (Flat Tabular List)</option>
              {selectedDimensions.map(dimId => {
                const d = availableDims.find(item => item.id === dimId);
                return (
                  <option key={dimId} value={dimId}>Group by: {d?.name || dimId}</option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-gray-300 text-gray-700 rounded hover:bg-gray-100 text-xs font-medium"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-2">
            {onSaveReport && (
              <button
                onClick={() => {
                  onSaveReport(buildConfig());
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs font-semibold shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Report</span>
              </button>
            )}
            <button
              onClick={() => {
                onRunReport(buildConfig());
                onClose();
              }}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-semibold shadow-sm"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Run Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
