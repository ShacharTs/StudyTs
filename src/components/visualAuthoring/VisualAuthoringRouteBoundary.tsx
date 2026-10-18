import { Component, type ReactNode } from 'react';
import { log } from '@core/logger';
import { BuilderErrorBoundaryFallback } from './BuilderErrorBoundaryFallback';

interface VisualAuthoringRouteBoundaryProps {
  children: ReactNode;
}

interface VisualAuthoringRouteBoundaryState {
  failed: boolean;
}

// Outermost guard for the authoring route: an error that escapes the page must not blank the whole app.
export class VisualAuthoringRouteBoundary extends Component<
  VisualAuthoringRouteBoundaryProps,
  VisualAuthoringRouteBoundaryState
> {
  state: VisualAuthoringRouteBoundaryState = { failed: false };

  static getDerivedStateFromError(): VisualAuthoringRouteBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    log.error('Visual authoring route crashed', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: info.componentStack,
    });
  }

  private readonly reload = () => window.location.reload();

  render() {
    if (!this.state.failed) return this.props.children;
    return <BuilderErrorBoundaryFallback onReload={this.reload} />;
  }
}
