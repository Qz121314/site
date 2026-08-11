import type { AdminCategory } from '../category-management/api';
import type { AdminConversionGroup } from '../conversion-pool/api';
import type { AdminProductTag } from '../tag-management/api';
import type { ProductInput } from './api';
import {
  isEditorMediaCoverEligible,
  type ProductEditorImage,
} from './product-editor-media';

export function validateProductDraft(
  form: ProductInput,
  media: ProductEditorImage[],
  categories: AdminCategory[],
  tags: AdminProductTag[],
  groups: AdminConversionGroup[],
): string | null {
  if (!form.title.trim()) return '请填写产品标题。';
  if (!form.body.trim()) return '请填写产品正文。';
  if (form.tagIds.length > 12) return '每个产品最多选择 12 个标签。';
  if (form.status !== 'published') return null;

  if (form.categoryId) {
    const category = categories.find((item) => item.id === form.categoryId);
    if (!category || !category.isEnabled) return '所选分类不存在或已停用。';
  }

  if (form.tagIds.some((id) => !tags.some((tag) => tag.id === id && tag.isEnabled))) {
    return '发布产品不能使用已停用或不存在的标签。';
  }

  if (form.conversionGroupId) {
    const group = groups.find((item) => item.id === form.conversionGroupId);
    const expectedMode = form.serviceMode === 'online' ? 'link' : 'customer_service';
    if (!group || !group.isEnabled || group.mode !== expectedMode) {
      return form.serviceMode === 'online'
        ? '所选转化分组必须是启用的外部链接分组。'
        : '所选转化分组必须是启用的在线客服分组。';
    }
    if (group.activeTargetCount < 1) return '所选转化分组至少需要一个启用入口。';
  }

  if (media.length < 1) return '发布产品前至少需要一个产品媒体。';
  if (!media.some(isEditorMediaCoverEligible))
    return '发布产品前至少需要一张图片或 GIF 作为封面。';
  return null;
}
