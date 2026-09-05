import React, { useState } from 'react';
import {
  BarChart3,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Scale,
  RefreshCw,
  Download,
  Layers,
  ShoppingBag,
  CreditCard,
  QrCode,
  ShieldCheck,
  RotateCcw,
  Tag,
  PackageCheck,
  Users,
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  ChevronDown,
  Boxes,
  Truck,
  Wallet,
  LineChart,
  Table,
  Grid,
  PieChart,
  Plus,
  Star,
  Home
} from 'lucide-react';
import {
  GlobalFilterState,
  ReportQueryOptions,
  CustomReportBuilderConfig,
  PivotTableConfig,
  PivotResult,
} from '../../types/reports.types';
import {
  useReportDefinitions,
  useReportFilterOptions,
  useReportQuery,
  useFavoriteReportIds,
  useToggleFavorite,
  useRecentReports,
  useSavedReports,
  useSaveReport,
  useReportAlerts,
  useRunCustomReport,
  useBuildPivot,
} from '../hooks/useReportEngine';
import GlobalFilterBar from './GlobalFilterBar';
import ReportTable from './ReportTable';
import { PivotTableView } from './PivotTableView';
import { ReportChartView } from './ReportChartView';
import { CustomReportBuilderModal } from './CustomReportBuilderModal';
import { ReportCenterLanding } from './ReportCenterLanding';
import TransactionDetailModal from './TransactionDetailModal';
import ReportExportModal from './ReportExportModal';
import { formatPaise } from '../../../customers/frontend/types/customer.types';

// Report Category groups for intuitive navigation
const REPORT_CATEGORIES = [
  {
    id: 'landing',
    name: 'Report Center',
    icon: Home,
    reportIds: []
  },
  {
    id: 'business_tax',
    name: 'Tax & Performance',
    icon: LineChart,
    reportIds: [
      'business_performance_report',
      'tax_gst_report'
    ]
  },
  {
    id: 'sales',
    name: 'Sales Reports',
    icon: ShoppingBag,
    reportIds: [
      'raw_transactions',
      'sales_by_date',
      'sales_by_product',
      'sales_by_category',
      'sales_by_customer',
      'sales_by_customer_group',
      'sales_by_cashier',
      'sales_by_shift',
      'sales_by_payment_method',
      'sales_by_day_of_week',
      'sales_by_hour',
      'sales_by_location',
      'returns_and_refunds',
      'discounts_report'
    ]
  },
  {
    id: 'profitability',
    name: 'Profitability & COGS',
    icon: TrendingUp,
    reportIds: ['product_profitability', 'cogs_report']
  },
  {
    id: 'inventory',
    name: 'Inventory & Yield',
    icon: Boxes,
    reportIds: [
      'stock_on_hand_report',
      'stock_movement_report',
      'stock_valuation_report',
      'meat_yield_report',
      'wastage_loss_report',
      'dead_stock_report'
    ]
  },
  {
    id: 'purchases',
    name: 'Purchases & Suppliers',
    icon: Truck,
    reportIds: [
      'purchase_transactions_report',
      'supplier_summary_report',
      'purchase_price_variance_report'
    ]
  },
  {
    id: 'expenses_shifts',
    name: 'Expenses & Shifts',
    icon: Wallet,
    reportIds: [
      'expense_records_report',
      'cash_box_reconciliation_report',
      'shift_closing_report'
    ]
  },
  {
    id: 'operations_audit',
    name: 'Operations & Audit',
    icon: ShieldCheck,
    reportIds: [
      'employee_cashier_report',
      'void_cancelled_report',
      'unified_audit_report'
    ]
  },
  {
    id: 'payments',
    name: 'Payments & UPI',
    icon: CreditCard,
    reportIds: ['payment_summary_report', 'upi_report', 'payment_reconciliation_report']
  },
  {
    id: 'customers',
    name: 'Customer CRM',
    icon: Users,
    reportIds: [
      'customer_sales_report',
      'customer_profitability_report',
      'customer_activity_report',
      'customer_retention_report'
    ]
  },
  {
    id: 'credit_ar',
    name: 'Credit & A/R',
    icon: FileText,
    reportIds: [
      'ar_outstanding_report',
      'ar_aging_report',
      'customer_payment_behavior_report',
      'customer_advance_report'
    ]
  }
];

export default function ReportsView() {
  const todayStr = new Date().toISOString().split('T')[0];

  // Active Category & Report
  const [activeCategory, setActiveCategory] = useState<string>('business_tax');
  const [selectedReportId, setSelectedReportId] = useState<string>('business_performance_report');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isCustomBuilderOpen, setIsCustomBuilderOpen] = useState(false);

  // View Mode: table / pivot / chart
  const [viewMode, setViewMode] = useState<'table' | 'pivot' | 'chart'>('table');

  // Favorites & Recents state via React Query hooks
  const { data: favoriteIds = [], refetch: refetchFavorites } = useFavoriteReportIds(1);
  const toggleFavMutation = useToggleFavorite();
  const saveReportMutation = useSaveReport();
  const runCustomReportMutation = useRunCustomReport();
  const { data: recentReports = [] } = useRecentReports(1);
  const { data: savedReports = [] } = useSavedReports(1);
  const { data: reportAlerts = [] } = useReportAlerts();

  // Global Filter State
  const [filters, setFilters] = useState<GlobalFilterState>({
    datePreset: 'today',
    startDate: todayStr,
    endDate: todayStr,
    categoryId: 'all',
    paymentMethod: 'all',
    customerCategory: 'all',
    locationId: 'all',
    cashierId: 'all',
    customerId: 'all',
    shiftId: 'all',
    searchTerm: '',
  });

  // Table options (Grouping, Sorting, Paging)
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<{ field: string; direction: 'asc' | 'desc' }[]>([]);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Fetch Definitions and Filter Options
  const { data: reportDefs = [], isLoading: isLoadingDefs } = useReportDefinitions();
  const { data: filterOptions, isLoading: isLoadingOptions } = useReportFilterOptions();

  // Query Current Report Data through the generic engine
  const queryOptions: ReportQueryOptions = {
    reportId: selectedReportId,
    filters,
    groupBy,
    sortBy,
    page,
    pageSize,
  };

  const {
    data: reportResult,
    isLoading: isLoadingQuery,
    refetch: refetchReport,
    isFetching
  } = useReportQuery(queryOptions);

  // Pivot query via IPC hook
  const dimCols = reportResult?.columns.filter(c => !c.isMeasure) || [];
  const measCols = reportResult?.columns.filter(c => c.isMeasure) || [];
  const pivotConfig = {
    rowDimension: dimCols[0]?.id || 'product_name',
    columnDimension: dimCols[1]?.id || 'payment_method',
    valueMeasure: measCols[0]?.id || 'net_amount_paise',
  };

  const { data: pivotData = null } = useBuildPivot(queryOptions, pivotConfig, viewMode === 'pivot');

  // Drilldown handler
  const handleCategoryDrilldown = (categoryName: string) => {
    setFilters(prev => ({
      ...prev,
      categoryId: categoryName,
    }));
    setSelectedReportId('sales_by_product');
    setGroupBy(['product_name']);
  };

  const currentCategoryObj = REPORT_CATEGORIES.find(c => c.id === activeCategory) || REPORT_CATEGORIES[1];
  const availableReportsInCategory = reportDefs.filter(d => currentCategoryObj.reportIds.includes(d.id));

  const handleReportChange = (reportId: string, categoryId?: string) => {
    setSelectedReportId(reportId);
    if (categoryId) {
      setActiveCategory(categoryId);
    } else {
      const foundCat = REPORT_CATEGORIES.find(c => c.reportIds.includes(reportId));
      if (foundCat) setActiveCategory(foundCat.id);
    }
    const def = reportDefs.find(d => d.id === reportId);
    setGroupBy(def?.defaultGroupBy || []);
    setSortBy(def?.defaultSortBy || []);
    setPage(1);
    setViewMode('table');

    // Record access in recent reports
    try {
      window.api.invoke('reports:record-recent', {
        userId: 1,
        reportId,
        reportName: def?.name || reportId,
        category: def?.category || 'General',
      });
    } catch {}
  };

  const handleToggleFavorite = async (reportId: string) => {
    try {
      await toggleFavMutation.mutateAsync({ reportId, userId: 1 });
      refetchFavorites();
    } catch {}
  };

  const handleRunCustomReport = async (config: CustomReportBuilderConfig) => {
    try {
      const result = await runCustomReportMutation.mutateAsync(config);
      setSelectedReportId(result.reportId);
      setActiveCategory('custom');
      setViewMode(config.viewMode || 'table');
    } catch (e: any) {
      alert(e.message || 'Error running custom report');
    }
  };

  const handleSaveCustomReport = async (config: CustomReportBuilderConfig) => {
    try {
      await saveReportMutation.mutateAsync({
        name: config.name,
        description: config.description,
        dataSource: config.dataSource,
        configuration: config,
        createdBy: 1,
      });
      alert(`Report "${config.name}" saved successfully!`);
    } catch (e: any) {
      alert(e.message || 'Error saving report');
    }
  };

  const isCurrentFav = favoriteIds.includes(selectedReportId);

  // If active category is landing, show ReportCenterLanding
  if (activeCategory === 'landing') {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-6 space-y-4 bg-surface-app text-text-primary">
        <ReportCenterLanding
          reportDefinitions={reportDefs}
          alerts={reportAlerts}
          favoriteReportIds={favoriteIds}
          recentReports={recentReports}
          savedReports={savedReports}
          onSelectReport={(rId, cId) => handleReportChange(rId, cId)}
          onOpenCustomBuilder={() => setIsCustomBuilderOpen(true)}
          onToggleFavorite={handleToggleFavorite}
        />
        {isCustomBuilderOpen && (
          <CustomReportBuilderModal
            isOpen={isCustomBuilderOpen}
            onClose={() => setIsCustomBuilderOpen(false)}
            onRunReport={handleRunCustomReport}
            onSaveReport={handleSaveCustomReport}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 space-y-4 bg-surface-app text-text-primary">
      {/* 1. Header Toolbar */}
      <div className="border-b border-border-subtle pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-outfit text-text-primary flex items-center gap-2">
              <BarChart3 className="text-brand-500" />
              <span>{reportResult?.reportName || 'Reports & Intelligence'}</span>
            </h2>
            <button
              onClick={() => handleToggleFavorite(selectedReportId)}
              className="text-gray-400 hover:text-amber-400 transition-colors p-1"
              title={isCurrentFav ? 'Favorited' : 'Add to Favorites'}
            >
              <Star className={`w-4 h-4 ${isCurrentFav ? 'text-amber-400 fill-amber-400' : ''}`} />
            </button>
          </div>
          <p className="text-text-muted text-xs mt-0.5">
            {reportResult?.description || 'Multi-dimensional reporting engine with pivot cross-tabs and visual chart trends.'}
          </p>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {/* View Mode Toggle Switch */}
          <div className="flex items-center bg-surface-panel border border-border-subtle rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-brand-500 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Table size={13} />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('pivot')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'pivot' ? 'bg-brand-500 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Grid size={13} />
              <span>Pivot</span>
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'chart' ? 'bg-brand-500 text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <PieChart size={13} />
              <span>Chart</span>
            </button>
          </div>

          <button
            onClick={() => setIsCustomBuilderOpen(true)}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>Custom Builder</span>
          </button>

          <button
            onClick={() => refetchReport()}
            disabled={isFetching}
            className="px-3 py-1.5 bg-surface-panel hover:bg-surface-hover border border-border-subtle rounded-xl text-xs font-bold text-text-primary flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            title="Refresh Report Data"
          >
            <RefreshCw size={13} className={isFetching ? 'animate-spin text-brand-500' : 'text-text-muted'} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            disabled={!reportResult}
            className="px-4 py-1.5 bg-brand-500 hover:bg-brand-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <Download size={13} />
            <span>Export & Print</span>
          </button>
        </div>
      </div>

      {/* 2. Top Category Switcher */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2 shrink-0 overflow-x-auto">
        {REPORT_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                if (cat.id === 'landing') return;
                const firstReportInCat = reportDefs.find(d => cat.reportIds.includes(d.id));
                if (firstReportInCat) {
                  handleReportChange(firstReportInCat.id, cat.id);
                }
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-brand-500/10 text-brand-500 border border-brand-500/30'
                  : 'bg-surface-panel hover:bg-surface-hover text-text-secondary border border-border-subtle'
              }`}
            >
              <Icon size={14} />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Sub-Report Quick Tabs */}
      {availableReportsInCategory.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
          {availableReportsInCategory.map(report => {
            const isSelected = selectedReportId === report.id;
            return (
              <button
                key={report.id}
                onClick={() => handleReportChange(report.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-surface-panel hover:bg-surface-hover text-text-secondary border border-border-subtle'
                }`}
              >
                <span>{report.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Global Filter Bar (Section B) */}
      <div className="shrink-0">
        <GlobalFilterBar
          filters={filters}
          onFiltersChange={(newFilters) => {
            setFilters(newFilters);
            setPage(1);
          }}
          filterOptions={filterOptions}
          isLoadingOptions={isLoadingOptions}
        />
      </div>

      {/* 5. Top KPI Summary Strip */}
      {reportResult?.kpiSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="text-blue-500" size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">Volume / Records</p>
              <p className="text-base font-extrabold font-mono text-text-primary mt-0.5">
                {reportResult.kpiSummary.totalTransactions}
              </p>
            </div>
          </div>

          <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <DollarSign className="text-emerald-500" size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">Total Value</p>
              <p className="text-base font-extrabold font-mono text-text-primary mt-0.5">
                {formatPaise(reportResult.kpiSummary.totalRevenuePaise)}
              </p>
            </div>
          </div>

          <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="text-brand-500" size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">Gross Profit</p>
              <p className="text-base font-extrabold font-mono text-text-primary mt-0.5">
                {formatPaise(reportResult.kpiSummary.totalGrossProfitPaise)}
              </p>
            </div>
          </div>

          <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <Percent className="text-purple-500" size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">Margin %</p>
              <p className="text-base font-extrabold font-mono text-text-primary mt-0.5">
                {reportResult.kpiSummary.avgMarginPercent}%
              </p>
            </div>
          </div>

          <div className="bg-surface-panel border border-border-subtle rounded-xl p-3 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Scale className="text-amber-500" size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-text-muted">Total Weight</p>
              <p className="text-base font-extrabold font-mono text-text-primary mt-0.5">
                {(reportResult.kpiSummary.totalWeightGrams / 1000).toFixed(2)} kg
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 6. View Switcher Area */}
      {viewMode === 'table' && (
        <ReportTable
          result={reportResult}
          isLoading={isLoadingQuery}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(ps) => {
            setPageSize(ps);
            setPage(1);
          }}
          onSortChange={(sb) => setSortBy(sb)}
          onGroupByChange={(gb) => {
            setGroupBy(gb);
            setPage(1);
          }}
          onDrillDownInvoice={(invId) => setSelectedInvoiceId(invId)}
          onDrillDownFilter={(key, val) => {
            if (key === 'category') handleCategoryDrilldown(val);
          }}
        />
      )}

      {viewMode === 'pivot' && pivotData && (
        <PivotTableView
          pivotData={pivotData}
          loading={isLoadingQuery}
        />
      )}

      {viewMode === 'chart' && reportResult && (
        <ReportChartView
          data={reportResult.rows}
          dimensionKey={reportResult.columns[0]?.id || 'name'}
          dimensionLabel={reportResult.columns[0]?.name || 'Item'}
          measureKey={reportResult.columns.find(c => c.isMeasure)?.id || 'net_amount_paise'}
          measureLabel={reportResult.columns.find(c => c.isMeasure)?.name || 'Revenue'}
        />
      )}

      {/* 7. Invoice Drilldown Modal */}
      {selectedInvoiceId && (
        <TransactionDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}

      {/* 8. Export & Print Modal */}
      {isExportOpen && reportResult && (
        <ReportExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          result={reportResult}
        />
      )}

      {/* 9. Custom Report Builder Modal */}
      {isCustomBuilderOpen && (
        <CustomReportBuilderModal
          isOpen={isCustomBuilderOpen}
          onClose={() => setIsCustomBuilderOpen(false)}
          onRunReport={handleRunCustomReport}
          onSaveReport={handleSaveCustomReport}
        />
      )}
    </div>
  );
}
