import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Expected source block not found in ${path}`);
  }
  const next = source.replace(before, after);
  if (next === source) throw new Error(`No change applied to ${path}`);
  writeFileSync(path, next);
}

replaceOnce(
  'apps/storefront/src/StorefrontRoot.tsx',
  `const ProductDetailPage = lazy(() =>\n  import('./ProductDetailPage').then((module) => ({\n    default: module.ProductDetailPage,\n  })),\n);`,
  `const LegacyProductRoute = lazy(() =>\n  import('./LegacyProductRoute').then((module) => ({\n    default: module.LegacyProductRoute,\n  })),\n);\nconst ProductDetailPage = lazy(() =>\n  import('./ProductDetailPage').then((module) => ({\n    default: module.ProductDetailPage,\n  })),\n);`,
);

replaceOnce(
  'apps/storefront/src/StorefrontRoot.tsx',
  `    case 'product':\n      routeFallback = <ProductDetailLoadingSurface />;\n      page = (\n        <ProductDetailPage\n          bootstrap={bootstrap}\n          productRef={route.productRef}\n          sectionRef={route.sectionRef}\n          LinkComponent={StorefrontLink as StorefrontLinkComponent}\n        />\n      );\n      break;`,
  `    case 'product':\n      routeFallback = <ProductDetailLoadingSurface />;\n      page = route.sectionRef ? (\n        <ProductDetailPage\n          bootstrap={bootstrap}\n          productRef={route.productRef}\n          sectionRef={route.sectionRef}\n          LinkComponent={StorefrontLink as StorefrontLinkComponent}\n        />\n      ) : (\n        <LegacyProductRoute\n          bootstrap={bootstrap}\n          productRef={route.productRef}\n          LinkComponent={StorefrontLink as StorefrontLinkComponent}\n        />\n      );\n      break;`,
);

replaceOnce(
  'apps/storefront/src/ProductDetailPage.tsx',
  `  loadProductSnapshot,\n  PublicContentError,\n  type StorefrontBootstrap,`,
  `  loadProductSnapshot,\n  PublicContentError,\n  type ProductSnapshot,\n  type PublicProductSummary,\n  type StorefrontBootstrap,`,
);

replaceOnce(
  'apps/storefront/src/ProductDetailPage.tsx',
  `function handleInternalBack(event: ReactMouseEvent<HTMLAnchorElement>) {`,
  `function findKnownProductSummary(\n  bootstrap: StorefrontBootstrap,\n  sectionRef: string,\n  productRef: string,\n): PublicProductSummary | null {\n  const section = bootstrap.home.allSections.find(\n    (item) => item.id === sectionRef || item.slug === sectionRef,\n  );\n  if (!section) return null;\n  const products = Object.values(bootstrap.productSummaries).filter(\n    (product) => product.sectionId === section.id,\n  );\n  const exactId = products.find((product) => product.id === productRef);\n  if (exactId) return exactId;\n  const slugMatches = products.filter((product) => product.slug === productRef);\n  return slugMatches.length === 1 ? (slugMatches[0] ?? null) : null;\n}\n\nfunction placeholderProductSnapshot(\n  bootstrap: StorefrontBootstrap,\n  product: PublicProductSummary,\n): ProductSnapshot {\n  const contentVersion =\n    bootstrap.pointer.schemaVersion === 2\n      ? (bootstrap.pointer.sections[product.sectionId]?.contentVersion ??\n        bootstrap.pointer.contentVersion)\n      : bootstrap.pointer.contentVersion;\n  return {\n    schemaVersion: bootstrap.pointer.schemaVersion,\n    contentVersion,\n    publishedAt: product.publishedAt ?? bootstrap.pointer.publishedAt,\n    product: {\n      ...product,\n      body: '',\n      media: [],\n    },\n  };\n}\n\nfunction handleInternalBack(event: ReactMouseEvent<HTMLAnchorElement>) {`,
);

replaceOnce(
  'apps/storefront/src/ProductDetailPage.tsx',
  `  sectionRef: string | null;`,
  `  sectionRef: string;`,
);

replaceOnce(
  'apps/storefront/src/ProductDetailPage.tsx',
  `  const mobileMediaTrackRef = useRef<HTMLDivElement | null>(null);\n  const query = useQuery({`,
  `  const mobileMediaTrackRef = useRef<HTMLDivElement | null>(null);\n  const knownProduct = findKnownProductSummary(bootstrap, sectionRef, productRef);\n  const query = useQuery({`,
);

replaceOnce(
  'apps/storefront/src/ProductDetailPage.tsx',
  `    queryFn: ({ signal }) =>\n      loadProductSnapshot(bootstrap, productRef, signal, sectionRef),\n    staleTime: Number.POSITIVE_INFINITY,`,
  `    queryFn: ({ signal }) =>\n      loadProductSnapshot(bootstrap, productRef, signal, sectionRef),\n    placeholderData: knownProduct\n      ? placeholderProductSnapshot(bootstrap, knownProduct)\n      : undefined,\n    staleTime: Number.POSITIVE_INFINITY,`,
);

replaceOnce(
  'apps/storefront/src/content.ts',
  `  } else {\n    // Legacy product URLs do not carry section context. Product slugs are only\n    // unique within a section, so a partial in-memory summary set cannot prove\n    // global uniqueness safely. Preserve the authoritative all-section lookup.\n    const snapshots = await Promise.all(\n      bootstrap.home.allSections.map((item) =>\n        loadSectionSnapshot(bootstrap, item.id, signal),\n      ),\n    );\n    matchedProduct = findPublishedProduct(\n      snapshots.flatMap((snapshot) => snapshot.products),\n      productRef,\n    );\n    if (matchedProduct) {\n      section =\n        bootstrap.home.allSections.find(\n          (item) => item.id === matchedProduct?.sectionId,\n        ) ?? null;\n    }\n  }`,
  `  } else {\n    throw new PublicContentError(\n      'INVALID_PRODUCT',\n      'Section context is required for published service details.',\n    );\n  }`,
);
