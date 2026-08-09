import type { SectionInput } from '../api';

export const sectionIconOptions = [
  '◈',
  '◎',
  '◇',
  '✦',
  '⌂',
  '◉',
  '◆',
  '▣',
  '✚',
  '✺',
  '⬡',
  '◫',
] as const;

export type SectionEditorInput = SectionInput & {
  description: string;
  iconAssetId: string | null;
  browseBackgroundAssetId: string | null;
};

export const emptySectionForm: SectionEditorInput = {
  name: '',
  description: '',
  iconValue: sectionIconOptions[0],
  iconAssetId: null,
  browseBackgroundAssetId: null,
  sortOrder: 0,
  isEnabled: true,
};
