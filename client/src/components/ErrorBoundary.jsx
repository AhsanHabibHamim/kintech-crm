import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    localStorage.removeItem('kt_access');
    localStorage.removeItem('kt_refresh');
    window.location.href = '/login';
  };

  handleReload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      window.caches?.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen grid place-items-center p-6 bg-gradient-to-br from-ink-900 via-brand-800 to-ink-900 text-white">
          <div className="max-w-md w-full text-center bg-white/10 border border-white/20 rounded-3xl p-8">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-xl font-extrabold">Something went wrong</h1>
            <p className="text-blue-100 text-sm mt-2">{this.state.message}</p>
            <button onClick={this.handleReload} className="btn-primary w-full mt-6">
              ↻ Reload fresh version
            </button>
            <button onClick={this.handleReset} className="w-full mt-2.5 text-xs text-blue-100/70 hover:text-white underline">
              Clear session & back to login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
