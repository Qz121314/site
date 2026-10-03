import type { SectionInput } from '../api';

export type SectionEditorInput = SectionInput & {
  iconAssetId: string | null;
  browseBackgroundAssetId: string | null;
};

export const emptySectionForm: SectionEditorInput = {
  name: '',
  description: '',
  browseButtonLabel: '',
  iconValue: '',
  iconAssetId: null,
  browseBackgroundAssetId: null,
  sortOrder: 0,
  isEnabled: true,
  isVisible: true,
};
