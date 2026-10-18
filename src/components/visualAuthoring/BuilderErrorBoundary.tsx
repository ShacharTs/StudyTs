import { Component, type ReactNode } from 'react';
import { log } from '@core/logger';
import type { VisualSpec } from '@core/types/visualSpec';
import { readPreMigrationBackup } from '@core/visualBuilder/preMigrationBackup';
import { BuilderErrorBoundaryFallback } from './BuilderErrorBoundaryFallback';

interface BuilderErrorBoundaryProps {
  specId: string;
  specVersion: number;
  /** Omitted for a read-only spec: there is nothing to restore into. */
  onRecover?: (spec: VisualSpec) => void;
  children: ReactNode;
}

interface BuilderErrorBoundaryState {
  failed: boolean;
}

// Scoped to the builder so a crash there never blanks the rest of the authoring page.
export class BuilderErrorBoundary extends Component<BuilderErrorBoundaryProps, BuilderErrorBoundaryState> {
  state: BuilderErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): BuilderErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    log.error('Visual builder crashed', {
      specId: this.props.specId,
      specVersion: this.props.specVersion,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack: info.componentStack,
    });
  }

  private readonly recover = () => {
    const backup = readPreMigrationBackup(this.props.specId);
    if (backup) this.props.onRecover?.(backup);
    this.setState({ failed: false });
  };

  private readonly reload = () => window.location.reload();

  render() {
    if (!this.state.failed) return this.props.children;
    const recover = this.props.onRecover ? this.recover : undefined;
    return <BuilderErrorBoundaryFallback onRecover={recover} onReload={this.reload} />;
  }
}
