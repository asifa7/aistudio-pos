import { useState } from 'react';
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import { useAppearance, ACCENT_COLORS } from '../../../../core/theme/AppearanceContext';

export default function POSAppearanceSettings() {
  const { config, updateConfig } = useAppearance();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    updateConfig(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const selectedAccentHex = ACCENT_COLORS.find(c => c.id === config.accentColor)?.hex || '#0f766e';

  return (
    <div className="bg-surface-app text-text-primary h-full overflow-y-auto p-6 space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle pb-4 gap-3">
        <div>
          <h2 className="text-2xl font-black font-outfit text-text-primary flex items-center gap-2">
            <Palette className="text-brand-500" size={24} />
            <span>Customise your POS Appearance</span>
          </h2>
          <p className="text-text-muted text-xs mt-1">
            Personalize layout density, tile dimensions, dark/light themes, and color palettes across the application.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Interactive Mockup Screen */}
        <div className="lg:col-span-7 bg-surface-panel border border-border-subtle rounded-2xl p-5 shadow-elevation space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-muted flex items-center gap-2">
              <span>Live POS Window Preview</span>
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-surface-card border border-border-subtle text-text-secondary">
              Theme: {config.mode.toUpperCase()} · Accent: {config.accentColor.toUpperCase()} · Cart: {config.cartDisplay.toUpperCase()}
            </span>
          </div>

          {/* Interactive Live Mockup Box */}
          <div className="border border-border-subtle rounded-xl overflow-hidden bg-surface-card shadow-2xl transition-all">
            {/* Top POS Titlebar */}
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800" style={{ backgroundColor: selectedAccentHex }}>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight font-outfit">Zoho POS</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">v3.0</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/60" />
              </div>
            </div>

            {/* Mock View Body */}
            <div className="p-4 grid grid-cols-12 gap-3 min-h-[320px] bg-surface-app">
              {/* Mock Cart Column (Left) */}
              <div className="col-span-7 bg-surface-panel border border-border-subtle rounded-lg p-3 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-bold border-b border-border-subtle pb-2">
                  <span>Cart Items ({config.cartDisplay})</span>
                  <span className="font-mono text-[10px] text-text-muted">2 items</span>
                </div>

                <div className="space-y-2">
                  {config.cartDisplay === 'detailed' && (
                    <>
                      <div className="p-2 rounded bg-surface-card border border-border-subtle flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-text-primary text-[11px]">Chicken Boneless (Breast)</p>
                          <p className="text-[9px] text-text-muted font-mono">1.000 kg @ ₹350.00/kg · [Detailed View]</p>
                        </div>
                        <span className="font-mono font-bold text-brand-500">₹350.00</span>
                      </div>
                      <div className="p-2 rounded bg-surface-card border border-border-subtle flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-text-primary text-[11px]">Chicken Curry Cut (Large)</p>
                          <p className="text-[9px] text-text-muted font-mono">1.000 kg @ ₹320.00/kg · [Detailed View]</p>
                        </div>
                        <span className="font-mono font-bold text-brand-500">₹320.00</span>
                      </div>
                    </>
                  )}

                  {config.cartDisplay === 'comfort' && (
                    <>
                      <div className="p-1.5 rounded bg-surface-card border border-border-subtle flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-text-primary text-[11px]">Chicken Boneless</p>
                          <p className="text-[9px] text-text-muted font-mono">1 kg @ ₹350.00</p>
                        </div>
                        <span className="font-mono font-bold text-brand-500">₹350.00</span>
                      </div>
                      <div className="p-1.5 rounded bg-surface-card border border-border-subtle flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-text-primary text-[11px]">Chicken Curry Cut</p>
                          <p className="text-[9px] text-text-muted font-mono">1 kg @ ₹320.00</p>
                        </div>
                        <span className="font-mono font-bold text-brand-500">₹320.00</span>
                      </div>
                    </>
                  )}

                  {config.cartDisplay === 'compact' && (
                    <>
                      <div className="px-2 py-1 rounded bg-surface-card border border-border-subtle flex justify-between items-center text-[10px] font-mono font-bold">
                        <span className="truncate">Chicken Boneless (1kg)</span>
                        <span className="text-brand-500">₹350.00</span>
                      </div>
                      <div className="px-2 py-1 rounded bg-surface-card border border-border-subtle flex justify-between items-center text-[10px] font-mono font-bold">
                        <span className="truncate">Chicken Curry Cut (1kg)</span>
                        <span className="text-brand-500">₹320.00</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-border-subtle flex justify-between items-center text-xs font-extrabold">
                  <span>Net Amount:</span>
                  <span className="font-mono text-sm" style={{ color: selectedAccentHex }}>₹670.00</span>
                </div>
              </div>

              {/* Mock Tiles Catalog Grid (Right) */}
              <div className="col-span-5 bg-surface-panel border border-border-subtle rounded-lg p-3 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-text-muted mb-2">Catalog Grid ({config.tileSize})</p>
                  <div className={`grid gap-1.5 ${
                    config.tileSize === 'small' ? 'grid-cols-3' : config.tileSize === 'large' ? 'grid-cols-1' : 'grid-cols-2'
                  }`}>
                    {[1, 2, 3, 4].map(n => (
                      <div
                        key={n}
                        className="p-2 rounded bg-surface-card border border-border-subtle text-center text-[9px] font-bold text-text-secondary hover:border-brand-500 transition-colors"
                      >
                        Item #{n}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  className="w-full py-1.5 rounded text-xs font-bold text-white shadow-subtle transition-all mt-2"
                  style={{ backgroundColor: selectedAccentHex }}
                >
                  Pay Bill Now
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customization Controls Form */}
        <div className="lg:col-span-5 bg-surface-panel border border-border-subtle rounded-2xl p-6 space-y-6 shadow-elevation">
          {/* 1. Layout type */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-text-primary uppercase tracking-wider">Layout type</label>
            <div className="flex items-center gap-6 text-xs font-bold text-text-secondary pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="layoutType"
                  value="classic"
                  checked={config.layoutType === 'classic'}
                  onChange={() => updateConfig({ layoutType: 'classic' })}
                  className="w-4 h-4 text-brand-500 focus:ring-brand-500 accent-brand-500 cursor-pointer"
                />
                <span>Classic</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="layoutType"
                  value="touch"
                  checked={config.layoutType === 'touch'}
                  onChange={() => updateConfig({ layoutType: 'touch' })}
                  className="w-4 h-4 text-brand-500 focus:ring-brand-500 accent-brand-500 cursor-pointer"
                />
                <span>Touch</span>
              </label>
            </div>
          </div>

          {/* 2. Item's tile size */}
          <div className="space-y-2 pt-2 border-t border-border-subtle/60">
            <label className="text-xs font-extrabold text-text-primary uppercase tracking-wider">Item's tile size</label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(['small', 'medium', 'large'] as const).map(size => {
                const isSelected = config.tileSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => updateConfig({ tileSize: size })}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-surface-card border-brand-500 ring-2 ring-brand-500/50 text-text-primary shadow-subtle'
                        : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <div className="w-full bg-surface-app border border-border-subtle rounded p-1.5 flex gap-1 justify-center">
                      <div className="w-2 h-2 rounded bg-border-subtle" />
                      <div className="w-2 h-2 rounded bg-border-subtle" />
                    </div>
                    <span className="text-xs font-extrabold capitalize">{size}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Cart display */}
          <div className="space-y-2 pt-2 border-t border-border-subtle/60">
            <label className="text-xs font-extrabold text-text-primary uppercase tracking-wider">Cart display</label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(['detailed', 'comfort', 'compact'] as const).map(mode => {
                const isSelected = config.cartDisplay === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateConfig({ cartDisplay: mode })}
                    className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-surface-card border-brand-500 ring-2 ring-brand-500/50 text-text-primary shadow-subtle'
                        : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <div className="w-full bg-surface-app border border-border-subtle rounded p-1.5 space-y-1">
                      <div className="w-full h-1 bg-border-subtle rounded" />
                      <div className="w-3/4 h-1 bg-border-subtle rounded" />
                    </div>
                    <span className="text-xs font-extrabold capitalize">{mode}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Mode (Theme Mode) */}
          <div className="space-y-2 pt-2 border-t border-border-subtle/60">
            <label className="text-xs font-extrabold text-text-primary uppercase tracking-wider">Mode</label>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => updateConfig({ mode: 'light' })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  config.mode === 'light'
                    ? 'bg-white text-slate-900 border-slate-300 ring-2 ring-brand-500 shadow-subtle font-extrabold'
                    : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                <Sun size={14} /> Light
              </button>

              <button
                type="button"
                onClick={() => updateConfig({ mode: 'dark' })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  config.mode === 'dark'
                    ? 'bg-slate-950 text-brand-500 border-brand-500 ring-2 ring-brand-500 shadow-subtle font-extrabold'
                    : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                <Moon size={14} /> Dark
              </button>

              <button
                type="button"
                onClick={() => updateConfig({ mode: 'system' })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  config.mode === 'system'
                    ? 'bg-surface-card border-brand-500 ring-2 ring-brand-500 text-text-primary shadow-subtle font-extrabold'
                    : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                <Monitor size={14} /> System
              </button>
            </div>
          </div>

          {/* 5. Accent color */}
          <div className="space-y-2 pt-2 border-t border-border-subtle/60">
            <label className="text-xs font-extrabold text-text-primary uppercase tracking-wider">Accent color</label>
            <div className="flex items-center gap-3 pt-1">
              {ACCENT_COLORS.map(color => {
                const isSelected = config.accentColor === color.id;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => updateConfig({ accentColor: color.id })}
                    className={`w-8 h-8 rounded-full ${color.bg} transition-all flex items-center justify-center text-white ${
                      isSelected ? 'ring-4 ring-offset-2 ring-offset-surface-panel ring-brand-500 scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    title={color.name}
                  >
                    {isSelected && <Check size={16} className="stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save / Apply Button */}
          <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-xs font-bold text-brand-500 flex items-center gap-1">
                <Check size={14} /> Settings Saved & Applied!
              </span>
            ) : (
              <span className="text-[11px] text-text-muted font-medium">Changes apply immediately across software</span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary px-6 py-2.5 text-xs font-black shadow-elevation transition-all"
            >
              Save Appearance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
