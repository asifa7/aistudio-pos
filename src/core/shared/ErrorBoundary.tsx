import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-surface-card border border-rose-500/30 rounded-2xl m-4 text-text-primary space-y-3 shadow-lg">
          <div className="flex items-center gap-3 text-rose-400 font-bold">
            <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold">{this.props.fallbackTitle || 'Something went wrong rendering this section'}</h3>
              <p className="text-xs text-text-muted mt-0.5">An unexpected runtime error occurred inside this view.</p>
            </div>
          </div>

          {this.state.error && (
            <pre className="p-3 bg-surface-app border border-border-subtle rounded-xl text-[11px] font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap max-h-40">
              {this.state.error.message}
              {this.state.error.stack ? `\n${this.state.error.stack.split('\n').slice(0, 4).join('\n')}` : ''}
            </pre>
          )}

          <div className="pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20 flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Retry / Reload View</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
