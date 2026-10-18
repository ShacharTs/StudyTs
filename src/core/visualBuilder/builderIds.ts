export function nextId(prefix: string, taken: string[], from = 1): string {
  let number = from;
  while (taken.includes(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}
