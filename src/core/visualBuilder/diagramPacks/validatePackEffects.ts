import { OBJECT_KINDS } from '../objectKinds';
import { PACK_ANIME_RANGES, PACK_EASINGS, PACK_EFFECT_TONES, PACK_LIMITS, type StylePackIssue } from './stylePackFormat';
import {
  checkArray,
  checkEnum,
  checkId,
  checkLabelText,
  checkLocalizedLabel,
  checkNumberIn,
  checkUnknownFields,
  isRecord,
  packIssue,
} from './validatePackPrimitives';

const EFFECT_FIELDS = ['id', 'label', 'description', 'kinds', 'duration', 'icon', 'tone', 'anime'];
const ANIME_FIELDS = [...Object.keys(PACK_ANIME_RANGES), 'easing'];

export function validatePackEffects(value: unknown, path: string): StylePackIssue[] {
  const { min, max } = PACK_LIMITS.effects;
  return checkArray(value, [min, max], path, 'too-many', validatePackEffect);
}

function validatePackEffect(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-effect', 'effect must be an object')];
  return [
    ...checkUnknownFields(value, EFFECT_FIELDS, path),
    ...checkId(value.id, `${path}.id`),
    ...checkLocalizedLabel(value.label, `${path}.label`),
    ...checkLocalizedLabel(value.description, `${path}.description`),
    ...kindIssues(value.kinds, `${path}.kinds`),
    ...checkNumberIn(value.duration, PACK_LIMITS.duration, `${path}.duration`, 'bad-effect'),
    ...checkLabelText(value.icon, `${path}.icon`, PACK_LIMITS.iconChars),
    ...checkEnum(value.tone, PACK_EFFECT_TONES, `${path}.tone`, 'bad-enum'),
    ...validatePackAnime(value.anime, `${path}.anime`),
  ];
}

function kindIssues(value: unknown, path: string): StylePackIssue[] {
  return checkArray(value, [1, OBJECT_KINDS.length], path, 'bad-effect', (item, itemPath) => checkEnum(item, OBJECT_KINDS, itemPath, 'bad-enum'));
}

export function validatePackAnime(value: unknown, path: string): StylePackIssue[] {
  if (!isRecord(value)) return [packIssue(path, 'bad-effect', 'anime must be an object')];
  const { min, max } = PACK_LIMITS.animeValues;
  const easingIssues = value.easing === undefined ? [] : checkEnum(value.easing, PACK_EASINGS, `${path}.easing`, 'bad-enum');
  const propertyIssues = Object.entries(PACK_ANIME_RANGES).flatMap(([prop, range]) =>
    value[prop] === undefined
      ? []
      : checkArray(value[prop], [min, max], `${path}.${prop}`, 'bad-effect', (item, itemPath) => checkNumberIn(item, range, itemPath, 'bad-effect')),
  );
  return [...checkUnknownFields(value, ANIME_FIELDS, path), ...easingIssues, ...propertyIssues];
}
