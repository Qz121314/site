from pathlib import Path

path = Path('apps/storefront/src/StorefrontRoot.tsx')
text = path.read_text(encoding='utf-8')
old = """        queryClient.setQueryData(['support-conversations'], (current) =>
          applyRealtimeToConversationList(current, event),
        );"""
new = """        queryClient.setQueryData<SupportConversationSummary[]>(
          ['support-conversations'],
          (current) => applyRealtimeToConversationList(current, event),
        );"""
if text.count(old) != 1:
    raise RuntimeError(f'expected one support-conversations cache updater, found {text.count(old)}')
text = text.replace(old, new, 1)

import_old = """import { siteSupportGateway } from './support-gateway';"""
import_new = """import type { SupportConversationSummary } from './support-contract';
import { siteSupportGateway } from './support-gateway';"""
if text.count(import_old) != 1:
    raise RuntimeError(f'expected one support-gateway import, found {text.count(import_old)}')
text = text.replace(import_old, import_new, 1)
path.write_text(text, encoding='utf-8')
