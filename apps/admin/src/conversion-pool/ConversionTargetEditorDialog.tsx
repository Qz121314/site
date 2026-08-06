import type { FormEvent } from 'react';
import type {
  AdminConversionGroup,
  AdminConversionTarget,
  ConversionTargetInput,
} from './api';

type Props = {
  group: AdminConversionGroup;
  editingTarget: AdminConversionTarget | null;
  form: ConversionTargetInput;
  saving: boolean;
  onFormChange: (form: ConversionTargetInput) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ConversionTargetEditorDialog({
  group,
  editingTarget,
  form,
  saving,
  onFormChange,
  onClose,
  onSubmit,
}: Props) {
  const isCustomerService = group.mode === 'customer_service';

  return (
    <div className="admin-dialog-backdrop" role="presentation">
      <section
        className="admin-dialog conversion-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-target-editor-title"
      >
        <div className="admin-dialog-header">
          <div>
            <p>{group.name}</p>
            <h3 id="conversion-target-editor-title">
              {editingTarget ? '编辑转化入口' : '新增转化入口'}
            </h3>
          </div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}>
            ×
          </button>
        </div>

        <form className="conversion-editor-form" onSubmit={onSubmit}>
          <label>
            <span>入口名称</span>
            <input
              type="text"
              value={form.name}
              autoFocus
              maxLength={100}
              placeholder={isCustomerService ? '例如：客服 A' : '例如：联盟链接 A'}
              onChange={(event) => onFormChange({ ...form, name: event.target.value })}
            />
          </label>

          <label>
            <span>{isCustomerService ? '客服入口地址' : '跳转链接'}</span>
            <input
              type="url"
              value={form.endpointUrl}
              placeholder="https://"
              onChange={(event) => onFormChange({ ...form, endpointUrl: event.target.value })}
            />
            <small>
              {isCustomerService
                ? '填写能够直接打开在线客服的 HTTP 或 HTTPS 地址。'
                : '用户点击 CTA 后将跳转到此地址。'}
            </small>
          </label>

          {isCustomerService ? (
            <>
              <label>
                <span>客服项目 ID（可选）</span>
                <input
                  type="text"
                  value={form.projectId ?? ''}
                  maxLength={200}
                  onChange={(event) =>
                    onFormChange({ ...form, projectId: event.target.value || null })
                  }
                />
              </label>

              <label>
                <span>扩展配置 JSON（可选）</span>
                <textarea
                  value={form.config ?? ''}
                  rows={6}
                  spellCheck={false}
                  placeholder={'{\n  "channel": "sales"\n}'}
                  onChange={(event) =>
                    onFormChange({ ...form, config: event.target.value || null })
                  }
                />
              </label>
            </>
          ) : null}

          <label>
            <span>排序</span>
            <input
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              value={form.sortOrder}
              onChange={(event) =>
                onFormChange({ ...form, sortOrder: Number(event.target.value) })
              }
            />
          </label>

          <label className="switch-row">
            <span>
              <strong>启用入口</strong>
              <small>只有启用的入口会参与轮换。</small>
            </span>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => onFormChange({ ...form, isEnabled: event.target.checked })}
            />
          </label>

          <div className="admin-dialog-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={onClose}>
              取消
            </button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? '正在保存…' : '保存入口'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
