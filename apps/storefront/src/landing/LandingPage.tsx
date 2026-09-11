import { useQuery } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { Suspense } from 'react';
import { PublicContentError } from '../content';
import { RouteProgress } from '../LoadingStates';
import { renderLandingTemplate } from './landing-template-registry';
import { loadLandingSnapshot } from './landing-content';

export function LandingPage({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: ['landing-publication', slug],
    queryFn: ({ signal }) => loadLandingSnapshot(slug, signal),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (query.isLoading) return <RouteProgress />;
  if (query.error || !query.data) {
    const notPublished = query.error instanceof PublicContentError;
    return (
      <div className="standalone-state">
        <div className="state-mark" aria-hidden="true">
          <CircleAlert />
        </div>
        <h1>
          {notPublished ? 'Landing page unavailable' : 'Unable to load landing page'}
        </h1>
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteProgress />}>{renderLandingTemplate(query.data)}</Suspense>
  );
}
