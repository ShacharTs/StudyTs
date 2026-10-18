import type { ToolboxCategory } from '../toolboxTypes';
import { spawnItem } from '../spawnItem';

export const BasicShapesCategory: ToolboxCategory = {
  id: 'basic-shapes',
  title: 'General / Basic Shapes',
  items: [
    {
      id: 'shape-text',
      label: 'Text',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 5 h16 M12 5 v14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'text', {}, { w: 50, h: 20 }),
    },
    {
      id: 'shape-rect',
      label: 'Rectangle',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'rect' }),
    },
    {
      id: 'shape-rounded',
      label: 'Rounded Rectangle',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'rounded' }),
    },
    {
      id: 'shape-ellipse',
      label: 'Ellipse',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="7" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'ellipse' }),
    },
    {
      id: 'shape-diamond',
      label: 'Diamond',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'diamond' }),
    },
    {
      id: 'shape-triangle',
      label: 'Triangle',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 L22 21 L2 21 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'triangle' }),
    },
    {
      id: 'shape-pentagon',
      label: 'Pentagon',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2 L22 9 L18 21 L6 21 L2 9 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'pentagon' }),
    },
    {
      id: 'shape-hexagon',
      label: 'Hexagon',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M6 3 L18 3 L22 12 L18 21 L6 21 L2 12 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'hexagon' }),
    },
    {
      id: 'shape-star',
      label: 'Star',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'star' }),
    },
    {
      id: 'shape-callout',
      label: 'Callout',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 4 h18 v12 h-6 l-3 4 l-3 -4 h-6 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'callout' }),
    },
    {
      id: 'shape-terminator',
      label: 'Terminator',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'terminator' }),
    },
    {
      id: 'shape-parallelogram',
      label: 'Parallelogram',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M7 4 h14 l-4 16 h-14 Z" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'shape', { shape: 'parallelogram' }),
    },
    {
      id: 'shape-arrow',
      label: 'Arrow',
      icon: <svg width="24" height="24" viewBox="0 0 24 24"><path d="M3 12 h14 m-4 -4 l4 4 l-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
      onSelect: (pageId) => spawnItem(pageId, 'line'),
    },
  ],
};
