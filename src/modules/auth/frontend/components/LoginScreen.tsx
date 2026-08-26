import React, { useState } from 'react';
import { useLogin } from '../hooks/useAuth';
import { Lock, User, AlertCircle } from 'lucide-react';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    try {
      await loginMutation.mutateAsync({
        username: username.trim(),
        passwordPlain: password,
      });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-surface-app flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        {/* Brand/Logo Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-xl bg-brand-500 flex items-center justify-center font-black text-2xl text-white shadow-subtle mb-4">
            M
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary font-outfit">MEAT SHOP POS</h1>
          <p className="text-xs text-text-muted mt-1.5 uppercase tracking-widest font-semibold">
            Enterprise Terminal Authentication
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-panel border border-border-subtle rounded-xl shadow-elevation p-8">
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-6 pb-2 border-b border-border-subtle">
            Sign In to Terminal
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Username</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin, cashier"
                  required
                  className="w-full bg-surface-card border border-border-subtle rounded-lg pl-10 pr-4 py-3 text-xs font-semibold text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-surface-card border border-border-subtle rounded-lg pl-10 pr-4 py-3 text-xs font-semibold text-text-primary placeholder:text-text-muted outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-400 font-medium">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="btn-primary w-full py-3.5 text-xs font-bold"
            >
              {loginMutation.isPending ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Terminal</span>
              )}
            </button>
          </form>
        </div>

        {/* Support Info Footer */}
        <div className="text-center mt-6 text-[10px] text-text-muted">
          <span>Enterprise Carbon System · Shift session active until window closure.</span>
        </div>
      </div>
    </div>
  );
}
