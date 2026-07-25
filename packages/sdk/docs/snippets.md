# Snippets

HarborClient **snippets** are reusable JavaScript blocks stored in your snippet library. Use them in collection and request scripts in two ways:

1. **Script-list reference** — add a snippet with **Select snippet…** so it runs as its own stage slot (see [Request scripts — Snippets](https://harborclient.com/scripting#snippets)).
2. **ESM import** — `import` importable snippets or sibling inline scripts by filename from inline scripts or other snippets.

This page covers types, import syntax, and editor setup. For marketplace bundles and library management, see [Using snippets](https://harborclient.com/using-snippets) on the main docs site.

## TypeScript and editor support

Install `@harborclient/sdk` as a dev dependency, then reference the snippets ambient types at the top of script or snippet files you edit outside HarborClient:

```typescript
/// <reference types="@harborclient/sdk/snippets" />
```

This exposes the global `hc` object and `console` with the same surface as the runtime sandbox. It does **not** resolve `./other-snippet.js` imports to other snippet files — cross-snippet imports are resolved at send time only.

For the full `hc` API reference, see [Request scripts](https://harborclient.com/request-scripts) on the main docs site.

## Importable snippet names

Only scripts or snippets whose **Name** looks like a filename ending in `.js` can be imported. Valid examples:

- `pass-testing.js`
- `utils/format-date.js`
- `before.js` (inline script row in a request or collection script list)

Human-readable names such as `Pass Testing` work with **Select snippet…** but cannot be import targets. Path segments use letters, digits, dots, underscores, and hyphens. Names must not start with `/` or contain `..`.

Import targets come from your **snippet library** and from **inline scripts** in the same request and its collection (pre- and post-request lists). A disabled inline script with an importable name remains importable as a helper-only module even when it does not run as its own slot.

When a name is import-valid, **Settings → Snippets** shows a hint that other scripts may import it. Renaming may break existing `import './…'` references.

## Exporting from snippets

Snippets use ordinary ESM export syntax:

```javascript
/// <reference types="@harborclient/sdk/snippets" />

export function passTest(value) {
  hc.test('value is truthy', () => {
    hc.expect(value).to.be.true;
  });
}

export default function formatStatus(code) {
  return `${code} OK`;
}
```

A snippet can export helpers **and** include top-level code that runs when the snippet is used as a direct script-list slot.

## Importing snippets

Use a **relative** path that matches the snippet **Name**:

```javascript
/// <reference types="@harborclient/sdk/snippets" />
import formatStatus from './format-status.js';
import { passTest } from './pass-testing.js';
import { formatDate } from './utils/format-date.js';

passTest(hc.response.status === 200);
```

HarborClient script editors autocomplete `./` import paths — top-level files, folder segments (`utils/`), and nested files.

At send time, HarborClient bundles relative imports against your snippet library and sibling inline scripts, then evaluates the result in the SES sandbox. Imported module top-level side effects run once per bundled script execution. Module state does not persist across sends; use `hc.data` for structured data shared within one send.

## Limits

| Supported                                             | Not supported yet                           |
| ----------------------------------------------------- | ------------------------------------------- |
| Relative `./snippet-name.js` imports between snippets | Bare npm imports (`import x from "lodash"`) |
| `export` / `import` ESM syntax                        | `require()`                                 |
| Top-level `await`                                     | Node.js built-ins (`fs`, `path`, …)         |

Duplicate importable names (library snippets or inline scripts) produce an **ambiguous import** error at send time.

## See also

- [Request scripts — Importing snippets](https://harborclient.com/scripting#importing-snippets) — user guide and examples
- [Settings — Snippets](https://harborclient.com/settings#snippets) — create and name snippets
- [Plugins vs scripts](/vs-request-scripts) — how plugins differ from request scripts
