import type { ToolboxCategory } from '../toolboxTypes';
import { spawnItem } from '../spawnItem';

export const AutomataGraphCategory: ToolboxCategory = {
  id: 'automata-graph',
  title: 'Automata & Graph Theory',
  items: [
    {
      id: 'automata-state',
      label: 'State',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <text x="12" y="16" fontSize="10" textAnchor="middle" fill="currentColor">q</text>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'node', { label: 'q' }),
    },
    {
      id: 'automata-start-state',
      label: 'Start State',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="14" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 12 h4 m-2 -2 l2 2 l-2 2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'node', { label: 'q0', start: true }),
    },
    {
      id: 'automata-accept-state',
      label: 'Accept State',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'node', { label: 'q', accept: true }),
    },
    {
      id: 'automata-directed-edge',
      label: 'Straight Arrow',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M4 12 h14 m-4 -4 l4 4 l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'line', { arrowEnd: true, curvature: 0 }, { w: 40, h: 0 }),
    },
    {
      id: 'automata-bidirectional-edge',
      label: 'Bidirectional Edge',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M4 12 h16 m-12 -4 l-4 4 l4 4 m8 -8 l4 4 l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'line', { markerStart: 'filled', markerEnd: 'filled', curvature: 0 }, { w: 40, h: 0 }),
    },
    {
      id: 'automata-curved-edge',
      label: 'Curved Arrow',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M4 16 Q 12 4 20 16 m-4 0 l4 0 l0 -4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'line', { arrowEnd: true, curvature: 15 }, { w: 40, h: 0 }),
    },
  ],
};
