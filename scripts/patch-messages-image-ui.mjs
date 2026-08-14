import fs from 'node:fs';

const path = 'apps/storefront/src/MessagesPage.tsx';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(
  "import { useEffect, useMemo } from 'react';",
  "import { useEffect, useMemo, useState } from 'react';",
);
source = source.replace(
  "import { subscribeSupportRealtime } from './support-realtime';\n",
  "import { subscribeSupportRealtime } from './support-realtime';\nimport { prepareSupportImage, releaseSupportImage } from './support-image-compress';\n",
);
source = source.replace(
  '  const queryClient = useQueryClient();\n',
  "  const queryClient = useQueryClient();\n  const [imageProgress, setImageProgress] = useState<number | null>(null);\n  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);\n",
);

source = source.replace(
  '  useEffect(() => {\n    if (\n      !activeConversationRef ||\n',
  `  const imageMutation = useMutation({\n    mutationFn: async (file: File) => {\n      if (!activeConversationRef) throw new Error('IMAGE_CONTEXT_UNAVAILABLE');\n      const image = await prepareSupportImage(file);\n      setImagePreviewUrl(image.previewUrl);\n      setImageProgress(0);\n      try {\n        await siteSupportGateway.sendImage(\n          activeConversationRef,\n          {\n            blob: image.blob,\n            mimeType: image.mimeType,\n            byteSize: image.byteSize,\n            width: image.width,\n            height: image.height,\n            originalName: image.originalName,\n          },\n          setImageProgress,\n        );\n      } finally {\n        releaseSupportImage(image);\n        setImagePreviewUrl(null);\n        setImageProgress(null);\n      }\n    },\n    onSuccess: async () => {\n      await Promise.all([\n        queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),\n        queryClient.invalidateQueries({\n          queryKey: ['support-conversation', activeConversationRef],\n        }),\n      ]);\n    },\n  });\n\n  useEffect(() => {\n    if (\n      !activeConversationRef ||\n`,
);

source = source.replace(
  '      sending={sendMutation.isPending}\n      sendError={sendMutation.error ? SYSTEM_UI.messageFailed : null}\n',
  `      sending={sendMutation.isPending}\n      sendError={sendMutation.error ? SYSTEM_UI.messageFailed : null}\n      onSendImage={\n        supportAvailable && activeConversationRef\n          ? async (file) => {\n              await imageMutation.mutateAsync(file);\n            }\n          : undefined\n      }\n      imageSending={imageMutation.isPending}\n      imageProgress={imageProgress}\n      imagePreviewUrl={imagePreviewUrl}\n      imageError={imageMutation.error ? SYSTEM_UI.messageFailed : null}\n`,
);

fs.writeFileSync(path, source);
