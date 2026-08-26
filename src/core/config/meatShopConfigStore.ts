import { create } from 'zustand';

export interface GoatPartConfig {
  id: string;
  name: string;
  defaultPercentage: number; // percentage of live goat weight
  defaultWeightKg: number;   // fallback for a standard ~12kg goat
  category: 'meat' | 'offal' | 'bone' | 'waste';
}

export interface MeatShopConfig {
  // Chicken Ratios (kg live needed per 1 kg dressed meat)
  chickenWholeRatio: number;      // default: 1.60
  chickenBonelessRatio: number;   // default: 1.90

  // Goat Yield Config
  goatLiveToDressedPercent: number; // default: 58% (approx 1.72 ratio)
  goatParts: GoatPartConfig[];

  // Methods
  setChickenWholeRatio: (val: number) => void;
  setChickenBonelessRatio: (val: number) => void;
  setGoatLiveToDressedPercent: (val: number) => void;
  updateGoatPart: (id: string, updates: Partial<GoatPartConfig>) => void;
  resetToDefaults: () => void;
}

const DEFAULT_GOAT_PARTS: GoatPartConfig[] = [
  { id: 'curry_cut', name: 'Mutton Curry Cut / Mixed Meat', defaultPercentage: 35.0, defaultWeightKg: 4.20, category: 'meat' },
  { id: 'boneless', name: 'Mutton Boneless', defaultPercentage: 15.0, defaultWeightKg: 1.80, category: 'meat' },
  { id: 'head', name: 'Head (Thala Kari)', defaultPercentage: 9.0, defaultWeightKg: 1.10, category: 'meat' },
  { id: 'legs', name: 'Legs / Paya (4 pcs)', defaultPercentage: 12.0, defaultWeightKg: 1.45, category: 'bone' },
  { id: 'liver', name: 'Liver (Eeral)', defaultPercentage: 3.5, defaultWeightKg: 0.42, category: 'offal' },
  { id: 'brain', name: 'Brain (Moolai)', defaultPercentage: 1.2, defaultWeightKg: 0.14, category: 'offal' },
  { id: 'boti_tripe', name: 'Boti / Tripe / Intestines', defaultPercentage: 6.5, defaultWeightKg: 0.78, category: 'offal' },
  { id: 'spleen', name: 'Spleen (Suvarothi)', defaultPercentage: 1.0, defaultWeightKg: 0.12, category: 'offal' },
  { id: 'lungs', name: 'Lungs (Nool Eeral)', defaultPercentage: 2.8, defaultWeightKg: 0.34, category: 'offal' },
  { id: 'blood', name: 'Blood (Rathnam)', defaultPercentage: 4.0, defaultWeightKg: 0.48, category: 'offal' },
  { id: 'soup_bones', name: 'Soup Bones', defaultPercentage: 10.0, defaultWeightKg: 1.20, category: 'bone' },
];

const STORAGE_KEY = 'meat_shop_ratios_config_v1';

interface StoredConfigData {
  chickenWholeRatio?: number;
  chickenBonelessRatio?: number;
  goatLiveToDressedPercent?: number;
  goatParts?: GoatPartConfig[];
}

const loadStoredConfig = (): StoredConfigData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load meat shop ratios config:', e);
  }
  return {};
};

const saveConfig = (data: StoredConfigData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save meat shop ratios config:', e);
  }
};

const initialStored = loadStoredConfig();

export const useMeatShopConfigStore = create<MeatShopConfig>((set, get) => ({
  chickenWholeRatio: initialStored.chickenWholeRatio ?? 1.6,
  chickenBonelessRatio: initialStored.chickenBonelessRatio ?? 1.9,
  goatLiveToDressedPercent: initialStored.goatLiveToDressedPercent ?? 58.0,
  goatParts: initialStored.goatParts && initialStored.goatParts.length > 0 ? initialStored.goatParts : DEFAULT_GOAT_PARTS,

  setChickenWholeRatio: (val: number) => {
    const validVal = isNaN(val) || val <= 0 ? 1.6 : parseFloat(val.toFixed(2));
    set({ chickenWholeRatio: validVal });
    saveConfig({
      chickenWholeRatio: validVal,
      chickenBonelessRatio: get().chickenBonelessRatio,
      goatLiveToDressedPercent: get().goatLiveToDressedPercent,
      goatParts: get().goatParts,
    });
  },

  setChickenBonelessRatio: (val: number) => {
    const validVal = isNaN(val) || val <= 0 ? 1.9 : parseFloat(val.toFixed(2));
    set({ chickenBonelessRatio: validVal });
    saveConfig({
      chickenWholeRatio: get().chickenWholeRatio,
      chickenBonelessRatio: validVal,
      goatLiveToDressedPercent: get().goatLiveToDressedPercent,
      goatParts: get().goatParts,
    });
  },

  setGoatLiveToDressedPercent: (val: number) => {
    const validVal = isNaN(val) || val <= 0 ? 58.0 : parseFloat(val.toFixed(1));
    set({ goatLiveToDressedPercent: validVal });
    saveConfig({
      chickenWholeRatio: get().chickenWholeRatio,
      chickenBonelessRatio: get().chickenBonelessRatio,
      goatLiveToDressedPercent: validVal,
      goatParts: get().goatParts,
    });
  },

  updateGoatPart: (id: string, updates: Partial<GoatPartConfig>) => {
    const updatedParts = get().goatParts.map(p => (p.id === id ? { ...p, ...updates } : p));
    set({ goatParts: updatedParts });
    saveConfig({
      chickenWholeRatio: get().chickenWholeRatio,
      chickenBonelessRatio: get().chickenBonelessRatio,
      goatLiveToDressedPercent: get().goatLiveToDressedPercent,
      goatParts: updatedParts,
    });
  },

  resetToDefaults: () => {
    set({
      chickenWholeRatio: 1.6,
      chickenBonelessRatio: 1.9,
      goatLiveToDressedPercent: 58.0,
      goatParts: DEFAULT_GOAT_PARTS,
    });
    saveConfig({
      chickenWholeRatio: 1.6,
      chickenBonelessRatio: 1.9,
      goatLiveToDressedPercent: 58.0,
      goatParts: DEFAULT_GOAT_PARTS,
    });
  },
}));
