import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Save, Egg, Drumstick } from 'lucide-react';
import type { DailyMarketPrice, EggMarketPrice } from '../../../../core/types/enterprise_types';

export default function DailyMarketPricesView() {
  const queryClient = useQueryClient();

  // Chicken Price Form State
  const [productName, setProductName] = useState('Chicken Whole');
  const [marketRate, setMarketRate] = useState('220');
  const [wholesaleRate, setWholesaleRate] = useState('240');
  const [retailRate, setRetailRate] = useState('280');
  const [sellingRate, setSellingRate] = useState('300');

  // Egg Price Form State
  const [eggType, setEggType] = useState<'Country' | 'Farm' | 'Brown' | 'Duck'>('Farm');
  const [trayPrice, setTrayPrice] = useState('180');
  const [singlePrice, setSinglePrice] = useState('7');

  const { data: chickenPrices = [] } = useQuery<DailyMarketPrice[]>({
    queryKey: ['market-prices', 'chicken'],
    queryFn: async () => {
      const res = await window.api.invoke('market-prices:get-chicken-prices');
      return (res && res.success && Array.isArray(res.data)) ? res.data : [];
    },
  });

  const { data: eggPrices = [] } = useQuery<EggMarketPrice[]>({
    queryKey: ['market-prices', 'eggs'],
    queryFn: async () => {
      const res = await window.api.invoke('market-prices:get-egg-prices');
      return (res && res.success && Array.isArray(res.data)) ? res.data : [];
    },
  });

  const saveChickenPriceMutation = useMutation({
    mutationFn: async () => {
      const res = await window.api.invoke('market-prices:set-chicken-price', {
        product_name: productName,
        market_rate_paise: Math.round(Number(marketRate) * 100),
        wholesale_rate_paise: Math.round(Number(wholesaleRate) * 100),
        retail_rate_paise: Math.round(Number(retailRate) * 100),
        selling_rate_paise: Math.round(Number(sellingRate) * 100),
      });
      if (!res.success) throw new Error(res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-prices', 'chicken'] });
    },
  });

  const saveEggPriceMutation = useMutation({
    mutationFn: async () => {
      const res = await window.api.invoke('market-prices:set-egg-price', {
        egg_type: eggType,
        tray_price_paise: Math.round(Number(trayPrice) * 100),
        single_price_paise: Math.round(Number(singlePrice) * 100),
      });
      if (!res.success) throw new Error(res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-prices', 'eggs'] });
    },
  });

  return (
    <div className="flex flex-col h-full bg-surface-app text-text-primary p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border-subtle pb-4 flex-shrink-0">
        <h2 className="text-xl font-black font-outfit text-text-primary flex items-center gap-2">
          <TrendingUp className="text-brand-500" size={24} />
          <span>Daily Market Chicken & Egg Price Manager</span>
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Configure daily wholesale market fluctuations, expected margins, and auto-updated selling rates for POS billing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto">
        {/* Left Column: Price Setters */}
        <div className="lg:col-span-6 space-y-6">
          {/* Chicken Market Rate Card */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 space-y-4 shadow-elevation">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-muted flex items-center gap-2 border-b border-border-subtle pb-2">
              <Drumstick size={16} className="text-brand-500" />
              <span>Update Today's Poultry Market Rates</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">Product</label>
                <select value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-bold text-text-primary">
                  <option value="Chicken Whole">Chicken Whole (Skinless / With Skin)</option>
                  <option value="Chicken Curry Cut">Chicken Curry Cut</option>
                  <option value="Chicken Boneless">Chicken Boneless (Breast Fillet)</option>
                  <option value="Mutton Curry Cut">Mutton Curry Cut</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Market Rate (₹/kg)</label>
                <input value={marketRate} onChange={e => setMarketRate(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-text-primary" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Wholesale Rate (₹/kg)</label>
                <input value={wholesaleRate} onChange={e => setWholesaleRate(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-text-primary" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Retail Rate (₹/kg)</label>
                <input value={retailRate} onChange={e => setRetailRate(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-text-primary" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Today's Selling Rate (₹/kg)</label>
                <input value={sellingRate} onChange={e => setSellingRate(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-brand-500" />
              </div>
            </div>

            <button onClick={() => saveChickenPriceMutation.mutate()} className="w-full btn-primary py-2 text-xs font-bold shadow-elevation flex items-center justify-center gap-1.5">
              <Save size={14} /> Update Poultry Rate for POS
            </button>
          </div>

          {/* Egg Rate Card */}
          <div className="bg-surface-panel border border-border-subtle rounded-xl p-5 space-y-4 shadow-elevation">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-muted flex items-center gap-2 border-b border-border-subtle pb-2">
              <Egg size={16} className="text-amber-400" />
              <span>Update Today's Egg Rates</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Egg Variety</label>
                <select value={eggType} onChange={e => setEggType(e.target.value as any)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-bold text-text-primary">
                  <option value="Farm">Farm Fresh White Eggs</option>
                  <option value="Country">Nati / Country Eggs</option>
                  <option value="Brown">Brown Organic Eggs</option>
                  <option value="Duck">Duck Eggs</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Single Egg Rate (₹)</label>
                <input value={singlePrice} onChange={e => setSinglePrice(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-brand-500" />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase">Tray of 30 Eggs Rate (₹)</label>
                <input value={trayPrice} onChange={e => setTrayPrice(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-brand-500" />
              </div>
            </div>

            <button onClick={() => saveEggPriceMutation.mutate()} className="w-full btn-secondary py-2 text-xs font-bold flex items-center justify-center gap-1.5">
              <Save size={14} /> Update Egg Rates
            </button>
          </div>
        </div>

        {/* Right Column: Historical Rates */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden shadow-elevation">
            <div className="p-3 border-b border-border-subtle font-extrabold text-xs uppercase tracking-wider text-text-primary">
              Poultry Price History Log
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-card border-b border-border-subtle text-[10px] text-text-muted font-bold uppercase">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5">Wholesale</th>
                  <th className="p-2.5">Selling Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {chickenPrices.map(p => (
                  <tr key={p.id} className="hover:bg-surface-card/40">
                    <td className="p-2.5 font-bold">{p.date}</td>
                    <td className="p-2.5">{p.product_name}</td>
                    <td className="p-2.5 text-text-muted">₹{(p.wholesale_rate_paise / 100).toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-brand-500">₹{(p.selling_rate_paise / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-surface-panel border border-border-subtle rounded-xl overflow-hidden shadow-elevation">
            <div className="p-3 border-b border-border-subtle font-extrabold text-xs uppercase tracking-wider text-text-primary">
              Egg Price History Log
            </div>
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-card border-b border-border-subtle text-[10px] text-text-muted font-bold uppercase">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Egg Type</th>
                  <th className="p-2.5">Single Rate</th>
                  <th className="p-2.5">Tray (30) Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {eggPrices.map(e => (
                  <tr key={e.id} className="hover:bg-surface-card/40">
                    <td className="p-2.5 font-bold">{e.date}</td>
                    <td className="p-2.5 font-bold text-amber-400">{e.egg_type}</td>
                    <td className="p-2.5 font-bold text-brand-500">₹{(e.single_price_paise / 100).toFixed(2)}</td>
                    <td className="p-2.5 font-bold text-brand-500">₹{(e.tray_price_paise / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
