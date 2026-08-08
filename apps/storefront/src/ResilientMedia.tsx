import {
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
  type VideoHTMLAttributes,
} from 'react';

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
  onError,
  ...props
}: ResilientImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    <img
      {...props}
      src={src}
      onError={(event) => {
        onError?.(event);
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

  if (!src || failedSrc === src) return <>{fallback}</>;

  return (
    <video
      {...props}
      src={src}
      onError={(event) => {
        onError?.(event);
        setFailedSrc(src);
      }}
    />
  );
}
