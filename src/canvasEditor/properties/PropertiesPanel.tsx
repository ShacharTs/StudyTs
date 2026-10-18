import { useState } from 'react';
import { useCanvasStore, patchObject, setProp, type SceneObject } from '@canvasStore';
import { useTranslation } from '@i18n';
import { SCHEMAS, BOUND_EDGE_SCHEMA, GROUP_ORDER, type FieldSpec, type FieldGroup } from './schemas';
import { isBoundEdgeObject } from '../connectors/useBoundEdgeGeometry';
import styles from './PropertiesPanel.module.css';
import { AutoGrowTextarea } from './AutoGrowTextarea';
import { ColorField } from './ColorField';
import { PropertiesHeader } from './PropertiesHeader';
import { PropertyCategoryBar } from './PropertyCategoryBar';
import { fieldsInCategory, visibleCategories, type PropertyCategory } from './propertyCategories';

interface SchemaFieldsProps {
  obj: SceneObject;
  schema: FieldSpec[];
}

type ColorFieldSpec = Extract<FieldSpec, { kind: 'color' }>;
type NumberFieldSpec = Extract<FieldSpec, { kind: 'number' }>;

// Schema labels keep their units; the suffix only repeats the unit where the number is typed.
const UNIT_BY_CORE_KEY: Record<string, string> = { x: 'mm', y: 'mm', w: 'mm', h: 'mm', rotation: '°' };

function readValue(obj: SceneObject, f: FieldSpec): unknown {
  if (f.core) return (obj as unknown as Record<string, unknown>)[f.key];
  return obj.props[f.key];
}

/** Typing a width or height into a text box's or table's fields takes it off auto-fit, so the number sticks. */
function takesOverTextSize(obj: SceneObject, f: FieldSpec): boolean {
  return (obj.type === 'text' || obj.type === 'table') && (f.key === 'w' || f.key === 'h');
}

function writeValue(obj: SceneObject, f: FieldSpec, value: unknown): void {
  if (f.core && takesOverTextSize(obj, f)) {
    patchObject(obj.id, { [f.key]: value, props: { ...obj.props, autoFit: false } }, `Edit ${f.label}`);
  } else if (f.core) {
    patchObject(obj.id, { [f.key]: value }, `Edit ${f.label}`);
  } else {
    setProp(obj.id, f.key, value, `Edit ${f.label}`);
  }
}

function fieldDefault(f: FieldSpec): unknown {
  switch (f.kind) {
    case 'number':
      return f.default ?? 0;
    case 'select':
      return f.default ?? '';
    case 'color':
      return f.default;
    case 'checkbox':
      return f.default ?? false;
    default:
      return '';
  }
}

function unitFor(f: FieldSpec): string | undefined {
  return f.core ? UNIT_BY_CORE_KEY[f.key] : undefined;
}

function renderNumber(obj: SceneObject, f: NumberFieldSpec, current: unknown, inputId: string) {
  const input = (
    <input
      id={inputId}
      type="number"
      min={f.min}
      max={f.max}
      step={f.step}
      value={Number(current ?? 0)}
      onChange={(e) => writeValue(obj, f, clampToField(Number(e.target.value), undefined, f.max))}
      onBlur={(e) => writeValue(obj, f, clampToField(Number(e.target.value), f.min, f.max))}
      className={styles.numberInput}
    />
  );
  const unit = unitFor(f);
  if (!unit) return input;
  return (
    <span className={styles.numberWithUnit}>
      {input}
      <span className={styles.unit} aria-hidden="true">{unit}</span>
    </span>
  );
}

function renderInput(obj: SceneObject, f: FieldSpec, current: unknown, inputId: string) {
  if (f.kind === 'textarea') {
    return (
      <AutoGrowTextarea
        id={inputId}
        value={String(current ?? '')}
        placeholder={f.placeholder}
        onChange={(value) => writeValue(obj, f, value)}
      />
    );
  }
  if (f.kind === 'text') {
    return (
      <input
        id={inputId}
        type="text"
        value={String(current ?? '')}
        onChange={(e) => writeValue(obj, f, e.target.value)}
        className={styles.textInput}
      />
    );
  }
  if (f.kind === 'number') return renderNumber(obj, f, current, inputId);
  return null;
}

function renderColor(obj: SceneObject, f: ColorFieldSpec, current: unknown, inputId: string) {
  const pick = (hex: string) => writeValue(obj, f, hex);
  const clear = f.allowNone ? (
    <button
      type="button"
      className={styles.clearColor}
      disabled={!current || current === f.default}
      title="No color"
      onClick={() => writeValue(obj, f, f.default)}
    >
      ×
    </button>
  ) : undefined;
  return <ColorField id={inputId} value={String(current ?? f.default)} onPick={pick} clear={clear} />;
}

function renderChoice(obj: SceneObject, f: FieldSpec, current: unknown, inputId: string) {
  if (f.kind === 'color') return renderColor(obj, f, current, inputId);
  if (f.kind === 'checkbox') {
    return (
      <input
        id={inputId}
        type="checkbox"
        checked={!!current}
        onChange={(e) => writeValue(obj, f, e.target.checked)}
      />
    );
  }
  if (f.kind === 'select') {
    return (
      <select
        id={inputId}
        value={String(current ?? '')}
        onChange={(e) => writeValue(obj, f, e.target.value)}
        className={styles.selectInput}
      >
        {f.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return null;
}

function renderField(obj: SceneObject, f: FieldSpec) {
  const current = readValue(obj, f) ?? fieldDefault(f);
  const inputId = `field-${obj.id}-${f.key}`;
  return renderInput(obj, f, current, inputId) ?? renderChoice(obj, f, current, inputId);
}

function clampToField(n: number, min?: number, max?: number): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
}

export function SchemaFields({ obj, schema }: SchemaFieldsProps) {
  const byGroup = new Map<FieldGroup, FieldSpec[]>();
  for (const f of schema) {
    if (!byGroup.has(f.group)) byGroup.set(f.group, []);
    byGroup.get(f.group)!.push(f);
  }
  const orderedGroups = GROUP_ORDER.filter((g) => byGroup.has(g));

  return (
    <div className={styles.container}>
      {orderedGroups.map((group) => (
        <div key={group}>
          <h3 className={styles.groupHeading}>{group}</h3>
          <div className={styles.fieldGrid}>
            {byGroup.get(group)!.map((f) => (
              <div
                key={f.key}
                className={`${styles.fieldRow} ${f.kind === 'textarea' ? styles.fieldRowSpan2 : ''}`}
              >
                <label htmlFor={`field-${obj.id}-${f.key}`} className={styles.fieldLabel}>{f.label}</label>
                {renderField(obj, f)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Keeps the picked category across selections; falls back to the first visible one when the picked one has no fields.
function CategorizedFields({ obj, schema }: { obj: SceneObject; schema: FieldSpec[] }) {
  const { val } = useTranslation();
  const [picked, setPicked] = useState<PropertyCategory>('general');
  const categories = visibleCategories(schema);
  if (categories.length === 0) return <div className={styles.empty}>{val({ key: 'canvasBlocks.properties.categories.empty' })}</div>;

  const active = categories.includes(picked) ? picked : categories[0];
  return (
    <>
      <PropertyCategoryBar categories={categories} active={active} onSelect={setPicked} />
      <SchemaFields obj={obj} schema={fieldsInCategory(schema, active)} />
    </>
  );
}

export function PropertiesPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const objects = useCanvasStore((s) => s.doc.objects);
  const firstId = selectedIds[0] ?? '';
  const obj = objects[firstId];

  if (!obj) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>No object selected</div>
      </div>
    );
  }

  const schema = isBoundEdgeObject(obj) ? BOUND_EDGE_SCHEMA : SCHEMAS[obj.type];

  return (
    <div className={styles.panel}>
      <PropertiesHeader type={obj.type} onClose={() => useCanvasStore.getState().clearSelection()} />
      {schema && <CategorizedFields obj={obj} schema={schema} />}
    </div>
  );
}
