export function secureRandomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new RangeError("Random selection length must be a positive safe integer");
  }

  const range = 0x1_0000_0000;
  const ceiling = range - (range % length);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= ceiling);

  return value % length;
}
