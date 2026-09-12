import { GripVertical } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '../components/ui/button';
import { AdminFeedbackState } from '../components/ui/feedback-state';
import { AdminStatusBadge, type AdminStatusTone } from '../components/ui/status-badge';
import type { AdminProduct } from './api';

type ProductDropPosition = 'before' | 'after';

type ProductTableProps = {
  sectionId: string;
  scope: 'active' | 'trash';
  products: AdminProduct[];
  loading: boolean;
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  working: boolean;
  reorderDisabled: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEdit: (product: AdminProduct) => void;
  onCopy: (product: AdminProduct) => void;
  onDelete: (product: AdminProduct) => void;
  onCopyLink: (product: AdminProduct) => void;
  onRestore: (product: AdminProduct) => void;
  onMove: (product: AdminProduct, direction: -1 | 1) => void;
  onReorder: (draggedId: string, targetId: string, position: ProductDropPosition) => void;
};

const PRODUCT_TABLE_COLUMN_COUNT = 6;
const DEFAULT_COLUMN_WIDTHS = [4, 29, 19, 15, 13, 20];
const MIN_COLUMN_WIDTHS = [4, 18, 15, 10, 9, 15];

type ColumnResizeState = {
  index: number;
  startX: number;
  startWidths: number[];
};

function columnWidthsStorageKey(sectionId: string): string {
  return `site.admin.product-table-columns.v1:${sectionId}`;
}

function readColumnWidths(sectionId: string): number[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(columnWidthsStorageKey(sectionId)) ?? 'null',
    );
    if (
      !Array.isArray(parsed) ||
      parsed.length !== PRODUCT_TABLE_COLUMN_COUNT ||
      parsed.some((value) => typeof value !== 'number' || value < 0)
    ) {
      return DEFAULT_COLUMN_WIDTHS;
    }
    return parsed;
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

function statusLabel(status: AdminProduct['status']): string {
  switch (status) {
    case 'published':
      return '已发布';
    case 'archived':
      return '已归档';
    default:
      return '草稿';
  }
}

function statusTone(status: AdminProduct['status']): AdminStatusTone {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'warning';
  return 'default';
}

function serviceModeLabel(mode: AdminProduct['serviceMode']): string {
  return mode === 'online' ? '线上服务' : '线下服务';
}

export function ProductTable({
  sectionId,
  scope,
  products,
  loading,
  selectedIds,
  allVisibleSelected,
  working,
  reorderDisabled,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onCopy,
  onDelete,
  onCopyLink,
  onRestore,
  onMove,
  onReorder,
}: ProductTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const resizeRef = useRef<ColumnResizeState | null>(null);
  const loadedSectionRef = useRef<string | null>(null);
  const [columnWidths, setColumnWidths] = useState(() => readColumnWidths(sectionId));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: ProductDropPosition;
  } | null>(null);
  const canReorder = scope === 'active' && !working && !reorderDisabled;

  useEffect(() => {
    loadedSectionRef.current = sectionId;
    setColumnWidths(readColumnWidths(sectionId));
  }, [sectionId]);

  useEffect(() => {
    if (loadedSectionRef.current !== sectionId) return;
    try {
      window.localStorage.setItem(
        columnWidthsStorageKey(sectionId),
        JSON.stringify(columnWidths),
      );
    } catch {
      // Column layout remains usable when browser storage is unavailable.
    }
  }, [columnWidths, sectionId]);

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      const resize = resizeRef.current;
      const table = tableRef.current;
      if (!resize || !table) return;
      const tableWidth = table.getBoundingClientRect().width;
      if (tableWidth <= 0) return;

      const delta = ((event.clientX - resize.startX) / tableWidth) * 100;
      const nextIndex = resize.index + 1;
      const nextWidths = [...resize.startWidths];
      const currentMin = MIN_COLUMN_WIDTHS[resize.index] ?? 0;
      const nextMin = MIN_COLUMN_WIDTHS[nextIndex] ?? 0;
      const startCurrent = resize.startWidths[resize.index] ?? 0;
      const startNext = resize.startWidths[nextIndex] ?? 0;
      const currentWidth = Math.max(currentMin, startCurrent + delta);
      const adjustedDelta = currentWidth - startCurrent;
      nextWidths[resize.index] = currentWidth;
      nextWidths[nextIndex] = startNext - adjustedDelta;
      if (nextWidths[nextIndex] < nextMin) return;
      setColumnWidths(nextWidths);
    }

    function handlePointerUp() {
      resizeRef.current = null;
      document.body.classList.remove('is-resizing-product-columns');
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  function beginColumnResize(index: number, event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      index,
      startX: event.clientX,
      startWidths: columnWidths,
    };
    document.body.classList.add('is-resizing-product-columns');
  }

  function nudgeColumnResize(index: number, delta: number) {
    setColumnWidths((currentWidths) => {
      const nextIndex = index + 1;
      const currentWidth = Math.max(
        MIN_COLUMN_WIDTHS[index] ?? 0,
        (currentWidths[index] ?? 0) + delta,
      );
      const nextWidth =
        (currentWidths[nextIndex] ?? 0) - (currentWidth - (currentWidths[index] ?? 0));
      if (nextWidth < (MIN_COLUMN_WIDTHS[nextIndex] ?? 0)) return currentWidths;
      const nextWidths = [...currentWidths];
      nextWidths[index] = currentWidth;
      nextWidths[nextIndex] = nextWidth;
      return nextWidths;
    });
  }

  function renderColumnHeader(label: string, index: number) {
    return (
      <th>
        <span>{label}</span>
        {index < PRODUCT_TABLE_COLUMN_COUNT - 1 ? (
          <span
            className="product-column-resizer"
            role="separator"
            tabIndex={0}
            aria-label={`调整${label}列宽`}
            title="拖动调整列宽"
            onPointerDown={(event) => beginColumnResize(index, event)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                nudgeColumnResize(index, -1);
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                nudgeColumnResize(index, 1);
              }
            }}
          >
            <GripVertical aria-hidden="true" size={13} strokeWidth={2.4} />
          </span>
        ) : null}
      </th>
    );
  }

  function clearDragState() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, product: AdminProduct) {
    if (!canReorder) {
      event.preventDefault();
      return;
    }
    setDraggingId(product.id);
    setDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', product.id);
  }

  function handleDragOver(event: DragEvent<HTMLTableRowElement>, product: AdminProduct) {
    if (!canReorder || !draggingId || draggingId === product.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const position: ProductDropPosition =
      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    setDropTarget({ id: product.id, position });
  }

  function handleDrop(event: DragEvent<HTMLTableRowElement>, product: AdminProduct) {
    event.preventDefault();
    if (!canReorder || !draggingId || draggingId === product.id || !dropTarget) {
      clearDragState();
      return;
    }
    onReorder(draggingId, product.id, dropTarget.position);
    clearDragState();
  }

  function handleHandleKeyDown(
    event: KeyboardEvent<HTMLElement>,
    product: AdminProduct,
    index: number,
  ) {
    if (!canReorder) return;
    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      onMove(product, -1);
    }
    if (event.key === 'ArrowDown' && index < products.length - 1) {
      event.preventDefault();
      onMove(product, 1);
    }
  }

  if (loading) {
    return (
      <AdminFeedbackState
        kind="loading"
        title="正在读取产品…"
        description="产品、分类、标签和转化配置会保持当前分区上下文。"
      />
    );
  }

  if (products.length === 0) {
    return (
      <AdminFeedbackState
        kind="empty"
        title={scope === 'active' ? '当前没有产品' : '回收站为空'}
        description={
          scope === 'active' ? '使用上方“新增产品”开始录入。' : '已删除产品会显示在这里。'
        }
      />
    );
  }

  return (
    <div className="product-table-wrap ui-data-table-wrap">
      <table ref={tableRef} className="product-table ui-data-table">
        <colgroup>
          {columnWidths.map((width, index) => (
            <col key={index} style={{ width: `${width}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="product-select-column">
              {scope === 'active' ? (
                <input
                  type="checkbox"
                  aria-label="选择当前结果全部产品"
                  checked={allVisibleSelected}
                  onChange={onToggleSelectAll}
                />
              ) : null}
            </th>
            {renderColumnHeader('产品', 1)}
            {renderColumnHeader('服务与转化', 2)}
            {renderColumnHeader('分类', 3)}
            {renderColumnHeader('排序', 4)}
            {renderColumnHeader('操作', 5)}
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => {
            const targetPosition =
              dropTarget?.id === product.id ? dropTarget.position : null;
            const selected = selectedIds.has(product.id);
            const rowClassName = [
              'ui-data-row',
              selected ? 'is-selected' : '',
              draggingId === product.id ? 'is-dragging' : '',
              targetPosition === 'before' ? 'is-drop-before' : '',
              targetPosition === 'after' ? 'is-drop-after' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <tr
                key={product.id}
                className={rowClassName}
                aria-selected={scope === 'active' ? selected : undefined}
                onDragOver={(event) => handleDragOver(event, product)}
                onDrop={(event) => handleDrop(event, product)}
                onDragEnd={clearDragState}
              >
                <td className="product-select-column">
                  {scope === 'active' ? (
                    <input
                      type="checkbox"
                      aria-label={`选择产品 ${product.title}`}
                      checked={selected}
                      onChange={() => onToggleSelect(product.id)}
                    />
                  ) : null}
                </td>
                <td>
                  <div className="product-table-identity">
                    <div className="product-table-cover">
                      {product.effectiveCoverUrl ? (
                        <img src={product.effectiveCoverUrl} alt="" />
                      ) : (
                        <span>无图片</span>
                      )}
                    </div>
                    <div>
                      <div className="product-table-title-row">
                        <strong>{product.title}</strong>
                        <AdminStatusBadge tone={statusTone(product.status)}>
                          {statusLabel(product.status)}
                        </AdminStatusBadge>
                      </div>
                      <small>/{product.slug}</small>
                      {!product.isVisible ? <b>前端隐藏</b> : null}
                      {product.isFeatured ? <b>热门</b> : null}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="product-table-stack">
                    <span>{serviceModeLabel(product.serviceMode)}</span>
                    <small>{product.conversionGroupName ?? '未选择转化分组'}</small>
                  </div>
                </td>
                <td>{product.categoryName ?? '未分类'}</td>
                <td>
                  <div className="product-order-cell">
                    <span className="product-order-index">{index + 1}</span>
                    {scope === 'active' ? (
                      <span
                        className="product-drag-handle"
                        role="button"
                        tabIndex={reorderDisabled || working ? -1 : 0}
                        aria-disabled={!canReorder}
                        aria-label={`拖拽调整产品 ${product.title} 的顺序；键盘可使用上下方向键`}
                        title={
                          reorderDisabled
                            ? '清除搜索和状态筛选后可拖拽排序'
                            : '拖拽调整顺序'
                        }
                        draggable={canReorder}
                        onDragStart={(event) => handleDragStart(event, product)}
                        onKeyDown={(event) => handleHandleKeyDown(event, product, index)}
                      >
                        <GripVertical aria-hidden="true" size={17} />
                      </span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className="product-row-actions ui-row-actions">
                    {scope === 'active' ? (
                      <>
                        <Button
                          variant="ghost"
                          size="compact"
                          disabled={working}
                          aria-label={`复制产品链接 ${product.title}`}
                          onClick={() => onCopyLink(product)}
                        >
                          复制链接
                        </Button>
                        <Button
                          variant="ghost"
                          size="compact"
                          disabled={working}
                          aria-label={`复制产品 ${product.title}`}
                          onClick={() => onCopy(product)}
                        >
                          复制
                        </Button>
                        <Button
                          variant="ghost"
                          size="compact"
                          disabled={working}
                          aria-label={`编辑产品 ${product.title}`}
                          onClick={() => onEdit(product)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="compact"
                          className="ui-row-action-danger"
                          disabled={working}
                          aria-label={`删除产品 ${product.title}`}
                          onClick={() => onDelete(product)}
                        >
                          删除
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        size="compact"
                        disabled={working}
                        aria-label={`恢复产品 ${product.title}`}
                        onClick={() => onRestore(product)}
                      >
                        恢复
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
