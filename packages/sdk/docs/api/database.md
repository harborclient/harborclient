# Database

Plugin-scoped SQLite database. Each plugin id gets its own file under HarborClient userData (`plugin-databases/{pluginId}.sqlite`). Requires the `database` permission.

Use `hc.database` when you need indexed queries, relational data, or large structured stores. Keep small settings in `hc.storage`; the two APIs share no tables and neither can access HarborClient collections or other plugins' data.

`get`, `all`, and `run` accept **single-statement** parameterized SQL (`?` placeholders). Use `exec` for migration scripts (multi-statement DDL). Use `transaction` for atomic multi-step writes.

## Main entry

The main entry uses the same database API. Calls route through the Electron main process, which opens one isolated file per plugin id. Use this from HTTP hooks when you need relational persistence without a renderer bridge.

<HcMethod name="database.all" :level="2" />

<HcMethod name="database.exec" :level="2" />

<HcMethod name="database.get" :level="2" />

<HcMethod name="database.run" :level="2" />

<HcMethod name="database.transaction" :level="2" />
