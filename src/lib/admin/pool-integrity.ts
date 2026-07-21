export function isConversionAvailabilityConstraintError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("conversion group is used by published products") ||
    message.includes("published product conversion group requires an enabled resource")
  );
}

export function isProductConversionAvailabilityConstraintError(error: unknown): boolean {
  return String(error).includes("published product requires an available conversion group");
}

export function adPoolIntegrityErrorCode(error: unknown): "in-use" | "unavailable" | null {
  const message = String(error);
  if (
    message.includes("bound hero ad pool cannot be disabled") ||
    message.includes("bound hero ad pool requires an enabled advertisement")
  ) {
    return "in-use";
  }
  if (message.includes("hero ad pool must be enabled and contain an enabled ad")) {
    return "unavailable";
  }
  return null;
}
