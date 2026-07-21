const UINT32_RANGE = 0x1_0000_0000;

export function secureRandomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length <= 0 || length > UINT32_RANGE) {
    throw new RangeError("Random selection length must be an integer from 1 through 2^32");
  }

  const ceiling = UINT32_RANGE - (UINT32_RANGE % length);
  const buffer = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0] ?? 0;
  } while (value >= ceiling);

  return value % length;
}
