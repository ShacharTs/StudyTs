import { checkVisualSpec, type VisualSpecParseResult } from './visualSpecJson';
import { checkVisualSpecLayout } from './visualSpecLayout';

// What an AI or MCP caller must pass before a spec is written into a course: valid shape first, then clean geometry.
export function checkVisualSpecForPublish(value: unknown): VisualSpecParseResult {
  const checked = checkVisualSpec(value);
  if (!checked.spec || checked.problems.length > 0) return checked;
  return { spec: checked.spec, problems: checkVisualSpecLayout(checked.spec) };
}
