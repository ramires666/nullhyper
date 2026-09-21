import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
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
    console.error('[Nullhyper Global ErrorBoundary]:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#0e1118] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#181d2a] border border-rose-500/40 rounded-xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
              <AlertTriangle size={26} />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Произошла ошибка рендеринга</h2>
            <p className="text-xs text-gray-400 mb-4 break-words font-mono bg-[#11141e] p-3 rounded border border-[#262c3e] w-full text-left">
              {this.state.error?.message || 'Непредвиденная ошибка'}
            </p>
            <div className="flex items-center space-x-3 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 rounded-lg bg-[#252c3d] hover:bg-[#2e374c] text-xs font-semibold text-gray-200 transition-colors"
              >
                Попробовать снова
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-blue-600/30"
              >
                <RefreshCw size={13} />
                <span>Перезагрузить</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
