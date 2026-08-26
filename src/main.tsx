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

async function bootstrap() {
  // Install browser mock when running outside Electron
  if (!(window as any).api) {
    const { installBrowserMock } = await import('./browser_mock');
    installBrowserMock();
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppearanceProvider>
          <App />
        </AppearanceProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

void bootstrap();
