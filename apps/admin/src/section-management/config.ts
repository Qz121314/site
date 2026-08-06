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

export const emptySectionForm: SectionInput = {
  name: '',
  iconValue: sectionIconOptions[0],
  sortOrder: 0,
  isEnabled: true,
};
