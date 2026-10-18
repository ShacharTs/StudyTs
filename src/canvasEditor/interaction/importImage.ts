import { addObject, pxToMm } from '@canvasStore';

const MAX_W_MM = 90;

export function importImage(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/svg+xml';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const probe = new Image();
      probe.onload = () => {
        const ratio = probe.naturalHeight / (probe.naturalWidth || 1) || 0.75;
        const w = Math.min(MAX_W_MM, pxToMm(probe.naturalWidth || 300));
        addObject('image', { w, h: w * ratio, props: { src } });
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
