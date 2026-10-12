export function parseId(input: unknown): string {
  if (typeof input === 'string' && input.length > 0) return input;
  throw new Error('Invalid ID');
}
