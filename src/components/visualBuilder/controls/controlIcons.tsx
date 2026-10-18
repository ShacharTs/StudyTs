export const CONTROL_ICONS = {
  undo: ['M6 7H12a4 4 0 0 1 0 8H8', 'M8.5 3.5L5 7l3.5 3.5'],
  redo: ['M14 7H8a4 4 0 0 0 0 8h4', 'M11.5 3.5L15 7l-3.5 3.5'],
  select: ['M5 3l10 6-4.5 1.5L8.5 15z'],
  connect: ['M4 15a2 2 0 1 0 0-.01', 'M16 5a2 2 0 1 0 0-.01', 'M5.5 13.5l9-7'],
  insert: ['M10 4v12', 'M4 10h12'],
  text: ['M5 5h10', 'M10 5v10'],
  heading: ['M5 4v12', 'M15 4v12', 'M5 10h10'],
  caption: ['M3 5h14v8H9l-3 3v-3H3z'],
  note: ['M4 3h9l3 3v11H4z', 'M13 3v3h3'],
  'shape-circle': ['M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14'],
  'shape-box': ['M3 5h14v10H3z'],
  'shape-diamond': ['M10 2l8 8-8 8-8-8z'],
  custom: ['M3 15C6 3 10 17 14 8l3 2'],
  animate: ['M6 4l10 6-10 6z'],
  'layout-build': ['M3 4h14v12H3z', 'M3 4v12', 'M12 4v12'],
  'layout-split': ['M3 4h14v12H3z', 'M10 4v12'],
  'layout-preview': ['M3 4h14v12H3z', 'M8 4v12'],
  'zoom-in': ['M9 3a6 6 0 1 0 0 12a6 6 0 1 0 0-12', 'M14 14l4 4', 'M9 6.5v5', 'M6.5 9h5'],
  'zoom-out': ['M9 3a6 6 0 1 0 0 12a6 6 0 1 0 0-12', 'M14 14l4 4', 'M6.5 9h5'],
  fit: ['M3 7V3h4', 'M13 3h4v4', 'M17 13v4h-4', 'M7 17H3v-4'],
  ghosts: ['M4 17V9a6 6 0 0 1 12 0v8l-2-2-2 2-2-2-2 2-2-2z'],
  snap: ['M3 3h14v14H3z', 'M3 10h14', 'M10 3v14'],
  popout: ['M8 4H4v12h12v-4', 'M11 3h6v6', 'M17 3l-8 8'],
  templates: ['M3 3h6v6H3z', 'M11 3h6v6h-6z', 'M3 11h6v6H3z', 'M11 11h6v6h-6z'],
  save: ['M4 3h10l3 3v11H4z', 'M7 3v5h6V3', 'M7 17v-5h6v5'],
  export: ['M10 3v10', 'M6 9l4 4 4-4', 'M4 16h12'],
  import: ['M10 13V3', 'M6 7l4-4 4 4', 'M4 16h12'],
  publish: ['M10 17V6', 'M5 10l5-5 5 5', 'M4 3h12'],
  help: ['M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14', 'M8 8a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6', 'M10 14.5v.01'],
  duplicate: ['M7 7h10v10H7z', 'M13 7V3H3v10h4'],
  trash: ['M4 6h12', 'M8 6V3h4v3', 'M5 6l1 11h8l1-11'],
  'step-add': ['M10 4v12', 'M4 10h12'],
} satisfies Record<string, string[]>;

export type ControlIconName = keyof typeof CONTROL_ICONS;

export function ControlIcon({ name }: { name: ControlIconName }) {
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {CONTROL_ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
