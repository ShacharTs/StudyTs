import type { AnimationParams } from 'animejs';

interface Point { x: number; y: number }
interface Segment { cmd: string; nums: number[] }

const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Z: 0 };
const TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g;

function parseSegments(d: string): Segment[] | null {
  const segments: Segment[] = [];
  for (const token of d.match(TOKEN) ?? []) {
    if (/[A-Za-z]/.test(token)) {
      if (!(token in ARITY)) return null;
      segments.push({ cmd: token, nums: [] });
    } else {
      const last = segments[segments.length - 1];
      if (!last) return null;
      last.nums.push(Number(token));
    }
  }
  return segments.every((seg) => seg.nums.length === ARITY[seg.cmd]) ? segments : null;
}

// A line becomes a cubic with its control points on the chord, so a straight link and a bent one share one command layout.
function toCubics(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  let current: Point = { x: 0, y: 0 };
  let start: Point = current;
  for (const seg of segments) {
    if (seg.cmd === 'Z') {
      out.push(seg);
      current = start;
    } else if (seg.cmd === 'M') {
      current = { x: seg.nums[0], y: seg.nums[1] };
      start = current;
      out.push(seg);
    } else if (seg.cmd === 'L') {
      const to = { x: seg.nums[0], y: seg.nums[1] };
      const c1 = { x: current.x + (to.x - current.x) / 3, y: current.y + (to.y - current.y) / 3 };
      const c2 = { x: current.x + (2 * (to.x - current.x)) / 3, y: current.y + (2 * (to.y - current.y)) / 3 };
      out.push({ cmd: 'C', nums: [c1.x, c1.y, c2.x, c2.y, to.x, to.y] });
      current = to;
    } else {
      out.push(seg);
      current = { x: seg.nums[4], y: seg.nums[5] };
    }
  }
  return out;
}

const serialize = (segments: Segment[]): string => segments.map((seg) => [seg.cmd, ...seg.nums].join(' ')).join(' ');

// Both ends in one command layout, or null when the two paths differ in structure and cannot be paired.
function pairedPaths(fromD: string, toD: string): [string, string] | null {
  const from = parseSegments(fromD);
  const to = parseSegments(toD);
  if (!from || !to) return null;
  const a = toCubics(from);
  const b = toCubics(to);
  if (a.length !== b.length || a.some((seg, i) => seg.cmd !== b[i].cmd)) return null;
  return [serialize(a), serialize(b)];
}

// Anime.js interpolates a path string number by number, so a straight-to-bent change turns into garbage mid-tween unless both ends share a layout.
export function morphablePathParams(params: AnimationParams): AnimationParams {
  const record = params as unknown as Record<string, unknown>;
  if (typeof record.d !== 'string') return params;
  const target = record.d;
  const sides = (el: Element): [string, string] => {
    const current = el.getAttribute('d') ?? target;
    return pairedPaths(current, target) ?? [current, target];
  };
  return { ...record, d: [(el: Element) => sides(el)[0], (el: Element) => sides(el)[1]] } as unknown as AnimationParams;
}
