import { addObject, type ObjectType, type SceneObject } from '@canvasStore';

export function spawnItem(
  pageId: string,
  type: ObjectType,
  props?: Record<string, unknown>,
  extraOverrides?: Partial<Omit<SceneObject, 'id' | 'type' | 'props'>>
): void {
  const overrides: Partial<SceneObject> = { ...extraOverrides };
  if (props) {
    overrides.props = props;
  }
  addObject(type, overrides, pageId);
}
