export function adminReturnUrl(
  request: Request,
  form: FormData,
  fallbackPath: string,
): URL {
  const requestUrl = new URL(request.url);
  const raw = form.get("returnTo");
  const candidate = new URL(typeof raw === "string" && raw ? raw : fallbackPath, requestUrl);

  if (candidate.origin !== requestUrl.origin || !candidate.pathname.startsWith("/admin/")) {
    return new URL(fallbackPath, requestUrl);
  }

  candidate.hash = "";
  return candidate;
}

export function redirectAdmin(
  url: URL,
  params: Record<string, string | null | undefined>,
): Response {
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
  }
  return Response.redirect(url, 303);
}
