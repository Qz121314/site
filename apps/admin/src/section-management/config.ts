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
  iconAssetId: string | null;
};

export const emptySectionForm: SectionEditorInput = {
  name: '',
  iconValue: sectionIconOptions[0],
  iconAssetId: null,
  sortOrder: 0,
  isEnabled: true,
};
