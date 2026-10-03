import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import type { PublicSection, StorefrontBootstrap } from './content';
import { ResilientImage } from './ResilientMedia';
import { sectionHref } from './routing';
import './browse-ui.css';
import './browse-app-surface.css';
import '@site/storefront-ui/art-direction-primary-surfaces.css';

function publishedSections(bootstrap: StorefrontBootstrap): PublicSection[] {
  const pointer = bootstrap.pointer;
  return bootstrap.home.allSections.filter((section) => {
    if (section.slug !== 'escorts' && section.slug !== 'dating') return false;
    return pointer.schemaVersion !== 2 || Boolean(pointer.sections[section.id]);
  });
}

export function BrowsePage({
  bootstrap,
  LinkComponent,
}: {
  bootstrap: StorefrontBootstrap;
  LinkComponent: StorefrontLinkComponent;
}) {
  const sections = publishedSections(bootstrap);

  useEffect(() => {
    document.title = `Escort Listings by City & Partner Platforms · ${bootstrap.site.site.name}`;
  }, [bootstrap.site.site.name]);

  return (
    <section className="browse-directory">
      <header className="browse-directory-intro">
        <h1>
          Choose a <span>service</span>
        </h1>
      </header>

      {sections.length > 0 ? (
        <section className="browse-directory-section">
          <div
            className={`browse-section-list${sections.length === 1 ? ' is-single' : ''}`}
          >
            {sections.map((section, index) => (
              <LinkComponent
                className={`browse-section-card${section.browseBackgroundUrl ? ' has-image' : ' is-fallback'}`}
                href={sectionHref(section)}
                key={section.id}
              >
                <span className="browse-section-card-media" aria-hidden="true">
                  {section.browseBackgroundUrl ? (
                    <ResilientImage
                      alt=""
                      fallback={
                        <span
                          className="browse-section-card-media-fallback"
                          aria-hidden="true"
                        />
                      }
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      src={section.browseBackgroundUrl}
                    />
                  ) : null}
                </span>
                <span className="browse-section-card-scrim" aria-hidden="true" />
                <span className="browse-section-card-content">
                  <span className="browse-section-card-copy">
                    <strong>{section.name}</strong>
                    {section.description ? <p>{section.description}</p> : null}
                  </span>
                  <span className="browse-section-card-arrow" aria-hidden="true">
                    <ArrowRight />
                  </span>
                </span>
              </LinkComponent>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
