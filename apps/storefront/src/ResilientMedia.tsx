import {
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
  type VideoHTMLAttributes,
} from 'react';
import { sameOriginMediaFallbackUrl } from './media-fallback';

type ResilientImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  fallback?: ReactNode;
};

type ResilientVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  src?: string | null;
  fallback?: ReactNode;
};

export function ResilientImage({
  src,
  fallback = null,
  className,
  onLoad,
  onError,
  ...props
}: ResilientImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ source: string; url: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  if (!src || failedSrc === src) return <>{fallback}</>;
  const renderedSrc = retry?.source === src ? retry.url : src;

  return (
    <img
      {...props}
      className={`${className ?? ''} storefront-media-reveal${loaded ? ' is-loaded' : ''}`.trim()}
      src={renderedSrc}
      onLoad={(event) => {
        onLoad?.(event);
        setLoaded(true);
      }}
      onError={(event) => {
        onError?.(event);
        if (renderedSrc === src && typeof window !== 'undefined') {
          const retryUrl = sameOriginMediaFallbackUrl(src, window.location.origin);
          if (retryUrl) {
            setRetry({ source: src, url: retryUrl });
            return;
          }
        }
        setFailedSrc(src);
      }}
    />
  );
}

export function ResilientVideo({
  src,
  fallback = null,
  onError,
  ...props
}: ResilientVideoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ source: string; url: string } | null>(null);

  if (!src || failedSrc === src) return <>{fallback}</>;
  const renderedSrc = retry?.source === src ? retry.url : src;

  return (
    <video
      {...props}
      src={renderedSrc}
      onError={(event) => {
        onError?.(event);
        if (renderedSrc === src && typeof window !== 'undefined') {
          const retryUrl = sameOriginMediaFallbackUrl(src, window.location.origin);
          if (retryUrl) {
            setRetry({ source: src, url: retryUrl });
            return;
          }
        }
        setFailedSrc(src);
      }}
    />
  );
}
