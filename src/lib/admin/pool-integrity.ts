export function isConversionAvailabilityConstraintError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("conversion group is used by published products")
    || message.includes("published product conversion group requires an enabled resource")
  );
}

export function isProductConversionAvailabilityConstraintError(error: unknown): boolean {
  return String(error).includes("published product requires an available conversion group");
}
