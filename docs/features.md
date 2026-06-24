# Features

- **Request builder** — Method selector, URL bar, query params, headers, and body (none, JSON, or plain text). See [Making requests](/requests) for the full guide.
- **HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Response viewer** — Status, timing, size, response body (with JSON pretty-print), and headers
- **Collections** — Organize saved requests into named collections with create, rename, and delete. See [Collections](/collections) for the full guide.
- **Environments** — Global variable groups selectable from the TabBar; override collection variables when both define the same key
- **Storage locations** — Pluggable storage for collections, requests, and environments. Use SQLite locally or connect to remote engines such as Firestore, MySQL, or PostgreSQL. See [Settings](/settings) for configuration.
- **Team hubs** — Connect to [HarborClient Team Hub](https://github.com/headzoo/harborclient-service-hub) for token-based shared collections without manual storage setup per teammate. See [Team hubs](/team-hubs).
- **Team collaboration** — Point multiple HarborClient instances at the same remote storage location to share collections, environments, and saved requests across your team. Signed, encrypted collection shares use RSA keys managed under [Sharing Keys](/sharing-keys).
- **AI assistant** — Chat with OpenAI, Claude, or Google Gemini using your own API keys. The assistant can inspect collections, send requests, read responses, and query JSON bodies with JMESPath. See [AI assistant](/ai).
