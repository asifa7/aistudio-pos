import { useState } from 'react';
import { ShoppingCart, IndianRupee, FileText, UserCheck, Filter, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useCustomerTimeline } from '../hooks/useCustomers';
import { formatPaise } from '../types/customer.types';
import type { TimelineEventItem } from '../types/customer.types';

interface CustomerTimelineViewProps {
  customerId: number;
}

export default function CustomerTimelineView({ customerId }: CustomerTimelineViewProps) {
  const { data: timeline, isLoading, error } = useCustomerTimeline(customerId);
  const [filterType, setFilterType] = useState<'all' | 'purchase' | 'payment' | 'credit' | 'activity'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-text-muted animate-pulse text-xs">
        Loading customer chronological timeline...
      </div>
    );
  }

  if (error || !timeline) {
    return (
      <div className="py-12 text-center text-red-400 text-xs">
        Failed to load customer timeline.
      </div>
    );
  }

  const filteredTimeline = timeline.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ShoppingCart size={14} className="text-emerald-600 dark:text-emerald-400" />;
      case 'payment':
        return <IndianRupee size={14} className="text-cyan-600 dark:text-cyan-400" />;
      case 'credit':
        return <FileText size={14} className="text-amber-600 dark:text-amber-400" />;
      case 'activity':
      default:
        return <UserCheck size={14} className="text-purple-600 dark:text-purple-400" />;
    }
  };

  const getEventBorderColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5';
      case 'payment':
        return 'border-cyan-300 dark:border-cyan-500/30 bg-cyan-50/60 dark:bg-cyan-500/5';
      case 'credit':
        return 'border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5';
      case 'activity':
      default:
        return 'border-purple-300 dark:border-purple-500/30 bg-purple-50/60 dark:bg-purple-500/5';
    }
  };

  const getEventBadgeColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40';
      case 'payment':
        return 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40';
      case 'credit':
        return 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40';
      case 'activity':
      default:
        return 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-500/40';
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Chips Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1 mr-1">
            <Filter size={11} /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-brand-500 text-white shadow-subtle'
                : 'bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle shadow-sm'
            }`}
          >
            All Events ({timeline.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('purchase')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              filterType === 'purchase'
                ? 'bg-emerald-500 text-white shadow-subtle'
                : 'bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle shadow-sm'
            }`}
          >
            <ShoppingCart size={12} /> Purchases ({timeline.filter(t => t.type === 'purchase').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('payment')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              filterType === 'payment'
                ? 'bg-cyan-500 text-white shadow-subtle'
                : 'bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle shadow-sm'
            }`}
          >
            <IndianRupee size={12} /> Payments ({timeline.filter(t => t.type === 'payment').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('credit')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              filterType === 'credit'
                ? 'bg-amber-500 text-white shadow-subtle'
                : 'bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle shadow-sm'
            }`}
          >
            <FileText size={12} /> Credit ({timeline.filter(t => t.type === 'credit').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('activity')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              filterType === 'activity'
                ? 'bg-purple-500 text-white shadow-subtle'
                : 'bg-surface-card hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-subtle shadow-sm'
            }`}
          >
            <UserCheck size={12} /> Account Logs ({timeline.filter(t => t.type === 'activity').length})
          </button>
        </div>

        <div className="text-[10px] text-text-muted font-mono flex items-center gap-1">
          <Clock size={11} /> Unified Chronological Feed
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredTimeline.length === 0 ? (
        <div className="py-16 text-center text-text-muted text-xs">
          No timeline events found for this filter.
        </div>
      ) : (
        <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-subtle">
          {filteredTimeline.map((item: TimelineEventItem) => {
            const isExpanded = !!expandedIds[item.id];
            const eventDate = new Date(item.timestamp);
            const dateFormatted = eventDate.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const timeFormatted = eventDate.toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={item.id} className="relative group">
                {/* Timeline node icon */}
                <div className={`absolute -left-6 top-2.5 w-5 h-5 rounded-full border flex items-center justify-center bg-surface-card shadow-sm ${getEventBadgeColor(item.type)}`}>
                  {getEventIcon(item.type)}
                </div>

                {/* Event Card */}
                <div className={`border rounded-xl p-3 text-xs transition-all hover:shadow-subtle ${getEventBorderColor(item.type)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-text-primary text-xs">{item.title}</span>
                        <span className={`px-1.5 py-0.2 border rounded-full text-[9px] font-bold ${getEventBadgeColor(item.type)}`}>
                          {item.badge}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">
                          {dateFormatted} at {timeFormatted}
                        </span>
                      </div>

                      <p className="text-text-secondary text-xs mt-1 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {item.amount_paise != null && (
                        <div className={`font-mono font-extrabold text-sm ${item.type === 'payment' ? 'text-cyan-700 dark:text-cyan-400' : (item.type === 'purchase' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}`}>
                          {formatPaise(item.amount_paise)}
                        </div>
                      )}
                      {item.metadata?.method_label && (
                        <div className="text-[9px] text-text-muted font-mono mt-0.5">
                          {item.metadata.method_label}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable Details Button */}
                  {item.metadata && Object.keys(item.metadata).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border-subtle/50 flex items-center justify-between text-[10px]">
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.id)}
                        className="text-text-muted hover:text-text-primary flex items-center gap-1 font-mono transition-colors"
                      >
                        <span>{isExpanded ? 'Hide Details' : 'View Full Details'}</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-2 bg-surface-card rounded-lg text-[10px] font-mono text-text-primary border border-border-subtle overflow-x-auto w-full">
                          {JSON.stringify(item.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
