import { useEffect, useState } from 'react';
import { brandingAssetPreviewUrl, uploadBrandingImage } from '../branding-media/api';
import {
  prepareBrandingImage,
  releaseBrandingImage,
  type BrandingImageKind,
  type LocalBrandingImage,
} from '../branding-media/local-branding-image';

export function useBrandingImageDraft({
  kind,
  assetId,
  onAssetIdChange,
}: {
  kind: BrandingImageKind;
  assetId: string | null;
  onAssetIdChange: (assetId: string | null) => void;
}) {
  const [localImage, setLocalImage] = useState<LocalBrandingImage | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => () => releaseBrandingImage(localImage), [localImage]);

  async function selectFile(file: File) {
    if (processing) return;
    setProcessing(true);
    try {
      const prepared = await prepareBrandingImage(file, kind);
      setLocalImage(prepared);
      onAssetIdChange(null);
    } finally {
      setProcessing(false);
    }
  }

  async function uploadPending(): Promise<string | null> {
    if (!localImage) return assetId;
    const uploaded = await uploadBrandingImage(kind, localImage.compressedFile);
    setLocalImage(null);
    onAssetIdChange(uploaded.media.id);
    return uploaded.media.id;
  }

  function chooseAsset(nextAssetId: string) {
    setLocalImage(null);
    onAssetIdChange(nextAssetId);
  }

  function clear() {
    setLocalImage(null);
    onAssetIdChange(null);
  }

  return {
    localImage,
    processing,
    previewUrl:
      localImage?.previewUrl ?? (assetId ? brandingAssetPreviewUrl(assetId) : null),
    selectFile,
    uploadPending,
    chooseAsset,
    clear,
  };
}
