/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Desktop apps don't need excessive refresh
      retry: false,
    },
  },
});

import { AppearanceProvider } from './core/theme/AppearanceContext';

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught error in UI:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, background: '#090d16', color: '#f1f5f9', minHeight: '100vh', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold' }}>Application Error</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px' }}>An error occurred while rendering the page:</p>
          <pre style={{ background: '#020617', padding: '16px', borderRadius: '8px', color: '#fca5a5', fontSize: '12px', overflow: 'auto' }}>
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload POS
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

async function bootstrap() {
  // Install browser mock when running outside Electron
  if (!(window as any).api) {
    const { installBrowserMock } = await import('./browser_mock');
    installBrowserMock();
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AppearanceProvider>
            <App />
          </AppearanceProvider>
        </QueryClientProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
}

void bootstrap();

