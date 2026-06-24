# AI assistant

HarborClient includes a built-in AI sidebar for working with your API requests. Chat with models from OpenAI, Claude, or Google Gemini using your own API keys, or use models provided by a connected Team Hub. When a hub offers a model, HarborClient prefers the hub and never sends you the server-side provider keys.

API keys are encrypted and stored locally on your machine. HarborClient uses the OS keychain when available; on systems without Secret Service support it falls back to a local encryption key in your application data directory. On Linux, OS-backed encryption typically requires **GNOME Keyring** or **KWallet** to be running.

![AI](images/screenshots/hc-7.png)

## API keys

Before you can chat with personal models, add at least one provider API key:

1. Open **File → Settings** (or **Cmd/Ctrl+,**).
2. Select the **AI** section in the settings sidebar.
3. Enter one or more keys:
   - **OpenAI API key**
   - **Claude API key**
   - **Google Gemini API key**
4. Click **Save**.

If you open the AI sidebar before any keys or Team Hub models are available, click **Open AI settings** in the prompt to jump straight to the AI section.

Only available models appear in the chat model picker. Labels show whether a model uses **Team Hub** or **Personal** keys. Supported models:

| Model             | Provider      |
| ----------------- | ------------- |
| GPT-4o            | OpenAI        |
| GPT-4o Mini       | OpenAI        |
| Claude 3.5 Sonnet | Claude        |
| Claude 3.5 Haiku  | Claude        |
| Gemini 1.5 Pro    | Google Gemini |
| Gemini 1.5 Flash  | Google Gemini |

See [Settings → AI](/settings#ai) for key storage details.

## Opening the AI sidebar

Show or hide the AI panel from:

- **View → AI** in the menu bar
- The **robot** button in the footer (Show/Hide AI sidebar)

Your sidebar visibility preference persists across app restarts. The AI sidebar is hidden while Settings, Team Hub, or Certificates are open.

## Using chat

The AI sidebar provides a tabbed chat panel. Use the controls in the chat tab bar and composer to manage conversations.

| Action                 | How                                                                 |
| ---------------------- | ------------------------------------------------------------------- |
| **New chat**           | `+` button in the chat tab bar                                      |
| **Open previous chat** | History button (clock icon) → select a chat                         |
| **Close tab**          | Close button on the tab (the chat remains in history until deleted) |
| **Delete chat**        | History menu → **Delete**                                           |
| **Choose model**       | Model dropdown in the composer (per chat)                           |
| **Send message**       | **Send** or **Enter** (**Shift+Enter** for a newline)               |

Chats and messages are stored locally in the local database. New chats start as **New Chat**; the tab title updates from your first message. Open tabs and the active selection persist across restarts. While the model is working, the UI shows **Thinking…**; errors appear inline below the composer.

## What the assistant can do

The assistant reads live HarborClient state through built-in tools. It inspects your workspace and responses, and can perform a few actions when you ask.

### Inspect workspace

- The collection selected in the sidebar, and all collections (with variables, headers, auth, and scripts)
- Saved requests in a collection
- Environments and which one is active
- The request open in the editor (summary and full draft, including cookies for the URL host)
- The saved request highlighted in the sidebar

### Inspect responses

- Last response summary (status, headers, short body preview, test results)
- Full response body (capped)
- JMESPath queries against JSON response bodies (for example `length(data.items)`, `data.users[*].id`)

### Actions (only when you ask)

- Send the active request (equivalent to clicking **Send**)
- Switch or clear the active environment
- Modify the active request (method, URL, params, headers, body, auth, pre/post scripts, cookies)

Changes from the assistant appear in the editor immediately. Saved requests show as unsaved until you save them yourself.

### Constraints

- The assistant uses tools to read live app state — it should not invent URLs, headers, or test results.
- It will not send requests or change environments unless you explicitly ask.
- Request edits update the open tab draft only; they are not saved to the collection automatically.
- Very long conversations may hit model context limits; start a new chat if that happens.

### Example prompts

- “What collections do I have?”
- “Summarize the last response for this request.”
- “How many items are in the response array?”
- “Send this request and tell me if the tests passed.”
- “Add a post-request script that asserts the response status is 200.”

## What's next

- [Settings](/settings) — API key storage and other application preferences
- [Making requests](/requests) — the request editor the assistant reads
- [Environments](/environments) — variables the assistant can inspect and switch
- [Collections](/collections) — saved requests the assistant can list
