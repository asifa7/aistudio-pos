export type AccentColorId = 'teal' | 'green' | 'orange' | 'slate' | 'sky' | 'blue' | 'indigo' | 'violet' | 'fuchsia' | 'rose';

export interface AccentColorOption {
  id: AccentColorId;
  name: string;
  hex: string;
  hover: string;
  active: string;
  tint50: string;
  tint100: string;
  bg: string;
}

export const ACCENT_COLORS: readonly AccentColorOption[] = [
  // --- Existing 4 (IDs preserved for backward compatibility) ---
  {
    id: 'teal',
    name: 'Professional Teal',
    hex: '#0f766e',
    hover: '#0d9488',
    active: '#115e59',
    tint50: '#f0fdfa',
    tint100: '#ccfbf1',
    bg: 'bg-teal-700',
  },
  {
    id: 'green',
    name: 'Forest Green',
    hex: '#15803d',
    hover: '#16a34a',
    active: '#166534',
    tint50: '#f0fdf4',
    tint100: '#dcfce7',
    bg: 'bg-green-700',
  },
  {
    id: 'orange',
    name: 'Warm Amber',
    hex: '#b45309',
    hover: '#d97706',
    active: '#92400e',
    tint50: '#fffbeb',
    tint100: '#fef3c7',
    bg: 'bg-amber-700',
  },
  {
    id: 'slate',
    name: 'Graphite Slate',
    hex: '#475569',
    hover: '#64748b',
    active: '#334155',
    tint50: '#f8fafc',
    tint100: '#f1f5f9',
    bg: 'bg-slate-600',
  },
  // --- 6 New Industry Standard Colors ---
  {
    id: 'sky',
    name: 'Ocean Cyan',
    hex: '#0369a1',
    hover: '#0284c7',
    active: '#075985',
    tint50: '#f0f9ff',
    tint100: '#e0f2fe',
    bg: 'bg-sky-700',
  },
  {
    id: 'blue',
    name: 'Royal Blue',
    hex: '#1d4ed8',
    hover: '#2563eb',
    active: '#1e40af',
    tint50: '#eff6ff',
    tint100: '#dbeafe',
    bg: 'bg-blue-700',
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    hex: '#4338ca',
    hover: '#4f46e5',
    active: '#3730a3',
    tint50: '#eef2ff',
    tint100: '#e0e7ff',
    bg: 'bg-indigo-700',
  },
  {
    id: 'violet',
    name: 'Violet',
    hex: '#6d28d9',
    hover: '#7c3aed',
    active: '#5b21b6',
    tint50: '#f5f3ff',
    tint100: '#ede9fe',
    bg: 'bg-violet-700',
  },
  {
    id: 'fuchsia',
    name: 'Magenta',
    hex: '#a21caf',
    hover: '#c026d3',
    active: '#86198f',
    tint50: '#fdf4ff',
    tint100: '#fae8ff',
    bg: 'bg-fuchsia-700',
  },
  {
    id: 'rose',
    name: 'Crimson Rose',
    hex: '#be123c',
    hover: '#e11d48',
    active: '#9f1239',
    tint50: '#fff1f2',
    tint100: '#ffe4e6',
    bg: 'bg-rose-700',
  },
];
