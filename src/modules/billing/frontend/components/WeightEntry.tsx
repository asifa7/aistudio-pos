import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { calculateLineSubtotal } from '../types/billing.types';

interface WeightEntryProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (grams: number) => void;
  variantName: string;
  ratePaise: number;
}

export default function WeightEntry({ isOpen, onClose, onConfirm, variantName, ratePaise }: WeightEntryProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const gramsValue = parseInt(inputValue, 10) || 0;
  const kgDisplay = (gramsValue / 1000).toFixed(3);
  const lineSubtotal = calculateLineSubtotal('weight', gramsValue, null, ratePaise);
  const rupeesDisplay = (lineSubtotal / 100).toFixed(2);

  const handleKeyPress = (digit: string) => {
    if (digit === 'C') {
      setInputValue('');
      return;
    }
    if (digit === '⌫') {
      setInputValue(prev => prev.slice(0, -1));
      return;
    }
    if (inputValue.length >= 6) return;
    setInputValue(prev => prev + digit);
  };

  const handleConfirm = () => {
    if (gramsValue <= 0) return;
    onConfirm(gramsValue);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const padButtons = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', '⌫'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onKeyDown={handleKeyDown}>
      <div className="bg-surface-card rounded-xl shadow-elevation border border-border-subtle w-[380px] overflow-hidden">
        {/* Header */}
        <div className="bg-surface-panel px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
          <div>
            <p className="text-text-primary font-bold text-sm">{variantName}</p>
            <p className="text-brand-500 text-[10px]">Rate: ₹{(ratePaise / 100).toFixed(2)}/kg</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Display Area */}
        <div className="p-5 space-y-3">
          <div className="bg-surface-panel rounded-lg p-4 border border-border-subtle">
            <label className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Weight in Grams</label>
            <input
              ref={inputRef}
              type="text"
              readOnly
              value={inputValue || '0'}
              className="w-full text-right text-3xl font-bold font-mono bg-transparent border-none outline-none text-text-primary mt-1"
              onKeyDown={handleKeyDown}
            />
            <div className="flex justify-between mt-2 text-xs text-text-muted font-medium">
              <span>{kgDisplay} kg</span>
              <span className="text-brand-500 font-bold">₹{rupeesDisplay}</span>
            </div>
          </div>

          {/* Numpad Grid */}
          <div className="grid grid-cols-3 gap-2">
            {padButtons.map(btn => (
              <button
                key={btn}
                onClick={() => handleKeyPress(btn)}
                className={`h-12 rounded-lg font-bold text-lg transition-all duration-100 active:scale-95 ${
                  btn === 'C'
                    ? 'bg-red-950/40 text-red-400 hover:bg-red-900/40 border border-red-800/40'
                    : btn === '⌫'
                    ? 'bg-amber-950/40 text-amber-400 hover:bg-amber-900/40 border border-amber-800/40'
                    : 'bg-surface-panel border border-border-subtle text-text-primary hover:bg-surface-hover'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>

          {/* Quick Weight Presets */}
          <div className="flex gap-2">
            {[250, 500, 1000, 1500].map(g => (
              <button
                key={g}
                onClick={() => setInputValue(String(g))}
                className="flex-1 py-1.5 rounded-lg bg-surface-panel border border-border-subtle hover:border-brand-500 text-brand-500 text-[11px] font-bold transition-all"
              >
                {g >= 1000 ? `${g / 1000}kg` : `${g}g`}
              </button>
            ))}
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={gramsValue <= 0}
            className="btn-primary w-full py-3 text-sm font-bold"
          >
            Add to Cart — ₹{rupeesDisplay}
          </button>
        </div>
      </div>
    </div>
  );
}
