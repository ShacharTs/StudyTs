/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { respondServiceDown } from './vite-plugins/proxyErrors';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'path';

const runtimePorts = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './config/runtimePorts.json'), 'utf-8'),
);

const aliases = {
  '@core': path.resolve(__dirname, './src/core'),
  '@data': path.resolve(__dirname, './data'),
  '@components': path.resolve(__dirname, './src/components'),
  '@engine': path.resolve(__dirname, './src/engine'),
  '@canvasStore': path.resolve(__dirname, './src/canvasStore'),
  '@canvasEditor': path.resolve(__dirname, './src/canvasEditor'),
  '@ai': path.resolve(__dirname, './src/ai'),
  '@hooks': path.resolve(__dirname, './src/hooks'),
  '@i18n': path.resolve(__dirname, './src/i18n'),
};

const backendTarget = process.env.VITE_API_URL || process.env.BACKEND_URL || `http://${runtimePorts.loopbackHost}:${runtimePorts.apiPort}`;

export default defineConfig({
  // All editor plugins moved to backend API server
  plugins: [react()],
  server: {
    port: runtimePorts.frontendPort,
    watch: {
      usePolling: false,
      ignored: [
        '**/data/canvas/**',
        '**/data/notebooks/**',
        '**/temp/**',
        '**/tmp/**',
        '**/.claude/**',
        '**/.secrets/**',
        '**/.logs/**',
        '**/logs/**',
        '**/graphify-out/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.log',
        '**/prisma/*.db*',
      ],
    },
    proxy: {
      '/api/omniroute': {
        target: `http://${runtimePorts.loopbackHost}:${runtimePorts.omniRoutePort}`,
        changeOrigin: true,
        configure: (proxy) => proxy.on('error', respondServiceDown('OmniRoute', runtimePorts.omniRoutePort)),
        rewrite: (path) => path.replace(/^\/api\/omniroute/, ''),
      },
      // Backend API routes — proxies all /api/* to Express backend
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      // Canvas-uploaded media (server/index.ts's express.static('/assets', ...)) — blocks
      // reference these directly as <img src="/assets/...">, so the request hits the Vite
      // dev server first and needs forwarding to the backend that actually serves the files.
      '/assets': {
        target: backendTarget,
        changeOrigin: true,
      },
      // Legacy Vite plugin paths → backend
      '/__content-editor': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__content-editor/, '/api/content-editor'),
      },
      '/__canvas-editor': {
        target: backendTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__canvas-editor/, '/api/canvas-editor'),
      },
    },
  },
  resolve: {
    alias: aliases,
  },
  test: {
    testTimeout: 25000,
    coverage: {
      thresholds: { statements: 88, branches: 80, functions: 86, lines: 90 },
    },
    projects: [
      {
        plugins: [react()],
        resolve: { alias: aliases },
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./test/setup/domCleanup.ts'],
          testTimeout: 25000,
          include: [
            'test/**/*.test.tsx',
          ],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: aliases },
        test: {
          name: 'node',
          environment: 'node',
          testTimeout: 25000,
          include: [
            'test/**/*.test.ts',
          ],
        },
      },
    ],
  },
});
