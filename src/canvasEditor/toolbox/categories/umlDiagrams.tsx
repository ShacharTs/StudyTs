import type { ToolboxCategory } from '../toolboxTypes';
import { spawnItem } from '../spawnItem';
import { PackIcon } from '../PackIcon';

export const UmlDiagramsCategory: ToolboxCategory = {
  id: 'uml-diagrams',
  title: 'UML 2.5 & Architecture',
  items: [
    {
      id: 'uml-class-box',
      label: 'Class',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'uml-class', {}, { w: 50, h: 40 }),
    },
    {
      id: 'uml-database',
      label: 'Database',
      icon: <PackIcon kind="cylinder" />,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'cylinder' }, { w: 22, h: 25 }),
    },
    {
      id: 'uml-server',
      label: 'Server',
      icon: <PackIcon kind="server" />,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'server' }, { w: 22, h: 25 }),
    },
    {
      id: 'uml-interface',
      label: 'Interface',
      icon: <PackIcon kind="interface" />,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'interface' }, { w: 30, h: 15 }),
    },
    {
      id: 'uml-package',
      label: 'Package',
      icon: <PackIcon kind="package" />,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'package' }, { w: 44, h: 32 }),
    },
    {
      id: 'uml-actor',
      label: 'Actor',
      icon: <PackIcon kind="actor" />,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'actor', label: '' }, { w: 12, h: 28 }),
    },
    {
      id: 'uml-fork-join',
      label: 'Fork / Join',
      icon: <PackIcon kind="fork" />,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'fork' }, { w: 40, h: 7 }),
    },
    {
      id: 'uml-decision',
      label: 'Decision',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d="M12 3 L22 12 L12 21 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'decision' }, { w: 24, h: 24 }),
    },
    {
      id: 'uml-network-connector',
      label: 'Connector',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="4" cy="4" r="2.5" fill="currentColor"/>
          <circle cx="20" cy="20" r="2.5" fill="currentColor"/>
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      onSelect: (pageId) => spawnItem(pageId, 'line', { dash: true }, { w: 40, h: 0 }),
    },
  ],
};
