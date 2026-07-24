export {};

type CreativeType = "uploaded_image" | "external_media" | "embed_code";

type ProductAdvertisement = {
  id: string;
  name: string;
  creativeType: CreativeType;
  imageUrl: string | null;
  fallbackImageUrl: string | null;
  mediaUrl: string;
  embedCode: string;
  targetUrl: string;
  width: number;
  height: number;
  openMode: "same" | "new";
};

type ProductAdContext = {
  channelSlug: string;
};

const MINIMUM_WIDTH = 1400;
const TARGET_RATIO = 300 / 250;

function validAdvertisement(value: unknown): value is ProductAdvertisement {
  if (!value || typeof value !== "object") return false;
  const ad = value as Record<string, unknown>;
  return typeof ad.id === "string"
    && typeof ad.name === "string"
    && ["uploaded_image", "external_media", "embed_code"].includes(String(ad.creativeType))
    && (ad.imageUrl === null || typeof ad.imageUrl === "string")
    && (ad.fallbackImageUrl === null || typeof ad.fallbackImageUrl === "string")
    && typeof ad.mediaUrl === "string"
    && typeof ad.embedCode === "string"
    && typeof ad.targetUrl === "string"
    && typeof ad.width === "number"
    && ad.width > 0
    && typeof ad.height === "number"
    && ad.height > 0
    && (ad.openMode === "same" || ad.openMode === "new");
}

function parseContext(node: HTMLScriptElement): ProductAdContext | null {
  try {
    const value: unknown = JSON.parse(node.textContent || "null");
    if (!value || typeof value !== "object") return null;
    const channelSlug = (value as Record<string, unknown>).channelSlug;
    return typeof channelSlug === "string" && channelSlug ? { channelSlug } : null;
  } catch {
    return null;
  }
}

function rankedCandidates(candidates: ProductAdvertisement[]): ProductAdvertisement[] {
  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(left.width / left.height - TARGET_RATIO);
    const rightDistance = Math.abs(right.width / right.height - TARGET_RATIO);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return right.width * right.height - left.width * left.height;
  });
}

function waitForImage(source: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error("Product advertisement image timed out"));
    }, 8000);
    image.alt = "";
    image.width = width;
    image.height = height;
    image.decoding = "async";
    image.draggable = false;
    image.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Product advertisement image failed"));
    }, { once: true });
    image.src = source;
  });
}

async function firstWorkingImage(
  sources: Array<string | null>,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  let lastError: unknown = new Error("Product advertisement image source is missing");
  for (const source of [...new Set(sources.filter((value): value is string => Boolean(value)))]) {
    try {
      return await waitForImage(source, width, height);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function embedDocument(code: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}body{display:grid;place-items:center;min-height:100vh}img,video,iframe{display:block;max-width:100%;height:auto}</style></head><body>${code}</body></html>`;
}

function waitForEmbed(advertisement: ProductAdvertisement): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    const timeout = window.setTimeout(() => {
      frame.remove();
      reject(new Error("Product advertisement code timed out"));
    }, 8000);
    frame.title = advertisement.name || "Sponsored content";
    frame.width = String(advertisement.width);
    frame.height = String(advertisement.height);
    frame.loading = "eager";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.sandbox.add("allow-scripts", "allow-forms", "allow-popups", "allow-popups-to-escape-sandbox");
    frame.className = "affiliate-ad-embed";
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.top = "0";
    frame.style.visibility = "hidden";
    frame.addEventListener("load", () => {
      window.clearTimeout(timeout);
      frame.style.position = "";
      frame.style.left = "";
      frame.style.top = "";
      frame.style.visibility = "";
      resolve(frame);
    }, { once: true });
    frame.srcdoc = embedDocument(advertisement.embedCode);
    document.body.appendChild(frame);
  });
}

async function creative(advertisement: ProductAdvertisement): Promise<HTMLElement> {
  if (advertisement.creativeType === "embed_code") return waitForEmbed(advertisement);
  if (!advertisement.targetUrl) throw new Error("Product advertisement target URL is missing");

  const image = advertisement.creativeType === "external_media"
    ? await firstWorkingImage([advertisement.mediaUrl], advertisement.width, advertisement.height)
    : await firstWorkingImage(
        [advertisement.imageUrl, advertisement.fallbackImageUrl],
        advertisement.width,
        advertisement.height,
      );
  image.className = "affiliate-ad-image";

  const link = document.createElement("a");
  link.className = "affiliate-ad-link";
  link.href = advertisement.targetUrl;
  link.rel = "sponsored noopener noreferrer";
  if (advertisement.openMode === "new") link.target = "_blank";
  link.appendChild(image);
  return link;
}

function shell(advertisement: ProductAdvertisement, element: HTMLElement): HTMLElement {
  const root = document.createElement("section");
  root.className = "affiliate-ad affiliate-ad-detail";
  root.dataset.affiliateAd = advertisement.id;
  root.dataset.affiliateAdType = "product-detail";
  root.setAttribute("aria-label", "Sponsored advertisement");

  const label = document.createElement("span");
  label.className = "affiliate-ad-label";
  label.textContent = "Ad";

  const frame = document.createElement("div");
  frame.className = "affiliate-ad-frame";
  frame.style.setProperty("--affiliate-ad-width", `${advertisement.width}px`);
  frame.style.setProperty("--affiliate-ad-height", `${advertisement.height}px`);
  frame.appendChild(element);

  root.append(label, frame);
  return root;
}

async function initialize(): Promise<void> {
  const contextNode = document.querySelector<HTMLScriptElement>("script[data-product-detail-ad-context]");
  const slot = document.querySelector<HTMLElement>("[data-product-detail-ad-slot]");
  if (!contextNode || !slot || window.innerWidth < MINIMUM_WIDTH) return;

  const context = parseContext(contextNode);
  if (!context) {
    contextNode.dataset.productDetailAdState = "invalid-context";
    return;
  }

  contextNode.dataset.productDetailAdState = "loading";
  try {
    const response = await fetch(
      `/api/public/channels/${encodeURIComponent(context.channelSlug)}/ads?device=desktop`,
      { headers: { Accept: "application/json" }, cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Product advertisement request failed: ${response.status}`);
    const payload: unknown = await response.json();
    const candidateValue = payload && typeof payload === "object"
      ? (payload as Record<string, unknown>).candidates
      : null;
    const banners = candidateValue && typeof candidateValue === "object"
      ? (candidateValue as Record<string, unknown>).banners
      : null;
    const candidates = rankedCandidates(Array.isArray(banners) ? banners.filter(validAdvertisement) : []);
    contextNode.dataset.productDetailAdCandidateCount = String(candidates.length);

    for (const advertisement of candidates) {
      try {
        slot.replaceChildren(shell(advertisement, await creative(advertisement)));
        contextNode.dataset.productDetailAdState = "mounted";
        return;
      } catch (error) {
        console.error(JSON.stringify({
          event: "product_detail_ad_creative_failed",
          advertisementId: advertisement.id,
          error: String(error),
        }));
      }
    }

    contextNode.dataset.productDetailAdState = candidates.length > 0 ? "creative-failed" : "empty";
  } catch (error) {
    contextNode.dataset.productDetailAdState = "request-failed";
    console.error(JSON.stringify({
      event: "product_detail_ad_initialization_failed",
      channelSlug: context.channelSlug,
      error: String(error),
    }));
  }
}

void initialize();
