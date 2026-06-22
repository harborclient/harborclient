# Features

- **Request builder** — Method selector, URL bar, query params, headers, and body (none, JSON, or plain text). See [Making requests](/requests) for the full guide.
- **HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- **Response viewer** — Status, timing, size, response body (with JSON pretty-print), and headers
- **Collections** — Organize saved requests into named collections with create, rename, and delete. See [Collections](/collections) for the full guide.
- **Environments** — Global variable groups selectable from the TabBar; override collection variables when both define the same key
- **Database backends** — Pluggable storage for collections, requests, and environments. Use SQLite locally or connect to remote engines such as Firestore, MySQL, or PostgreSQL. See [Settings](/settings) for configuration.
- **Service hubs** — Connect to [HarborClient Service Hub](https://github.com/headzoo/harborclient-service-hub) for token-based shared collections without manual database setup per teammate. See [Service hubs](/service-hubs).
- **Team collaboration** — Point multiple HarborClient instances at the same remote database to share collections, environments, and saved requests across your team. Signed, encrypted collection invites use RSA keys managed under [Certificates](/certificates).
