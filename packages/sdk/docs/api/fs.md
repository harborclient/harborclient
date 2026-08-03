# FS

Plugin-scoped filesystem access backed by main-process permission checks and a per-plugin path allowlist. Requires `filesystem:pick` for open/save dialogs, `filesystem:read` for `readFile`, and `filesystem:write` for `writeFile` / `writeBytes`. User-selected paths from pick/save dialogs are added to the allowlist automatically; the plugin package directory is allowlisted on load. User-granted paths persist across app restarts and are restored when the plugin loads again.

<HcMethod name="fs.pickDirectory" :level="2" />

<HcMethod name="fs.pickFile" :level="2" />

<HcMethod name="fs.readFile" :level="2" />

<HcMethod name="fs.saveFile" :level="2" />

<HcMethod name="fs.writeBytes" :level="2" />

<HcMethod name="fs.writeFile" :level="2" />
