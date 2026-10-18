import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './i18n/index.ts';
import { ThemeProvider } from './core/theme/ThemeProvider';
import { CourseRegistryProvider } from './core/courseRegistry/CourseRegistryProvider';
import { parseVisualAuthoringPath } from './components/visualAuthoring/visualAuthoringRoute';
import { VisualAuthoringRouteBoundary } from './components/visualAuthoring/VisualAuthoringRouteBoundary';
import { isPreviewPath } from './components/visualBuilder/previewChannel';
import { isLogsRoute } from './components/settings/logsRoute';
import { installGlobalErrorReporting } from './core/clientErrorReporter';
import { installScreenScale } from './core/theme/screenScale';
import { loadRuntimeLocales } from './i18n/loadRuntimeLocales';
import 'katex/dist/katex.min.css';
import './index.css';

installGlobalErrorReporting();
installScreenScale();

await loadRuntimeLocales();

const VisualAuthoringPage = lazy(() =>
  import('./components/visualAuthoring/VisualAuthoringPage').then((module) => ({ default: module.VisualAuthoringPage })),
);

const LogsPopoutPage = lazy(() =>
  import('./components/settings/LogsPopoutPage').then((module) => ({ default: module.LogsPopoutPage })),
);

const VisualPreviewPage = lazy(() =>
  import('./components/visualAuthoring/VisualPreviewPage').then((module) => ({ default: module.VisualPreviewPage })),
);

const previewRoute = isPreviewPath(window.location.pathname);
const authoringRoute =parseVisualAuthoringPath(window.location.pathname, window.location.search);
const logsRoute = isLogsRoute(window.location.pathname, window.location.search);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {previewRoute ? (
      <ThemeProvider>
        <Suspense fallback={null}>
          <VisualPreviewPage />
        </Suspense>
      </ThemeProvider>
    ) : logsRoute ? (
      <ThemeProvider>
        <I18nProvider>
          <Suspense fallback={null}>
            <LogsPopoutPage />
          </Suspense>
        </I18nProvider>
      </ThemeProvider>
    ) : authoringRoute.matches ? (
      <CourseRegistryProvider>
        <ThemeProvider>
          <I18nProvider>
            <VisualAuthoringRouteBoundary>
              <Suspense fallback={null}>
                <VisualAuthoringPage initialKey={authoringRoute.key} lecture={authoringRoute.lecture} />
              </Suspense>
            </VisualAuthoringRouteBoundary>
          </I18nProvider>
        </ThemeProvider>
      </CourseRegistryProvider>
    ) : (
      <CourseRegistryProvider>
        <ThemeProvider>
          <I18nProvider>
            <App />
          </I18nProvider>
        </ThemeProvider>
      </CourseRegistryProvider>
    )}
  </React.StrictMode>
);
