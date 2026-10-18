import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { BlurCommitInput } from '@components/shared/BlurCommitInput';
import { useCanvasStore, setProp, patchObject, pxToMm, type SceneObject } from '@canvasStore';
import { detectDirectionFromText } from '@i18n/localizedValue';
import { LatexText } from './LatexText';
import { computeGrownSize } from './textFit';
import { isAutoFit, measureTextBox, fittedBox, widthCapMm, contentCapPx, pageWidthOf } from './autoFit';
import { useIsPagePreview } from '@canvasEditor/page/pagePreviewContext';
import styles from './ObjectViews.module.css';

const TEXT_BOX_PADDING_MM = 1;

function readTextProps(p: SceneObject['props'], stickyStyle: string) {
  const sticky = p.variant === 'sticky';
  return {
    text: (p.text as string) ?? (p.label as string) ?? '',
    fontSize: (p.fontSize as number) ?? 12,
    color: (p.color as string) ?? (sticky ? 'var(--sticky-ink)' : 'var(--text-1)'),
    align: (p.align as React.CSSProperties['textAlign']) ?? 'left',
    fill: typeof p.fill === 'string' && p.fill !== 'transparent' ? p.fill : undefined,
    stickyClass: sticky ? stickyStyle : '',
  };
}

/** Auto-fit: the box follows the rendered text both ways (wider up to its cap, shorter or taller to the words). Not an undo step. */
function fitToText(obj: SceneObject, el: HTMLElement | null): void {
  if (!el) return;
  const capMm = widthCapMm(obj, pageWidthOf(obj.id));
  const measure = measureTextBox(el, contentCapPx(capMm));
  const box = measure && fittedBox(obj, measure, capMm);
  if (!box) return;
  const props = obj.props.maxWidth === capMm ? obj.props : { ...obj.props, maxWidth: capMm };
  useCanvasStore.getState()._api.patchRaw(obj.id, { ...box, props });
}

/** Auto-fit off (or while typing): the box only grows when the text no longer fits its height. */
function growToContent(obj: SceneObject, el: HTMLElement | null, editing: boolean): void {
  if (!el) return;
  const prevHeight = el.style.height;
  if (editing) el.style.height = 'auto';
  // Content lives inside a viewport that applies zoom via CSS `transform: scale()`, so scrollWidth/scrollHeight are
  // always in un-zoomed, natural pixels; never divide this measurement by zoom.
  const contentW = pxToMm(el.scrollWidth);
  const contentH = pxToMm(el.scrollHeight);
  if (editing) el.style.height = prevHeight;
  const grown = computeGrownSize(obj.w, obj.h, contentW, contentH, TEXT_BOX_PADDING_MM);
  if (grown) patchObject(obj.id, { w: grown.w, h: grown.h }, 'Auto-fit text box');
}

export function TextView({ obj }: { obj: SceneObject }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { text, fontSize, color, align, fill, stickyClass } = readTextProps(obj.props, styles.sticky);
  const dir = detectDirectionFromText(editing ? draft : text);
  const isPreview = useIsPagePreview();

  const [fontsLoaded, setFontsLoaded] = useState(0);
  useEffect(() => {
    // Text re-wraps once a web font arrives, so the fit is measured again then.
    void document.fonts?.ready.then(() => setFontsLoaded((n) => n + 1));
  }, []);

  const autoFit = isAutoFit(obj.props);
  const { maxWidth } = obj.props;
  useLayoutEffect(() => {
    if (isPreview) return;
    if (autoFit && !editing) fitToText(obj, contentRef.current);
    else growToContent(obj, editing ? textareaRef.current : contentRef.current, editing);
  }, [text, draft, fontSize, autoFit, maxWidth, fontsLoaded, obj, editing, isPreview]);

  const startEditing = () => {
    setDraft(text);
    setEditing(true);
  };

  if (!editing && !text) {
    return (
      <div
        onDoubleClick={startEditing}
        className={`${styles.textEmpty} ${stickyClass}`}
      >
        Double-click to edit text ($math$)
      </div>
    );
  }

  return (
    <div
      className={`${styles.textRoot} ${stickyClass}`}
      style={{ '--ta': align, '--fs': `${fontSize}pt`, '--c': color, ...(fill && { background: fill }) } as React.CSSProperties}
    >
      {editing ? (
        <BlurCommitInput
          multiline
          inputRef={textareaRef}
          autoFocus
          dir={dir}
          value={text}
          className={`${styles.textBody} ${styles.textArea}`}
          onChange={setDraft}
          onCommit={(value) => setProp(obj.id, 'text', value, 'Edit text')}
          onFinish={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div
          ref={contentRef}
          onDoubleClick={startEditing}
          dir={dir}
          className={`${styles.textBody} ${styles.textContent} ${styles.editableText}`}
        >
          <LatexText text={text} />
        </div>
      )}
    </div>
  );
}
