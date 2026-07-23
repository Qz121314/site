export type CategoryNavigationFilter = {
  id: string;
};

export type CategoryNavigationCategory = {
  filterIds: string[];
};

export function buildEffectiveCategoryGroups<
  Filter extends CategoryNavigationFilter,
  Category extends CategoryNavigationCategory,
>(filters: Filter[], categories: Category[]): Array<{ filter: Filter; categories: Category[] }> {
  return filters.flatMap((filter) => {
    const groupedCategories = categories.filter((category) => category.filterIds.includes(filter.id));
    return groupedCategories.length > 0 ? [{ filter, categories: groupedCategories }] : [];
  });
}

export function hasEffectiveCategoryNavigation<
  Filter extends CategoryNavigationFilter,
  Category extends CategoryNavigationCategory,
>(filters: Filter[], categories: Category[]): boolean {
  return buildEffectiveCategoryGroups(filters, categories).length > 0;
}
