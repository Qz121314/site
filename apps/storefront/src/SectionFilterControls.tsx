import { StorefrontIconButton } from '@site/storefront-ui/icon-button';
import { ListFilter } from 'lucide-react';
import { useState } from 'react';
import { SYSTEM_UI } from './system-ui';
import './section-compact-filters.css';

type FilterOption = {
  id: string;
  name: string;
};

export function SectionFilterControls({
  categories,
  tags,
  categoryId,
  selectedTags,
  onCategoryChange,
  onToggleTag,
  onClearTags,
}: {
  categories: readonly FilterOption[];
  tags: readonly FilterOption[];
  categoryId: string;
  selectedTags: ReadonlySet<string>;
  onCategoryChange: (categoryId: string) => void;
  onToggleTag: (tagId: string) => void;
  onClearTags: () => void;
}) {
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const hasCategories = categories.length > 0;
  const hasTags = tags.length > 0;

  if (!hasCategories && !hasTags) return null;

  return (
    <>
      <div className="section-catalog-filters" aria-label="Filters">
        {hasCategories ? (
          <div className="section-category-filter" aria-label="Category">
            <button
              className={!categoryId ? 'is-active' : undefined}
              type="button"
              aria-pressed={!categoryId}
              onClick={() => onCategoryChange('')}
            >
              {SYSTEM_UI.all}
            </button>
            {categories.map((category) => {
              const isActive = categoryId === category.id;
              return (
                <button
                  className={isActive ? 'is-active' : undefined}
                  key={category.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onCategoryChange(category.id)}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="section-filter-spacer" aria-hidden="true" />
        )}

        {hasTags ? (
          <StorefrontIconButton
            className={`section-tag-filter-trigger${
              selectedTags.size > 0 ? ' is-active' : ''
            }`}
            aria-label="Tags"
            aria-expanded={tagPanelOpen}
            aria-controls="section-tag-filter-panel"
            onClick={() => setTagPanelOpen((current) => !current)}
          >
            <ListFilter aria-hidden="true" />
            {selectedTags.size > 0 ? (
              <span className="section-tag-filter-count" aria-hidden="true">
                {selectedTags.size}
              </span>
            ) : null}
          </StorefrontIconButton>
        ) : null}
      </div>

      {hasTags && tagPanelOpen ? (
        <div className="section-tag-filter-panel" id="section-tag-filter-panel">
          <div className="section-tag-filter" aria-label="Tags">
            {tags.map((tag) => {
              const isActive = selectedTags.has(tag.id);
              return (
                <button
                  className={isActive ? 'is-active' : undefined}
                  key={tag.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onToggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          {selectedTags.size > 0 ? (
            <button
              className="section-tag-filter-clear"
              type="button"
              onClick={onClearTags}
            >
              {SYSTEM_UI.clear}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
