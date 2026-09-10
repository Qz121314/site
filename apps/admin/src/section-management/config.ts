import type { SectionInput } from '../api';

export type SectionEditorInput = SectionInput & {
  description: string;
  iconAssetId: string | null;
  browseBackgroundAssetId: string | null;
};

export const emptySectionForm: SectionEditorInput = {
  name: '',
  description: '',
  iconValue: '',
  iconAssetId: null,
  browseBackgroundAssetId: null,
  sortOrder: 0,
  isEnabled: true,
};
