import type { StorefrontLinkComponent } from '@site/storefront-ui';
import { DirectResponseLanding } from './templates/DirectResponseLanding';
import type { LandingSnapshot } from './landing-content';

export const landingTemplateRegistry = {
  direct_response: DirectResponseLanding,
} as const;

export function renderLandingTemplate(
  snapshot: LandingSnapshot,
  LinkComponent?: StorefrontLinkComponent,
) {
  if (snapshot.model.templateKey !== 'direct_response') return null;
  const Template = landingTemplateRegistry.direct_response;
  return <Template snapshot={snapshot} {...(LinkComponent ? { LinkComponent } : {})} />;
}
