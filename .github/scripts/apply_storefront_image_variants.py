from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, value: str) -> None:
    (ROOT / path).write_text(value, encoding='utf-8')


def replace_once(path: str, old: str, new: str) -> None:
    source = read(path)
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    write(path, source.replace(old, new, 1))

# Section catalog cards are a major image surface. Use the same R2 image variant
# strategy already used by the home feed, and eagerly prioritize only the first row.
replace_once(
    'apps/storefront/src/SectionPage.tsx',
    """import { loadSectionSnapshot, type StorefrontBootstrap } from './content';""",
    """import {
  loadSectionSnapshot,
  publicImageVariantUrl,
  type StorefrontBootstrap,
} from './content';""",
)
replace_once(
    'apps/storefront/src/SectionPage.tsx',
    """            {filteredProducts.map((product) => (
              <LinkComponent""",
    """            {filteredProducts.map((product, index) => {
              const src =
                publicImageVariantUrl(product.coverObjectKey, 640) ?? product.coverUrl;
              const srcSet = product.coverObjectKey
                ? ([384, 640, 960] as const)
                    .map(
                      (width) =>
                        `${publicImageVariantUrl(product.coverObjectKey, width)} ${width}w`,
                    )
                    .join(', ')
                : undefined;
              return (
              <LinkComponent""",
)
replace_once(
    'apps/storefront/src/SectionPage.tsx',
    """                    fallback={<div className="image-fallback" aria-hidden="true" />}
                    loading="lazy"
                    src={product.coverUrl}
                  />""",
    """                    fallback={<div className="image-fallback" aria-hidden="true" />}
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    height={640}
                    loading={index < 2 ? 'eager' : 'lazy'}
                    sizes="(max-width: 767px) 46vw, 372px"
                    src={src}
                    srcSet={srcSet}
                    width={640}
                  />""",
)
replace_once(
    'apps/storefront/src/SectionPage.tsx',
    """              </LinkComponent>
            ))}""",
    """              </LinkComponent>
              );
            })}""",
)

# Browse product search uses the same 2-column card geometry, so avoid downloading
# original full-size covers there as well.
replace_once(
    'apps/storefront/src/BrowsePage.tsx',
    """  loadSectionSnapshot,
  type PublicProductSummary,""",
    """  loadSectionSnapshot,
  publicImageVariantUrl,
  type PublicProductSummary,""",
)
replace_once(
    'apps/storefront/src/BrowsePage.tsx',
    """              {filteredProducts.map((product) => (
                <LinkComponent""",
    """              {filteredProducts.map((product, index) => {
                const src =
                  publicImageVariantUrl(product.coverObjectKey, 640) ?? product.coverUrl;
                const srcSet = product.coverObjectKey
                  ? ([384, 640, 960] as const)
                      .map(
                        (width) =>
                          `${publicImageVariantUrl(product.coverObjectKey, width)} ${width}w`,
                      )
                      .join(', ')
                  : undefined;
                return (
                <LinkComponent""",
)
replace_once(
    'apps/storefront/src/BrowsePage.tsx',
    """                      fallback={<span className="image-fallback" aria-hidden="true" />}
                      loading="lazy"
                      src={product.coverUrl}
                    />""",
    """                      fallback={<span className="image-fallback" aria-hidden="true" />}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      height={640}
                      loading={index < 2 ? 'eager' : 'lazy'}
                      sizes="(max-width: 767px) 46vw, 372px"
                      src={src}
                      srcSet={srcSet}
                      width={640}
                    />""",
)
replace_once(
    'apps/storefront/src/BrowsePage.tsx',
    """                </LinkComponent>
              ))}""",
    """                </LinkComponent>
                );
              })}""",
)

write(
    'apps/storefront/test/catalog-image-variants.test.mjs',
    """import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('catalog and browse product cards request responsive R2 image variants', () => {
  const section = source('../src/SectionPage.tsx');
  const browse = source('../src/BrowsePage.tsx');

  for (const value of [section, browse]) {
    assert.ok(value.includes('publicImageVariantUrl(product.coverObjectKey, 640)'));
    assert.ok(value.includes('[384, 640, 960]'));
    assert.ok(value.includes('srcSet={srcSet}'));
    assert.ok(value.includes('sizes="(max-width: 767px) 46vw, 372px"'));
  }
  assert.ok(section.includes("loading={index < 2 ? 'eager' : 'lazy'}"));
  assert.ok(browse.includes("loading={index < 2 ? 'eager' : 'lazy'}"));
});
""",
)

print('Responsive storefront catalog image variants applied.')
