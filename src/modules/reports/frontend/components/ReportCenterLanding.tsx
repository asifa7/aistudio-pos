import React, { useState } from 'react';
import {
  Search,
  Star,
  Clock,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  Boxes,
  Truck,
  Wallet,
  ShieldCheck,
  LineChart,
  CreditCard,
  Users,
  FileText,
  ChevronRight
} from 'lucide-react';
import { ReportAlert, RecentReportItem, SavedReport, ReportDefinition } from '../../types/reports.types';

interface ReportCenterLandingProps {
  reportDefinitions: ReportDefinition[];
  alerts: ReportAlert[];
  favoriteReportIds: string[];
  recentReports: RecentReportItem[];
  savedReports: SavedReport[];
  onSelectReport: (reportId: string, categoryId?: string) => void;
  onOpenCustomBuilder: () => void;
  onToggleFavorite: (reportId: string) => void;
}

const CATEGORY_CARDS = [
  { id: 'business_tax', name: 'Tax & Executive Performance', icon: LineChart, color: 'border-purple-200 bg-purple-50/50 text-purple-700' },
  { id: 'sales', name: 'Sales & Invoices', icon: ShoppingBag, color: 'border-blue-200 bg-blue-50/50 text-blue-700' },
  { id: 'profitability', name: 'Profitability & COGS', icon: TrendingUp, color: 'border-emerald-200 bg-emerald-50/50 text-emerald-700' },
  { id: 'inventory', name: 'Inventory & Yield', icon: Boxes, color: 'border-amber-200 bg-amber-50/50 text-amber-700' },
  { id: 'purchases', name: 'Purchases & Suppliers', icon: Truck, color: 'border-cyan-200 bg-cyan-50/50 text-cyan-700' },
  { id: 'expenses_shifts', name: 'Expenses & Cash Box Shifts', icon: Wallet, color: 'border-rose-200 bg-rose-50/50 text-rose-700' },
  { id: 'operations_audit', name: 'Operations & Unified Audit', icon: ShieldCheck, color: 'border-indigo-200 bg-indigo-50/50 text-indigo-700' },
  { id: 'payments', name: 'Payments & UPI Reconciliation', icon: CreditCard, color: 'border-teal-200 bg-teal-50/50 text-teal-700' },
  { id: 'customers', name: 'Customer CRM Intelligence', icon: Users, color: 'border-orange-200 bg-orange-50/50 text-orange-700' },
  { id: 'credit_ar', name: 'Credit & A/R Aging', icon: FileText, color: 'border-slate-200 bg-slate-50/50 text-slate-700' },
];

export const ReportCenterLanding: React.FC<ReportCenterLandingProps> = ({
  reportDefinitions,
  alerts,
  favoriteReportIds,
  recentReports,
  savedReports,
  onSelectReport,
  onOpenCustomBuilder,
  onToggleFavorite,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredReports = searchTerm.trim()
    ? reportDefinitions.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const favoriteReports = reportDefinitions.filter(r => favoriteReportIds.includes(r.id));

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Quick Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            MeatPOS Report Center
          </h2>
          <p className="text-xs text-slate-300">
            Comprehensive business intelligence, real-time ledgers, custom pivot reports, and audit trails.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reports by name, metric..."
              className="w-full bg-slate-800/90 text-xs text-white placeholder-slate-400 pl-9 pr-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={onOpenCustomBuilder}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Custom Report</span>
          </button>
        </div>
      </div>

      {/* 2. Instant Search Results if typing */}
      {searchTerm.trim() !== '' && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-md space-y-2">
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Search Results ({filteredReports.length} matches)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredReports.map(r => (
              <div
                key={r.id}
                onClick={() => onSelectReport(r.id)}
                className="p-3 bg-slate-50 hover:bg-blue-50/80 rounded-lg border border-slate-200 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-xs text-gray-900">{r.name}</div>
                  <div className="text-[11px] text-gray-500 line-clamp-1">{r.description}</div>
                </div>
                <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {r.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Section E: Threshold Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Threshold Action Alerts ({alerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                onClick={() => onSelectReport(alert.targetReportId)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer hover:shadow-md flex items-start justify-between gap-3 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50/80 border-red-200 text-red-900'
                    : alert.severity === 'warning'
                    ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                    : 'bg-blue-50/80 border-blue-200 text-blue-900'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <span>{alert.severity === 'critical' ? '🔴' : alert.severity === 'warning' ? '🟡' : 'ℹ️'}</span>
                    <span>{alert.title}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 leading-normal">
                    {alert.message}
                  </p>
                </div>
                <div className="flex items-center text-xs font-semibold text-blue-600 gap-1 shrink-0 pt-0.5">
                  <span>Review</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Section B: Favorites & Recents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Starred Favorites */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Starred Favorites ({favoriteReports.length})</span>
            </div>
          </div>
          {favoriteReports.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">
              No favorites starred yet. Star any report to access it instantly.
            </p>
          ) : (
            <div className="space-y-1.5">
              {favoriteReports.map(r => (
                <div
                  key={r.id}
                  onClick={() => onSelectReport(r.id)}
                  className="p-2.5 hover:bg-amber-50/60 rounded-lg border border-transparent hover:border-amber-200 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-gray-900">{r.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(r.id);
                    }}
                    className="text-amber-400 hover:text-gray-400"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Viewed */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Recently Opened</span>
            </div>
          </div>
          {recentReports.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center">
              Reports you view will appear here automatically.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentReports.slice(0, 5).map(r => (
                <div
                  key={r.reportId}
                  onClick={() => onSelectReport(r.reportId)}
                  className="p-2.5 hover:bg-blue-50/60 rounded-lg border border-transparent hover:border-blue-200 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <span className="text-xs font-medium text-gray-900">{r.reportName}</span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {r.lastAccessedAt ? new Date(r.lastAccessedAt).toLocaleDateString() : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5. Category Navigation Grid */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-gray-800 uppercase tracking-wider">
          Browse by Report Categories
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CATEGORY_CARDS.map(cat => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                onClick={() => onSelectReport(cat.id === 'business_tax' ? 'business_performance_report' : 'raw_transactions', cat.id)}
                className={`p-4 rounded-xl border ${cat.color} cursor-pointer hover:shadow-md transition-all flex flex-col justify-between h-28`}
              >
                <Icon className="w-5 h-5 mb-2" />
                <div>
                  <div className="font-bold text-xs leading-snug">{cat.name}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
