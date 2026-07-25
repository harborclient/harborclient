# Request audit tab

This example adds a read-only **Audit** tab to the request editor. It summarizes the active draft as JSON so developers can inspect what will be sent without modifying the request.

## manifest.json

```json
{
  "id": "com.example.request-audit",
  "name": "Request Audit",
  "version": "1.0.0",
  "engines": { "harborclient": ">=1.9.0" },
  "renderer": "dist/renderer.js",
  "permissions": ["ui"],
  "contributes": {
    "requestTabs": [{ "id": "audit", "title": "Audit" }]
  }
}
```

## src/renderer.tsx

```tsx
import type { PluginContext, RequestTabContext } from '@harborclient/sdk';

function AuditTab({ context }: { context: RequestTabContext }) {
  const { draft, response } = context;
  const summary = {
    method: draft.method,
    url: draft.url,
    headerCount: draft.headers.filter((h) => h.enabled && h.key).length,
    hasBody: draft.body.trim().length > 0,
    lastStatus: response?.status ?? null
  };

  return (
    <pre className="m-0 overflow-auto rounded-md bg-control p-3 text-[14px] text-text">
      {JSON.stringify(summary, null, 2)}
    </pre>
  );
}

export function activate(hc: PluginContext): void {
  hc.ui.registerRequestTab({
    id: 'audit',
    title: 'Audit',
    Component: AuditTab
  });
}
```

The tab re-renders locally when the user edits the request — no IPC round-trip per keystroke. Use `context.response` when you need the last response for the active send, and `context.variables` when you need merged global, collection, and environment substitution values.

See [hc.ui.registerRequestTab](/renderer-ui#hc-ui-registerrequesttab-tab) for the full API reference.
