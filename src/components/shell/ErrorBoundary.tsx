import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import styles from './ErrorBoundary.module.css';
import { log } from '../../core/logger';
import { reportClientError } from '../../core/clientErrorReporter';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  retryLabel?: string;
}

interface State {
  hasError: boolean;
}

/** Catches render crashes in its subtree so one bad component can't white-screen the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: { componentStack?: string | null }) {
    // Log the real stack + component stack, not just String(error) - a bare
    // "Maximum update depth exceeded" message names no component and makes
    // render-loop bugs unreadable (see todo/15-render-crash-on-load.md).
    log.error('ErrorBoundary caught', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: errorInfo?.componentStack,
    });
    reportClientError({
      source: 'error-boundary',
      message: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: errorInfo?.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.root}>
          <AlertTriangle size={32} className={styles.icon} />
          <div>{this.props.fallbackTitle ?? 'Something went wrong rendering this content.'}</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className={styles.retry}
          >
            <RefreshCw size={14} className={styles.retryIcon} /> {this.props.retryLabel ?? 'Try Again'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
