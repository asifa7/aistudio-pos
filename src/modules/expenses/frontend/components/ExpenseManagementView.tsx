import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus } from 'lucide-react';
import type { Expense } from '../../../../core/types/enterprise_types';

export default function ExpenseManagementView() {
  const queryClient = useQueryClient();
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [gst, setGst] = useState('0');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['expenses', 'categories'],
    queryFn: async () => {
      const res = await window.api.invoke('expenses:get-categories');
      return (res && res.success && Array.isArray(res.data)) ? res.data : [];
    },
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses', 'list'],
    queryFn: async () => {
      const res = await window.api.invoke('expenses:get-expenses');
      return (res && res.success && Array.isArray(res.data)) ? res.data : [];
    },
  });

  const recordExpenseMutation = useMutation({
    mutationFn: async () => {
      const res = await window.api.invoke('expenses:record-expense', {
        category_id: Number(categoryId),
        vendor_name: vendor || 'General Vendor',
        amount_paise: Math.round(Number(amount) * 100),
        gst_paise: Math.round(Number(gst) * 100),
        payment_method: method,
        notes: notes || 'Store operational expense',
      });
      if (!res.success) throw new Error(res.error?.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', 'list'] });
      setVendor('');
      setAmount('');
      setGst('0');
      setNotes('');
    },
  });

  const safeExpenses = Array.isArray(expenses) ? expenses : [];
  const totalExpensePaise = safeExpenses.reduce((sum, e) => sum + (e?.amount_paise || 0), 0);

  return (
    <div className="flex flex-col h-full bg-surface-app text-text-primary p-6 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border-subtle pb-4 gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black font-outfit text-text-primary flex items-center gap-2">
            <Receipt className="text-brand-500" size={24} />
            <span>Store Expense Manager & Vendor Bill Tracker</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Log shop operational expenses (rent, electricity, fuel, packaging), attach bill receipts, and track monthly overheads.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-surface-panel px-4 py-2 rounded-xl border border-border-subtle font-mono text-xs font-bold">
          <span className="text-text-muted">Total Expenses Logged:</span>
          <span className="text-brand-500 font-extrabold text-sm">₹{(totalExpensePaise / 100).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-y-auto">
        {/* Left Column: Record Expense Form */}
        <div className="lg:col-span-4 bg-surface-panel border border-border-subtle rounded-xl p-5 space-y-4 shadow-elevation flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xs uppercase font-extrabold tracking-wider text-text-muted border-b border-border-subtle pb-2 flex items-center gap-2">
              <Plus size={15} className="text-brand-500" />
              <span>Record New Shop Expense</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Expense Category</label>
                <select value={categoryId} onChange={e => setCategoryId(Number(e.target.value))} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-bold text-text-primary">
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Vendor / Payee Name</label>
                <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g. BESCOM / Shop Owner" className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-bold text-text-primary" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Total Expense Amount (₹)</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-text-primary" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">GST Amount Included (₹)</label>
                <input value={gst} onChange={e => setGst(e.target.value)} placeholder="0.00" className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-mono font-bold text-text-primary" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Payment Mode</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-bold text-text-primary">
                  <option value="Cash">Cash Drawer</option>
                  <option value="UPI">UPI / GPay</option>
                  <option value="Card">Bank Card</option>
                  <option value="Bank_Transfer">Net Banking</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase">Notes / Reference No</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Bill invoice number / details" className="w-full bg-surface-card border border-border-subtle rounded px-3 py-1.5 mt-1 font-bold text-text-primary" />
              </div>
            </div>
          </div>

          <button onClick={() => recordExpenseMutation.mutate()} className="w-full btn-primary py-2.5 text-xs font-extrabold shadow-elevation mt-4">
            Save Expense Record
          </button>
        </div>

        {/* Right Column: Expenses List */}
        <div className="lg:col-span-8 bg-surface-panel border border-border-subtle rounded-xl overflow-hidden shadow-elevation flex flex-col">
          <div className="p-4 border-b border-border-subtle font-extrabold text-xs uppercase tracking-wider text-text-primary flex justify-between items-center">
            <span>Expenses Register</span>
            <span className="text-[10px] font-mono text-text-muted">{safeExpenses.length} records</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-card border-b border-border-subtle text-[10px] text-text-muted font-bold uppercase">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {safeExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-text-muted">
                      No expenses recorded yet.
                    </td>
                  </tr>
                ) : (
                  safeExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-surface-card/40">
                      <td className="p-3 font-bold">{exp.expense_date}</td>
                      <td className="p-3 font-bold text-brand-500">{exp.category_name || 'General'}</td>
                      <td className="p-3 text-text-primary">{exp.vendor_name || 'Generic Vendor'}</td>
                      <td className="p-3 text-text-muted">{exp.payment_method}</td>
                      <td className="p-3 font-bold text-red-400">₹{((exp.amount_paise || 0) / 100).toFixed(2)}</td>
                      <td className="p-3 font-bold text-brand-500">{exp.status || 'Approved'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
