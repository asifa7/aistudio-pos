import { create } from 'zustand';

export interface POSShortcuts {
  checkout: string; // Default: 'Space'
  cash: string;     // Default: 'c'
  upi: string;      // Default: 'v'
  card: string;     // Default: 'b'
  split: string;    // Default: 'n'
  credit: string;   // Default: 'r'
}

export const DEFAULT_POS_SHORTCUTS: POSShortcuts = {
  checkout: 'Space',
  cash: 'c',
  upi: 'v',
  card: 'b',
  split: 'n',
  credit: 'r',
};

const STORAGE_KEY = 'pos_keyboard_shortcuts';

const getStoredShortcuts = (): POSShortcuts => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_POS_SHORTCUTS,
        ...parsed,
      };
    }
  } catch {}
  return { ...DEFAULT_POS_SHORTCUTS };
};

interface POSShortcutsStore {
  shortcuts: POSShortcuts;
  updateShortcut: (action: keyof POSShortcuts, key: string) => void;
  setAllShortcuts: (shortcuts: POSShortcuts) => void;
  resetShortcuts: () => void;
}

export const usePOSShortcutsStore = create<POSShortcutsStore>((set) => ({
  shortcuts: getStoredShortcuts(),

  updateShortcut: (action, key) => {
    set((state) => {
      const updated = { ...state.shortcuts, [action]: key };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return { shortcuts: updated };
    });
  },

  setAllShortcuts: (shortcuts) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    } catch {}
    set({ shortcuts });
  },

  resetShortcuts: () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_POS_SHORTCUTS));
    } catch {}
    set({ shortcuts: { ...DEFAULT_POS_SHORTCUTS } });
  },
}));

/**
 * Checks if a keyboard event matches a configured shortcut key
 */
export function isKeyMatch(event: KeyboardEvent, targetKey: string): boolean {
  if (!targetKey) return false;
  const normTarget = targetKey.trim().toLowerCase();
  const eventKey = (event.key || '').toLowerCase();
  const eventCode = (event.code || '').toLowerCase();

  // Spacebar matching
  if (normTarget === 'space' || normTarget === ' ' || normTarget === 'spacebar') {
    return event.code === 'Space' || event.key === ' ' || event.keyCode === 32;
  }

  // Enter / Return matching
  if (normTarget === 'enter' || normTarget === 'return') {
    return event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter';
  }

  // Tab matching
  if (normTarget === 'tab') {
    return event.key === 'Tab';
  }

  // Escape matching
  if (normTarget === 'escape' || normTarget === 'esc') {
    return event.key === 'Escape';
  }

  // Function keys (F1 - F12)
  if (normTarget.startsWith('f') && !isNaN(Number(normTarget.slice(1)))) {
    return eventKey === normTarget || eventCode === normTarget;
  }

  // Direct single character or key match
  return eventKey === normTarget;
}

/**
 * Formats a key name for clear, user-friendly UI display
 */
export function formatKeyLabel(key: string): string {
  if (!key) return '';
  const lower = key.trim().toLowerCase();
  if (lower === 'space' || lower === ' ' || lower === 'spacebar') return 'Space';
  if (lower === 'enter') return 'Enter';
  if (lower === 'tab') return 'Tab';
  if (lower === 'escape' || lower === 'esc') return 'Esc';
  if (lower.startsWith('f') && !isNaN(Number(lower.slice(1)))) {
    return lower.toUpperCase();
  }
  return key.toUpperCase();
}
