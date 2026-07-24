![Logo](assets/logo-250x250.png)

# Getting Started with HarborClient

Welcome to HarborClient! Use this guide to get familiar with the app and start building, testing, and organizing API requests.

- Read the full [documentation](https://harborclient.com/).
- Read the [HarborClient blog](https://harborclient-blog.com).

## Try these basics

Work through the checklist below. Each step explains what to do in the app and links to the matching guide on [harborclient.com](https://harborclient.com/).

- [ ] **Create a request** — Open a blank tab with **File → New Request** (**Cmd/Ctrl+N**), choose a method, enter a URL, and click **Send** (or press **Enter** while the URL field is focused). Save it with **File → Save Request** (**Cmd/Ctrl+S**). See [Making requests](https://harborclient.com/requests).
- [ ] **Create a test** — Open a saved request, go to the **PostRequest** tab, and add a script such as `hc.test("status is 200", () => hc.response.to.have.status(200));`. Send the request and review pass/fail results in the response **Tests** tab. See [Testing](https://harborclient.com/testing).
- [ ] **Create a collection** — Click **+** in the **Collections** sidebar or choose **File → New Collection** (**Cmd/Ctrl+Shift+N**), enter a name, and create it. Add requests with **New Request** on the collection row or by saving an open tab. See [Collections](https://harborclient.com/collections).
- [ ] **Add a plugin** — Open **File → Plugins** (**Alt+Shift+P**), browse **Marketplace** or use **Install from file** / **Install from Git…**, then enable the plugin. See [Using plugins](https://harborclient.com/using-plugins).
- [ ] **Add a theme** — Open **File → Themes** (**Cmd/Ctrl+Shift+T**), install from **Marketplace** or **Designer**, or switch from **View → Theme**. See [Using themes](https://harborclient.com/using-themes).
- [ ] **Create an environment** — Click **+** in the **Environments** sidebar, name it, add variables (for example `baseUrl`), save, then select it from the environment dropdown on the TabBar. See [Environments](https://harborclient.com/environments).

## Frequently Asked Questions

### Do I need an account or subscription?

No. HarborClient is free to use with no accounts, subscriptions, or required cloud sync. Install the app, open it, and start sending requests — your work stays on your machine or on storage you choose.

### Where is my data stored?

By default, HarborClient stores collections, environments, and settings in a local SQLite database on your computer. You can also point the app at MySQL, PostgreSQL, Firestore, or a shared Team Hub if your team uses one. See [Storage](https://harborclient.com/storage).

### How do I use variables in a request?

Create variables in an environment (for example `baseUrl` or `apiKey`), select that environment from the dropdown on the TabBar, then reference them with double curly braces — `{{baseUrl}}/users` in the URL field or `{{apiKey}}` in headers and body fields. HarborClient substitutes the active environment values when you send the request. See [Environments](https://harborclient.com/environments).

### How do I add authentication to a request?

Open the **Auth** tab on a request or collection and choose **Basic Auth**, **Bearer Token**, or **OAuth 2.0 Client Credentials**. Request-level auth overrides collection auth; leave a request set to **None** to inherit credentials from its parent collection. See [Making requests](https://harborclient.com/requests).

### Can I import Postman or Bruno collections?

Yes. HarborClient imports Postman v2.1 collection exports and Bruno on-disk collections. Use **File → Import** or click **+** in the **Collections** sidebar and choose **Import from file**, then select your export or Bruno folder. Some Postman-specific settings may need adjustment after import. See [Collections](https://harborclient.com/collections#postman-collections).

### How do I write and run tests?

Open a saved request, go to the **PostRequest** tab, and add test scripts using the `hc` API — for example `hc.test("status is 200", () => hc.response.to.have.status(200));`. Send the request and review pass/fail results in the response **Tests** tab. You can also run every test in a collection from the collection runner. See [Testing](https://harborclient.com/testing).

### What are plugins and how do I install them?

Plugins extend HarborClient with extra auth helpers, exporters, themes, and other integrations. Open **File → Plugins** (**Alt+Shift+P**), browse the **Marketplace**, or install from a local file or Git repository, then enable the plugin. See [Using plugins](https://harborclient.com/using-plugins).

### How do I change the app theme?

Open **File → Themes** (**Cmd/Ctrl+Shift+T**) to install themes from the **Marketplace** or **Designer**, or switch quickly from **View → Theme**. Built-in options include light, dark, system, and high-contrast. See [Using themes](https://harborclient.com/using-themes).

### My request failed — what should I check?

Start with the response **Status**, **Headers**, and **Body** tabs to read the error message. Confirm the URL, method, and active environment are correct, that required headers and auth are set, and that the target server is reachable. For TLS or certificate issues, review proxy and certificate settings under **Settings**. See [Making requests](https://harborclient.com/requests).

### Where can I see keyboard shortcuts?

Open **Help → Keyboard Shortcuts** for a searchable reference of default bindings, or go to **Settings → Shortcuts** to customize them. Common defaults include **Cmd/Ctrl+N** (new request), **Cmd/Ctrl+S** (save), and **F5** (send).

### How do I share collections with my team?

Export a collection as portable JSON, store collections in a shared git repository, connect HarborClient to a database your team runs, or use a self-hosted [Team Hub](https://github.com/harborclient/team-hub) for centralized collections and plugin sources. See [Collections](https://harborclient.com/collections) and [Team Hubs](https://harborclient.com/team-hubs).

### Where can I find more help and documentation?

The full guide lives at [harborclient.com](https://harborclient.com/). For release notes, tips, and tutorials, visit the [HarborClient blog](https://harborclient-blog.com). To report bugs or request features, open an issue on [GitHub](https://github.com/harborclient/harborclient/issues).
