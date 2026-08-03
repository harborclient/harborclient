Command handlers tie together menus, toolbar actions, and context menu items.

## Global variables

HarborClient stores app-wide variables in **Settings → Globals**. They use the same `Variable` shape as collection and environment variables (`key`, `value`, `defaultValue`, `share`) and participate in `{{key}}` substitution with the **lowest precedence** in the static chain:

**globals → collection → environment**

Request scripts can mutate globals with `hc.globals.get` / `hc.globals.set`; values persist after the send completes. See [Request scripts — hc.globals](https://harborclient.com/request-scripts#hcglobals).

### Reading globals from plugins

Request tab components receive the merged runtime map on `RequestTabContext.variables`. Global values are included automatically; collection and environment variables override globals when they define the same key:

```typescript
function AuditTab({ context }: { context: RequestTabContext }) {
  const baseUrl = context.variables.baseUrl;
  const token = context.variables.token;
  // ...
}
```

This snapshot reflects the editor state before send. It does not include ephemeral values from `hc.request.variables.set` during an in-flight send.

### Updating globals from plugins

Replace all global variables with a new list via the built-in host command (requires the `ui` permission):

```typescript
await hc.commands.execute('harborclient:updateGlobalVariables', [
  { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: true },
  { key: 'apiKey', value: '', defaultValue: 'dev-key', share: false }
]);
```

Each row uses `PluginVariableInput`: `key`, `value`, optional `defaultValue`, optional `share`.

To create or update **environment** variables instead, use `hc.host.createEnvironmentWithVariables` and `hc.host.updateEnvironmentVariables`.
