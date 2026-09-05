import { useQuery, useMutation } from '@tanstack/react-query';
import { IPC_CHANNELS } from '../../../../core/ipc/channels';
import {
  ReportDefinition,
  ReportFilterOptions,
  ReportQueryOptions,
  ReportQueryResult,
  ReportExportRequest
} from '../../types/reports.types';

export function useReportDefinitions() {
  return useQuery<ReportDefinition[]>({
    queryKey: ['report-definitions'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_DEFINITIONS, {});
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch report definitions');
      return res.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportFilterOptions() {
  return useQuery<ReportFilterOptions>({
    queryKey: ['report-filter-options'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_FILTER_OPTIONS, {});
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch report filter options');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportQuery(options: ReportQueryOptions, enabled = true) {
  return useQuery<ReportQueryResult>({
    queryKey: ['report-query', options],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.RUN_REPORT, options);
      if (!res.success) throw new Error(res.error?.message || 'Failed to execute report');
      return res.data;
    },
    enabled: enabled && Boolean(options.reportId),
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async (req: ReportExportRequest) => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.EXPORT_REPORT, req);
      if (!res.success) throw new Error(res.error?.message || 'Failed to export report');
      return res.data as { filename: string; mimeType: string; content: string };
    },
  });
}

export function useRunCustomReport() {
  return useMutation({
    mutationFn: async (config: any) => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.RUN_CUSTOM_REPORT, config);
      if (!res.success) throw new Error(res.error?.message || 'Failed to execute custom report');
      return res.data as ReportQueryResult;
    },
  });
}

export function useBuildPivot(options: ReportQueryOptions, pivotConfig: any, enabled = true) {
  return useQuery({
    queryKey: ['report-pivot', options, pivotConfig],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.BUILD_PIVOT, { options, pivotConfig });
      if (!res.success) throw new Error(res.error?.message || 'Failed to generate pivot table');
      return res.data;
    },
    enabled: enabled && Boolean(options.reportId) && Boolean(pivotConfig?.rowDimension) && Boolean(pivotConfig?.columnDimension),
  });
}

export function useSavedReports(userId?: number) {
  return useQuery({
    queryKey: ['saved-reports', userId],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_SAVED_REPORTS, { userId });
      if (!res.success) throw new Error(res.error?.message || 'Failed to fetch saved reports');
      return res.data || [];
    },
  });
}

export function useSaveReport() {
  return useMutation({
    mutationFn: async (input: any) => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.SAVE_REPORT, input);
      if (!res.success) throw new Error(res.error?.message || 'Failed to save report');
      return res.data;
    },
  });
}

export function useFavoriteReportIds(userId?: number) {
  return useQuery({
    queryKey: ['report-favorites', userId],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_FAVORITES, { userId });
      if (!res.success) return [];
      return res.data || [];
    },
  });
}

export function useToggleFavorite() {
  return useMutation({
    mutationFn: async (input: { reportId: string; userId?: number }) => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.TOGGLE_FAVORITE, input);
      if (!res.success) throw new Error(res.error?.message || 'Failed to toggle favorite');
      return res.data;
    },
  });
}

export function useRecentReports(userId?: number, limit = 10) {
  return useQuery({
    queryKey: ['report-recents', userId, limit],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_RECENTS, { userId, limit });
      if (!res.success) return [];
      return res.data || [];
    },
  });
}

export function useReportAlerts() {
  return useQuery({
    queryKey: ['report-alerts'],
    queryFn: async () => {
      const res = await window.api.invoke(IPC_CHANNELS.REPORTS.GET_ALERTS, {});
      if (!res.success) return [];
      return res.data || [];
    },
    staleTime: 60 * 1000,
  });
}

