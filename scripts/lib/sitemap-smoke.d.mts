export type SitemapValidationResult =
  | { ok: true; detail: string }
  | { ok: false; error: string };

export function validateSitemapResponse(
  response: Response,
  body: string,
  expectedOrigin: string,
): SitemapValidationResult;
