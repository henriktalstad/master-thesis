"use client";

import Image, { type ImageProps } from "next/image";
import * as React from "react";

type SafeRemoteImageProps = Omit<ImageProps, "onError" | "src"> & {
  src: string;
  /** Vises når lasting feiler (404/410, ugyldig bilde for `next/image`, osv.). */
  fallback?: React.ReactNode;
  onError?: ImageProps["onError"];
};

type ImageLoadState = {
  failed: boolean;
  src: string;
};

/**
 * `next/image` med `onError` → skjul ødelagte eksterne URL-er (f.eks. slettet UploadThing)
 * uten å kaste i konsollen eller la brukeren se et avbrutt bilde.
 */
export function SafeRemoteImage({
  src,
  fallback = null,
  onError: onErrorProp,
  ...rest
}: SafeRemoteImageProps) {
  return (
    <SafeRemoteImageInner
      src={src}
      fallback={fallback}
      onError={onErrorProp}
      {...rest}
    />
  );
}

function SafeRemoteImageInner({
  src,
  fallback = null,
  onError: onErrorProp,
  alt = "",
  ...rest
}: SafeRemoteImageProps) {
  const [loadState, setLoadState] = React.useState<ImageLoadState>(() => ({
    failed: false,
    src,
  }));

  if (loadState.src !== src) {
    setLoadState({ failed: false, src });
  }

  if (loadState.failed) {
    return <>{fallback}</>;
  }

  return (
    <Image
      alt={alt}
      {...rest}
      src={src}
      onError={(e) => {
        setLoadState((prev) => ({ ...prev, failed: true }));
        onErrorProp?.(e);
      }}
    />
  );
}
