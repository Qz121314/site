function isRelativeExtensionless(specifier) {
  return (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !specifier.split('/').at(-1)?.includes('.')
  );
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !isRelativeExtensionless(specifier)) {
      throw error;
    }

    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch (typescriptError) {
      if (typescriptError?.code !== 'ERR_MODULE_NOT_FOUND') throw typescriptError;
      return nextResolve(`${specifier}/index.ts`, context);
    }
  }
}
