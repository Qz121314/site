import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { useEffect } from 'react';
import { MarkdownContent } from '../../MarkdownContent';
import { ResilientImage } from '../../ResilientMedia';
import type { LandingSnapshot } from '../landing-content';
import './direct-response-landing.css';

export function DirectResponseLanding({
  snapshot,
  LinkComponent = 'a',
}: {
  snapshot: LandingSnapshot;
  LinkComponent?: StorefrontLinkComponent;
}) {
  const { landing, product, resolved } = snapshot.model;
  const gallery = product.media.filter((media) => media.publicUrl);

  useEffect(() => {
    document.title = landing.name || resolved.headline;
  }, [landing.name, resolved.headline]);

  return (
    <div className="landing-page landing-direct-response">
      <main className="landing-content" aria-labelledby="landing-headline">
        <section className="landing-hero" aria-label="Hero">
          {resolved.heroAsset?.publicUrl ? (
            <ResilientImage
              alt={resolved.headline}
              className="landing-hero-image"
              src={resolved.heroAsset.publicUrl}
            />
          ) : null}
          <div className="landing-hero-copy">
            <h1 id="landing-headline">{resolved.headline}</h1>
            {resolved.subheadline ? <p>{resolved.subheadline}</p> : null}
          </div>
        </section>

        <article className="landing-body">
          <MarkdownContent source={resolved.body} />
        </article>

        {gallery.length > 0 ? (
          <section className="landing-gallery" aria-label="Product gallery">
            {gallery.map((media) => (
              <ResilientImage
                key={media.id}
                alt={media.altText ?? resolved.headline}
                loading="lazy"
                src={media.publicUrl}
              />
            ))}
          </section>
        ) : null}

        {resolved.ctaLabel ? (
          <div className="landing-cta-wrap">
            <LinkComponent
              className="landing-cta"
              href={`/go/${encodeURIComponent(product.id)}/`}
            >
              {resolved.ctaLabel}
            </LinkComponent>
          </div>
        ) : null}
      </main>
    </div>
  );
}
