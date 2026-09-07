import {
  catalogViewForResource,
  getCatalogWorkspaceContext,
  type AdminView,
  type CatalogResourceKind,
} from '../admin-navigation';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from '../components/ui/segmented-control';

const RESOURCE_ITEMS: readonly { resource: CatalogResourceKind; label: string }[] = [
  { resource: 'products', label: '商品' },
  { resource: 'categories', label: '分类' },
  { resource: 'tags', label: '标签' },
];

type CatalogWorkspaceSwitcherProps = {
  activeView: AdminView;
  sectionName: string;
  onNavigate: (view: AdminView) => void;
};

export function CatalogWorkspaceSwitcher({
  activeView,
  sectionName,
  onNavigate,
}: CatalogWorkspaceSwitcherProps) {
  const context = getCatalogWorkspaceContext(activeView);
  if (!context) return null;

  return (
    <div className="catalog-workspace-switcher">
      <strong className="catalog-workspace-section" title={sectionName}>
        {sectionName}
      </strong>
      <AdminSegmentedControl
        className="section-workspace-nav"
        ariaLabel={`${sectionName} 资源工作区`}
      >
        {RESOURCE_ITEMS.map((item) => {
          const active = item.resource === context.resource;
          return (
            <AdminSegmentedItem
              selected={active}
              current={active}
              key={item.resource}
              type="button"
              onClick={() =>
                onNavigate(catalogViewForResource(item.resource, context.sectionId))
              }
            >
              {item.label}
            </AdminSegmentedItem>
          );
        })}
      </AdminSegmentedControl>
    </div>
  );
}
