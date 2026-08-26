import { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, X, GripHorizontal, ArrowUpDown, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { useMeatShopConfigStore } from '../../../../core/config/meatShopConfigStore';

type CalcTab = 'basic' | 'yield';
type YieldSubMode = 'single' | 'combined';
type SingleYieldMode = 'whole' | 'boneless';
type YieldDirection = 'live_to_meat' | 'meat_to_live';

export default function WastageCalculatorWidget() {
  const [isOpen, setIsOpen] = useState(false);

  // Meat config ratios from central store
  const {
    chickenWholeRatio,
    chickenBonelessRatio,
    setChickenWholeRatio,
    setChickenBonelessRatio,
  } = useMeatShopConfigStore();

  // Compute default bottom-right anchor position
  const getAnchorPosition = () => {
    if (typeof window === 'undefined') return { x: 800, y: 400 };
    return {
      x: Math.max(16, window.innerWidth - 350),
      y: Math.max(16, window.innerHeight - 520),
    };
  };

  const [position, setPosition] = useState(getAnchorPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Tabs: 'basic' (Left, default) or 'yield' (Right)
  const [tab, setTab] = useState<CalcTab>('basic');

  // Yield Sub-mode: 'single' or 'combined'
  const [yieldSubMode, setYieldSubMode] = useState<YieldSubMode>('single');
  const [showRatioSettings, setShowRatioSettings] = useState(false);

  // Single Mode State
  const [singleMode, setSingleMode] = useState<SingleYieldMode>('whole');
  const [direction, setDirection] = useState<YieldDirection>('live_to_meat');
  const [liveWeightInput, setLiveWeightInput] = useState<string>('1.6');
  const [meatWeightInput, setMeatWeightInput] = useState<string>('1.000');

  // Combined Mode State (Whole Chicken + Boneless combined)
  const [combinedDirection, setCombinedDirection] = useState<YieldDirection>('meat_to_live');
  const [combinedWholeMeatKg, setCombinedWholeMeatKg] = useState<string>('1.000');
  const [combinedBonelessMeatKg, setCombinedBonelessMeatKg] = useState<string>('0.500');
  const [combinedLiveInputKg, setCombinedLiveInputKg] = useState<string>('3.000');
  const [combinedWholeLiveSplitPercent, setCombinedWholeLiveSplitPercent] = useState<string>('60');

  // Ratio editing state
  const [tempWholeRatio, setTempWholeRatio] = useState(chickenWholeRatio.toString());
  const [tempBonelessRatio, setTempBonelessRatio] = useState(chickenBonelessRatio.toString());

  useEffect(() => {
    setTempWholeRatio(chickenWholeRatio.toString());
    setTempBonelessRatio(chickenBonelessRatio.toString());
  }, [chickenWholeRatio, chickenBonelessRatio, showRatioSettings]);

  const handleSaveRatios = () => {
    const w = parseFloat(tempWholeRatio);
    const b = parseFloat(tempBonelessRatio);
    if (!isNaN(w) && w > 0) setChickenWholeRatio(w);
    if (!isNaN(b) && b > 0) setChickenBonelessRatio(b);
    setShowRatioSettings(false);
  };

  // Basic Calc State
  const [calcDisplay, setCalcDisplay] = useState('');

  // Active ratio for single mode
  const activeSingleRatio = singleMode === 'whole' ? chickenWholeRatio : chickenBonelessRatio;

  // Single Calculations
  const liveNum = parseFloat(liveWeightInput) || 0;
  const meatNum = parseFloat(meatWeightInput) || 0;

  let singleYieldKg = 0;
  let singleLiveNeededKg = 0;
  let singleWastageKg = 0;
  let singleWastagePercent = 0;

  if (direction === 'live_to_meat') {
    if (liveNum > 0 && activeSingleRatio > 0) {
      singleYieldKg = liveNum / activeSingleRatio;
      singleWastageKg = Math.max(0, liveNum - singleYieldKg);
      singleWastagePercent = (singleWastageKg / liveNum) * 100;
    }
  } else {
    if (meatNum > 0 && activeSingleRatio > 0) {
      singleLiveNeededKg = meatNum * activeSingleRatio;
      singleWastageKg = Math.max(0, singleLiveNeededKg - meatNum);
      singleWastagePercent = (singleWastageKg / singleLiveNeededKg) * 100;
    }
  }

  // Combined Calculations
  const combinedWholeNum = parseFloat(combinedWholeMeatKg) || 0;
  const combinedBonelessNum = parseFloat(combinedBonelessMeatKg) || 0;
  const combinedLiveNum = parseFloat(combinedLiveInputKg) || 0;
  const wholeSplitPct = Math.min(100, Math.max(0, parseFloat(combinedWholeLiveSplitPercent) || 60));
  const bonelessSplitPct = 100 - wholeSplitPct;

  // Combined Meat Desired -> Live Needed
  const combinedWholeLiveNeeded = combinedWholeNum * (chickenWholeRatio > 0 ? chickenWholeRatio : 1.6);
  const combinedBonelessLiveNeeded = combinedBonelessNum * (chickenBonelessRatio > 0 ? chickenBonelessRatio : 1.9);
  const totalCombinedLiveNeeded = combinedWholeLiveNeeded + combinedBonelessLiveNeeded;
  const totalCombinedMeatYield = combinedWholeNum + combinedBonelessNum;
  const totalCombinedWastage = Math.max(0, totalCombinedLiveNeeded - totalCombinedMeatYield);
  const totalCombinedWastagePercent = totalCombinedLiveNeeded > 0 ? (totalCombinedWastage / totalCombinedLiveNeeded) * 100 : 0;

  // Combined Live Available -> Meat Yield
  const liveForWhole = (combinedLiveNum * wholeSplitPct) / 100;
  const liveForBoneless = (combinedLiveNum * bonelessSplitPct) / 100;
  const yieldFromWhole = chickenWholeRatio > 0 ? liveForWhole / chickenWholeRatio : 0;
  const yieldFromBoneless = chickenBonelessRatio > 0 ? liveForBoneless / chickenBonelessRatio : 0;
  const totalLiveYieldMeat = yieldFromWhole + yieldFromBoneless;
  const totalLiveCombinedWastage = Math.max(0, combinedLiveNum - totalLiveYieldMeat);
  const totalLiveCombinedWastagePct = combinedLiveNum > 0 ? (totalLiveCombinedWastage / combinedLiveNum) * 100 : 0;

  // Handle single mode live weight typing
  const handleLiveWeightChange = (val: string) => {
    setLiveWeightInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && activeSingleRatio > 0) {
      setMeatWeightInput((num / activeSingleRatio).toFixed(3));
    }
  };

  // Handle single mode target meat typing
  const handleMeatWeightChange = (val: string) => {
    setMeatWeightInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && activeSingleRatio > 0) {
      setLiveWeightInput((num * activeSingleRatio).toFixed(3));
    }
  };

  const handleToggleSingleMode = (mode: SingleYieldMode) => {
    setSingleMode(mode);
    const ratio = mode === 'whole' ? chickenWholeRatio : chickenBonelessRatio;
    if (direction === 'live_to_meat') {
      const live = parseFloat(liveWeightInput);
      if (!isNaN(live) && live > 0 && ratio > 0) {
        setMeatWeightInput((live / ratio).toFixed(3));
      }
    } else {
      const meat = parseFloat(meatWeightInput);
      if (!isNaN(meat) && meat > 0 && ratio > 0) {
        setLiveWeightInput((meat * ratio).toFixed(3));
      }
    }
  };

  const handleToggleDirection = () => {
    setDirection(prev => (prev === 'live_to_meat' ? 'meat_to_live' : 'live_to_meat'));
  };

  const handleToggleCombinedDirection = () => {
    setCombinedDirection(prev => (prev === 'live_to_meat' ? 'meat_to_live' : 'live_to_meat'));
  };

  // Keep anchored on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.max(10, Math.min(window.innerWidth - 350, prev.x)),
        y: Math.max(10, Math.min(window.innerHeight - 500, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dragging logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 350, dragRef.current.initialX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 500, dragRef.current.initialY + dy)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Safe arithmetic evaluator for basic calculator
  const evaluateExpression = (expr: string): string => {
    if (!expr || expr.trim() === '' || expr === 'Error') return '0';
    const sanitized = expr.trim().replace(/[*+\-/]+$/, '');
    if (!sanitized) return '0';
    if (!/^[0-9+\-*/. ]+$/.test(sanitized)) return 'Error';
    try {
      const fn = new Function(`return (${sanitized})`);
      const res = fn();
      if (typeof res !== 'number' || !isFinite(res)) return 'Error';
      const rounded = parseFloat(res.toFixed(8));
      return String(rounded);
    } catch {
      return 'Error';
    }
  };

  const handleCalcInput = useCallback((val: string) => {
    setCalcDisplay(prev => {
      if (val === 'C') return '';
      if (val === '⌫') {
        if (prev === 'Error' || prev.length <= 1) return '';
        return prev.slice(0, -1);
      }
      if (val === '=') return evaluateExpression(prev);
      if (prev === 'Error') {
        if (['+', '-', '*', '/'].includes(val)) return '0' + val;
        return val === '.' ? '0.' : val;
      }
      if (['+', '-', '*', '/'].includes(val)) {
        if (prev === '') return val === '-' ? '-' : '';
        const lastChar = prev.slice(-1);
        if (['+', '-', '*', '/'].includes(lastChar)) {
          return prev.slice(0, -1) + val;
        }
        return prev + val;
      }
      if (val === '.') {
        if (prev === '') return '0.';
        const tokens = prev.split(/[+\-*/]/);
        const currentToken = tokens[tokens.length - 1];
        if (currentToken.includes('.')) return prev;
        return prev + '.';
      }
      return prev + val;
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement;
      const isInsideWidget = widgetRef.current?.contains(el);

      if (tab === 'basic') {
        if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && !isInsideWidget) {
          return;
        }
        const key = e.key;
        if (/^[0-9]$/.test(key) || ['+', '-', '*', '/'].includes(key) || key === '.') {
          e.preventDefault();
          handleCalcInput(key);
        } else if (key === 'Backspace') {
          e.preventDefault();
          handleCalcInput('⌫');
        } else if (key === 'Enter' || key === '=') {
          e.preventDefault();
          handleCalcInput('=');
        } else if (key === 'Escape' || key.toLowerCase() === 'c') {
          e.preventDefault();
          handleCalcInput('C');
        }
      } else if (tab === 'yield') {
        if (e.key === 'Escape') {
          if (direction === 'live_to_meat') setLiveWeightInput('');
          else setMeatWeightInput('');
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, tab, direction, handleCalcInput]);

  if (!isOpen) {
    return (
      <button
        id="btn-open-wastage-calc"
        onClick={() => {
          setPosition(getAnchorPosition());
          setIsOpen(true);
        }}
        className="fixed bottom-8 right-5 p-3 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-elevation hover:scale-105 transition-all z-40 flex items-center justify-center group"
        title="Calculator & Live Bird Yield Estimator"
      >
        <Calculator size={20} />
      </button>
    );
  }

  return (
    <div
      id="wastage-calculator-widget"
      ref={widgetRef}
      className="fixed z-50 bg-surface-panel border border-border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col w-[350px]"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Header / Drag Handle */}
      <div
        className="bg-brand-500 text-white p-2.5 flex items-center justify-between cursor-move select-none"
        onMouseDown={e => {
          setIsDragging(true);
          dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: position.x, initialY: position.y };
        }}
      >
        <div className="flex items-center gap-2 font-extrabold text-xs">
          <GripHorizontal size={15} className="opacity-80" />
          <span>Shop Calculator & Meat Yield</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-black/20 p-1 rounded-lg transition-colors"
          title="Close Calculator"
        >
          <X size={15} />
        </button>
      </div>

      {/* Primary Tabs (Standard Calc on LEFT, Meat Yield on RIGHT) */}
      <div className="flex border-b border-border-subtle bg-surface-app">
        <button
          id="calc-tab-basic"
          onClick={() => setTab('basic')}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${
            tab === 'basic'
              ? 'border-b-2 border-brand-500 text-brand-500 bg-surface-panel'
              : 'text-text-muted hover:bg-surface-hover'
          }`}
        >
          Standard Calc
        </button>
        <button
          id="calc-tab-yield"
          onClick={() => setTab('yield')}
          className={`flex-1 py-2 text-xs font-bold transition-colors ${
            tab === 'yield'
              ? 'border-b-2 border-brand-500 text-brand-500 bg-surface-panel'
              : 'text-text-muted hover:bg-surface-hover'
          }`}
        >
          Meat Yield (Live ➔ Cut)
        </button>
      </div>

      {/* Content Area */}
      <div className="p-3.5 bg-surface-app">
        {tab === 'basic' ? (
          <div className="space-y-2">
            <div className="bg-surface-panel border border-border-subtle rounded-xl px-3 py-2.5 text-right text-lg font-mono min-h-[44px] overflow-x-auto whitespace-nowrap scrollbar-hide text-text-primary font-bold">
              {calcDisplay || '0'}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {['7', '8', '9', '/'].map(btn => (
                <button
                  key={btn}
                  onClick={() => handleCalcInput(btn)}
                  className="bg-surface-card hover:bg-surface-hover active:scale-95 border border-border-subtle rounded-lg py-2 font-bold text-text-primary text-xs transition-all"
                >
                  {btn}
                </button>
              ))}
              {['4', '5', '6', '*'].map(btn => (
                <button
                  key={btn}
                  onClick={() => handleCalcInput(btn)}
                  className="bg-surface-card hover:bg-surface-hover active:scale-95 border border-border-subtle rounded-lg py-2 font-bold text-text-primary text-xs transition-all"
                >
                  {btn}
                </button>
              ))}
              {['1', '2', '3', '-'].map(btn => (
                <button
                  key={btn}
                  onClick={() => handleCalcInput(btn)}
                  className="bg-surface-card hover:bg-surface-hover active:scale-95 border border-border-subtle rounded-lg py-2 font-bold text-text-primary text-xs transition-all"
                >
                  {btn}
                </button>
              ))}
              {['C', '0', '.', '+'].map(btn => (
                <button
                  key={btn}
                  onClick={() => handleCalcInput(btn)}
                  className={`bg-surface-card hover:bg-surface-hover active:scale-95 border border-border-subtle rounded-lg py-2 font-bold text-xs transition-all ${
                    btn === 'C' ? 'text-red-400 font-extrabold' : 'text-text-primary'
                  }`}
                >
                  {btn}
                </button>
              ))}
              <button
                onClick={() => handleCalcInput('⌫')}
                className="col-span-2 bg-surface-card hover:bg-surface-hover active:scale-95 border border-border-subtle rounded-lg py-2 font-bold text-amber-400 text-xs transition-all"
              >
                ⌫ Backspace
              </button>
              <button
                onClick={() => handleCalcInput('=')}
                className="col-span-2 bg-brand-500 hover:bg-brand-600 active:scale-95 text-white rounded-lg py-2 font-black text-sm shadow-subtle transition-all"
              >
                =
              </button>
            </div>
            <p className="text-[8px] text-text-muted text-center mt-1 select-none">
              Keyboard: 0-9, +-*/, Enter (=), Esc/C (Clear)
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Sub-mode Header: Single vs Combined */}
            <div className="flex items-center justify-between">
              <div className="bg-surface-card p-0.5 rounded-lg border border-border-subtle flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setYieldSubMode('single');
                    setShowRatioSettings(false);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                    yieldSubMode === 'single'
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Single Item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setYieldSubMode('combined');
                    setShowRatioSettings(false);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
                    yieldSubMode === 'combined'
                      ? 'bg-brand-500 text-white shadow-xs'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <PlusCircle size={11} /> Combined Mix
                </button>
              </div>

              {/* Editable Ratios Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowRatioSettings(prev => !prev)}
                className={`p-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 ${
                  showRatioSettings
                    ? 'bg-brand-500/20 text-brand-400 border-brand-500/40'
                    : 'bg-surface-card text-text-muted hover:text-text-primary border-border-subtle'
                }`}
                title="Edit Chicken Whole & Boneless Ratios"
              >
                <SlidersHorizontal size={12} />
                <span className="text-[10px]">Ratios</span>
              </button>
            </div>

            {/* Inline Editable Ratio Inputs with Save Button */}
            {showRatioSettings && (
              <div className="bg-surface-card/90 border border-brand-500/40 rounded-xl p-3 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-brand-500 uppercase tracking-wider">
                    Edit Live Yield Ratios
                  </span>
                  <span className="text-[9px] text-text-muted">(kg Live / 1kg Meat)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9.5px] font-bold text-text-secondary mb-0.5">
                      Whole Chicken Ratio
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="3.0"
                      value={tempWholeRatio}
                      onChange={e => setTempWholeRatio(e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono font-bold text-text-primary focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-text-secondary mb-0.5">
                      Boneless Ratio
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="4.0"
                      value={tempBonelessRatio}
                      onChange={e => setTempBonelessRatio(e.target.value)}
                      className="w-full bg-surface-panel border border-border-subtle rounded-lg px-2 py-1 text-xs font-mono font-bold text-text-primary focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRatioSettings(false)}
                    className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-surface-panel border border-border-subtle text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRatios}
                    className="px-3 py-1 rounded-md text-[10px] font-bold bg-brand-500 hover:bg-brand-600 text-white shadow-xs"
                  >
                    Save Ratios
                  </button>
                </div>
              </div>
            )}

            {/* SINGLE ITEM MODE */}
            {yieldSubMode === 'single' ? (
              <div className="space-y-3">
                {/* Whole vs Boneless Selector */}
                <div className="bg-surface-card p-1 rounded-xl border border-border-subtle grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    id="yield-mode-whole"
                    onClick={() => handleToggleSingleMode('whole')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      singleMode === 'whole'
                        ? 'bg-brand-500 text-white shadow-subtle'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Whole ({chickenWholeRatio})
                  </button>
                  <button
                    type="button"
                    id="yield-mode-boneless"
                    onClick={() => handleToggleSingleMode('boneless')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      singleMode === 'boneless'
                        ? 'bg-brand-500 text-white shadow-subtle'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    Boneless ({chickenBonelessRatio})
                  </button>
                </div>

                {/* Direction Swap */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">
                    {direction === 'live_to_meat' ? 'Live ➔ Meat Yield' : 'Meat Desired ➔ Live Needed'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleDirection}
                    className="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 bg-brand-500/10 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <ArrowUpDown size={11} /> Flip
                  </button>
                </div>

                {direction === 'live_to_meat' ? (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Live Bird Weight (kg)
                      </label>
                      <input
                        id="input-live-weight"
                        type="number"
                        value={liveWeightInput}
                        onChange={e => handleLiveWeightChange(e.target.value)}
                        className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-sm font-bold text-text-primary font-mono outline-none focus:border-brand-500"
                        placeholder="e.g. 1.600"
                        step="0.001"
                        autoFocus
                      />
                    </div>

                    <div className="bg-surface-panel border border-brand-500/30 rounded-xl p-3 space-y-2 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-text-muted">Dressed Yield Weight:</span>
                        <span className="text-base font-extrabold text-brand-500 font-mono">
                          {singleYieldKg > 0 ? singleYieldKg.toFixed(2) : '0.00'} kg
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border-subtle/50 pt-1.5">
                        <span className="text-[10px] font-bold text-text-muted">Wastage Loss:</span>
                        <span className="text-xs font-bold text-rose-400 font-mono">
                          {singleWastageKg > 0 ? singleWastageKg.toFixed(2) : '0.00'} kg ({singleWastagePercent > 0 ? singleWastagePercent.toFixed(1) : '0.0'}%)
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">
                        Target Meat Weight (kg)
                      </label>
                      <input
                        id="input-target-meat"
                        type="number"
                        value={meatWeightInput}
                        onChange={e => handleMeatWeightChange(e.target.value)}
                        className="w-full bg-surface-panel border border-border-subtle rounded-xl px-3 py-1.5 text-sm font-bold text-text-primary font-mono outline-none focus:border-brand-500"
                        placeholder="e.g. 1.000"
                        step="0.001"
                        autoFocus
                      />
                    </div>

                    <div className="bg-surface-panel border border-brand-500/30 rounded-xl p-3 space-y-2 shadow-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-text-muted">Live Bird Required:</span>
                        <span className="text-base font-extrabold text-brand-500 font-mono">
                          {singleLiveNeededKg > 0 ? singleLiveNeededKg.toFixed(2) : '0.00'} kg
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border-subtle/50 pt-1.5">
                        <span className="text-[10px] font-bold text-text-muted">Estimated Wastage:</span>
                        <span className="text-xs font-bold text-rose-400 font-mono">
                          {singleWastageKg > 0 ? singleWastageKg.toFixed(2) : '0.00'} kg ({singleWastagePercent > 0 ? singleWastagePercent.toFixed(1) : '0.0'}%)
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* COMBINED MIX MODE (Whole + Boneless) with Flip */
              <div className="space-y-2.5">
                {/* Direction Flip Header */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-text-muted uppercase">
                    {combinedDirection === 'meat_to_live' ? 'Meat Desired ➔ Live Needed' : 'Live Available ➔ Meat Yield'}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleCombinedDirection}
                    className="text-[10px] font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1 bg-brand-500/10 px-2 py-0.5 rounded-md transition-colors"
                  >
                    <ArrowUpDown size={11} /> Flip
                  </button>
                </div>

                {combinedDirection === 'meat_to_live' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-text-secondary mb-1">
                          Whole Cut Meat (kg)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={combinedWholeMeatKg}
                          onChange={e => setCombinedWholeMeatKg(e.target.value)}
                          placeholder="e.g. 2.000"
                          className="w-full bg-surface-panel border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary focus:border-brand-500 outline-none"
                        />
                        <span className="text-[9px] text-text-muted block mt-0.5">
                          Needs: {combinedWholeLiveNeeded.toFixed(2)} kg live
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-text-secondary mb-1">
                          Boneless Meat (kg)
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          value={combinedBonelessMeatKg}
                          onChange={e => setCombinedBonelessMeatKg(e.target.value)}
                          placeholder="e.g. 1.000"
                          className="w-full bg-surface-panel border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary focus:border-brand-500 outline-none"
                        />
                        <span className="text-[9px] text-text-muted block mt-0.5">
                          Needs: {combinedBonelessLiveNeeded.toFixed(2)} kg live
                        </span>
                      </div>
                    </div>

                    {/* Combined Total Summary Card */}
                    <div className="bg-surface-panel border border-brand-500/40 rounded-xl p-3 space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-bold text-text-muted">Total Live Bird Required:</span>
                        <span className="text-base font-black text-brand-500 font-mono">
                          {totalCombinedLiveNeeded.toFixed(2)} kg
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary border-t border-border-subtle/50 pt-1">
                        <span>Total Meat Dressed Yield:</span>
                        <span className="font-mono text-emerald-400">{totalCombinedMeatYield.toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary">
                        <span>Total Combined Wastage:</span>
                        <span className="font-mono text-rose-400">
                          {totalCombinedWastage.toFixed(2)} kg ({totalCombinedWastagePercent.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-text-secondary mb-1">
                        Total Live Bird Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={combinedLiveInputKg}
                        onChange={e => setCombinedLiveInputKg(e.target.value)}
                        placeholder="e.g. 3.000"
                        className="w-full bg-surface-panel border border-border-subtle rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-text-primary focus:border-brand-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold text-text-muted">
                        <span>Whole Cut Live Allocation: {wholeSplitPct}%</span>
                        <span>Boneless: {bonelessSplitPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={combinedWholeLiveSplitPercent}
                        onChange={e => setCombinedWholeLiveSplitPercent(e.target.value)}
                        className="w-full accent-brand-500 cursor-pointer h-1.5 bg-surface-card rounded-lg"
                      />
                    </div>

                    {/* Combined Live Yield Summary Card */}
                    <div className="bg-surface-panel border border-brand-500/40 rounded-xl p-3 space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary">
                        <span>Whole Cut Yield ({liveForWhole.toFixed(2)}kg live):</span>
                        <span className="font-mono text-text-primary font-bold">{yieldFromWhole.toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary">
                        <span>Boneless Yield ({liveForBoneless.toFixed(2)}kg live):</span>
                        <span className="font-mono text-text-primary font-bold">{yieldFromBoneless.toFixed(2)} kg</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-border-subtle/50 pt-1">
                        <span className="text-[11px] font-bold text-text-muted">Total Dressed Yield:</span>
                        <span className="text-sm font-black text-brand-500 font-mono">
                          {totalLiveYieldMeat.toFixed(2)} kg
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary">
                        <span>Total Wastage Loss:</span>
                        <span className="font-mono text-rose-400">
                          {totalLiveCombinedWastage.toFixed(2)} kg ({totalLiveCombinedWastagePct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="text-[9px] text-text-muted text-center pt-1 border-t border-border-subtle/50">
              Ratios: Whole 1:{chickenWholeRatio} | Boneless 1:{chickenBonelessRatio}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

