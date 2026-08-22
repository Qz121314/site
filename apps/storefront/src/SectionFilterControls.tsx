import { useState } from 'react';
import { SYSTEM_UI } from './system-ui';

type FilterOption = {
  id: string;
  name: string;
};

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M3.5 5.5h13M6 10h8M8.5 14.5h3" strokeLinecap="round" />
    </svg>
  );
}

export function SectionFilterControls({
  categories,
  tags,
  categoryId,
  selectedTags,
  onCategoryChange,
  onToggleTag,
  onClearTags,
}: {
  categories: FilterOption[];
  tags: FilterOption[];
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
          <button
            className={`section-tag-filter-trigger${selectedTags.size > 0 ? ' is-active' : ''}`}
            type="button"
            aria-label="Tags"
            aria-expanded={tagPanelOpen}
            aria-controls="section-tag-filter-panel"
            onClick={() => setTagPanelOpen((current) => !current)}
          >
            <FilterIcon />
            {selectedTags.size > 0 ? (
              <span className="section-tag-filter-count" aria-hidden="true">
                {selectedTags.size}
              </span>
            ) : null}
          </button>
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
            <button className="section-tag-filter-clear" type="button" onClick={onClearTags}>
              {SYSTEM_UI.clear}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
