import { renderProductBody as renderLegacyProductBody } from "@/lib/admin/product-form";

type ListKind = "ordered" | "unordered";

function listKind(line: string): ListKind | null {
  const markerLine = line.trimStart();
  if (/^[-*+]\s+/u.test(markerLine)) return "unordered";
  if (/^\d+[.)]\s+/u.test(markerLine)) return "ordered";
  return null;
}

export function renderProductBody(source: string): string {
  const normalized = source.replace(/\r\n?/gu, "\n");
  const output: string[] = [];
  let previousListKind: ListKind | null = null;
  let inCodeBlock = false;

  for (const line of normalized.split("\n")) {
    const markerLine = line.trimStart();
    if (markerLine.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      previousListKind = null;
      output.push(line);
      continue;
    }

    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    const currentListKind = listKind(line);
    if (currentListKind && previousListKind && currentListKind !== previousListKind) {
      output.push("");
    }

    output.push(line);
    previousListKind = currentListKind;
  }

  return renderLegacyProductBody(output.join("\n"));
}
