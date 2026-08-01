/**
 * Authoritative HarborClient `hc` sandbox API reference for the AI agent.
 *
 * Kept as a deterministic string (not embeddings) so syntax questions get exact
 * answers instead of Chai/Postman guesses. Pin behavior with scriptExpect tests
 * before changing the guidance below.
 *
 * User-facing site docs and `resources/docsSearchIndex.json` are rebuilt
 * separately via `pnpm index-docs` from the sibling site repo; prefer this tool
 * for exact hc syntax over `search_docs` embeddings.
 */

/**
 * Full `hc` sandbox API reference returned by `get_scripting_api_reference`.
 */
export const SCRIPTING_API_REFERENCE = `# HarborClient scripting API (hc)

Use this reference for HarborClient pre-request and post-request scripts. Never
infer behavior from Postman \`pm.*\`, Jest, or raw Chai docs.

## Assertions must use hc.test

Write assertions inside \`hc.test\` so they appear as named rows in the Tests tab
and so a failure does not abort the rest of the script:

\`\`\`js
hc.test("Status code is 2xx", () => {
  hc.expect(true).to.be.ok;
});
\`\`\`

Both of these forms are valid and equivalent inside \`hc.test\`:

- \`hc.expect(true).to.be.ok;\` (property access)
- \`hc.expect(true).to.be.ok();\` (optional trailing call)

Do **not** tell users that missing parentheses is the problem. HarborClient
supports both styles via callable-property compatibility.

### Top-level assertions (outside hc.test)

A bare top-level assertion such as \`hc.expect(true).to.be.ok;\` can execute
without throwing when it passes, but:

- It produces **no** Tests tab row (success is silent).
- On failure it aborts the script and becomes a script runtime error
  (for example \`expected false to be truthy\`) instead of a failed test row.

Prefer wrapping every assertion in \`hc.test("name", () => { ... })\`.

## Error routing

| Location | On success | On assertion failure |
|----------|------------|----------------------|
| Inside \`hc.test\` | \`tests[].passed: true\` | \`tests[].passed: false\` with \`error\`; script continues |
| Outside \`hc.test\` | Silent (empty \`tests\`) | Script aborts; \`result.error\` / console script error |

When the user reports an error or asks why a snippet "isn't a function" / fails,
read the actual diagnostics (\`get_script_run_diagnostics\` /
\`get_active_response_summary\`) before theorizing.

## Common expect forms

\`\`\`js
hc.test("status is 200", () => {
  hc.expect(hc.response.code).to.equal(200);
});

hc.test("body shape", () => {
  hc.expect(hc.response.json()).to.eql({ ok: true });
});

hc.test("truthy", () => {
  hc.expect(hc.response.code).to.be.ok;
});
\`\`\`

Custom failure messages: \`hc.expect(actual, "message").to.equal(expected)\`.

## hc.response assertions

Prefer response matchers on \`hc.response\` when checking HTTP status/body:

\`\`\`js
hc.test("2xx", () => {
  hc.response.to.be.ok; // or .to.be.success
});

hc.test("status", () => {
  hc.response.to.have.status(200);
});
\`\`\`

Response matchers require \`hc.response\` as the subject. Using them on
\`hc.expect(...)\` subjects yields:

\`response assertions require hc.response; use hc.response.to.have.status(...)\`

## Postman → HarborClient mapping

| Postman | HarborClient |
|---------|--------------|
| \`pm.test\` | \`hc.test\` |
| \`pm.expect\` | \`hc.expect\` |
| \`pm.response.code\` | \`hc.response.code\` |
| \`pm.response.json()\` | \`hc.response.json()\` |
| \`pm.response.to.have.status(200)\` | \`hc.response.to.have.status(200)\` |
| \`pm.environment.set\` | \`hc.environment.set\` / \`hc.variables.set\` |
| \`pm.variables.get\` | \`hc.variables.get\` |

Never emit Postman \`pm.*\` syntax in HarborClient scripts.

## hc.ask(prompt, options?)

One-shot AI completion from a pre/post script. Returns a Promise that resolves to
the model text, or \`null\` when AI is not configured or the model selection
cannot be resolved.

HarborClient injects the current send's request (and response in post-request
scripts) into the completion context automatically — including \`sizeBytes\` for
binary/image bodies. Do not paste \`hc.response\` into the prompt unless you need
extra text beyond that snapshot.

\`\`\`js
const sizeAnswer = await hc.ask("What is the file size of the image?", {
  model: "gpt-4o: personal"
});
if (sizeAnswer == null) {
  console.log("AI not configured");
}
\`\`\`

- \`prompt\` — text sent to the model
- \`options.model\` — optional \`"name"\` or \`"name: source"\` (source is \`Personal\`,
  \`GitHub Models\`, or a Team Hub display name). Omit for the first available model;
  omit source to take the first matching model from any source.

Do not invent tool-calling loops or Postman AI APIs; use \`await hc.ask(...)\`.

## hc.livePage(url?, options?)

Opens or reuses an embedded HarborClient browser tab and returns a handle.
Requires Settings → General → Allow script live page access. Page load waits count
against \`scriptTimeoutMs\` — raise the script timeout for slow pages.

\`\`\`js
const page = await hc.livePage("https://example.com");
console.log(page.title);
await page.focus();
await page.navigate("https://example.com/docs");
await page.reload();
await page.goBack();
await page.goForward();
const { elements } = await page.dom.query("h1");
const title = await page.dom.evaluate("document.title");
const { path } = await page.screenshot("screenshot.png", {});
const { path: full } = await page.screenshot("full.png", { fullPage: true });
await page.close();
\`\`\`

- Omit \`url\` to bind the currently active browser tab
- \`options.reuse\` — default \`true\`; set \`false\` to always open a new tab
- \`page.navigate(url)\` / \`page.goBack()\` / \`page.goForward()\` / \`page.reload()\` —
  wait for load and refresh \`url\` / \`title\` / \`canGoBack\` / \`canGoForward\`
- \`page.dom.query(selector, { all?, maxElements? })\` — CSS selector reads
- \`page.dom.evaluate(expression)\` — run JS in the page and return the result
- \`page.dom.injectScript(source)\` / \`page.dom.injectStylesheet(css)\`
- \`page.screenshot(path, options?)\` — PNG written under the script file access
  root; returns \`{ path }\` (absolute). Pass \`{ fullPage: true }\` to
  scroll-and-stitch the full document (default captures the visible viewport)
- \`page.focus()\` / \`page.close()\` — \`close\` returns \`false\` if the user cancels a leave prompt

Unavailable in headless/CLI script contexts (throws).

## hc.sleep(milliseconds)

Pauses the script for the given number of milliseconds, then continues. Returns a
Promise — always \`await\` it. Useful for pacing retries or waiting before a
follow-up \`hc.sendRequest\`.

\`\`\`js
await hc.sleep(2000);
\`\`\`

- \`milliseconds\` — non-negative finite number of milliseconds to wait
- Throws when the argument is negative, \`NaN\`, or otherwise not a finite number

Do not invent \`setTimeout\` / \`setInterval\` in the sandbox; use \`await hc.sleep(...)\`.

## hc.send(text, statusCode?, contentType?) / hc.sendJSON(value, statusCode?)

Treats the given value as the HTTP response for the current send (replaces what
the remote server returned). Available in both pre-request and post-request
scripts. Last call in the phase wins.

- \`hc.send(text, statusCode = 200, contentType = 'text/plain; charset=utf-8')\`
- \`hc.sendJSON(value, statusCode = 200)\` — body is \`JSON.stringify(value)\`,
  Content-Type is \`application/json\`
- Status must be an integer between 100 and 599 (throws otherwise)
- Does **not** skip the HTTP call by itself. In a pre-request script, also call
  \`hc.execution.skipRequest()\` when the remote request should not run.
- \`hc.execution.skipRequest()\` still skips post-request scripts (unchanged)

\`\`\`js
await hc.sendJSON({
  error: 'Something happened.'
}, 400);
hc.execution.skipRequest();
\`\`\`

When used in a post-request script without skipping, the real response is
discarded after post scripts finish and the override is shown instead. Request
history and plugin \`afterSend\` still see the real response when a send occurred.

## AI script edits (update_request_script)

The \`replace_range\` mode performs a literal splice:

\`source.slice(0, startOffset) + code + source.slice(endOffset)\`

Use it only when \`code\` is a drop-in, syntactically substitutable replacement
for exactly the selected characters. Mentally concatenate the unchanged prefix,
replacement, and unchanged suffix and confirm the result is valid JavaScript.
If the fix adds or removes a wrapper, changes a chained expression outside the
selection, or changes surrounding structure, use \`mode: "replace"\` with the
**entire** updated script.

### Safe statement-level range replacement

Given this full script:

\`\`\`js
// Test
hc.test("Status code is 2xx", () => {
  hc.expect(hc.response.code >= 200 && hc.response.code < 300).to.be.ok();
});
hc.expect(true).to.be.ok();
\`\`\`

The selection covering the complete trailing statement
\`hc.expect(true).to.be.ok();\` can be replaced with:

\`\`\`js
hc.test("True is ok", () => {
  hc.expect(true).to.be.ok();
});
\`\`\`

Call \`update_request_script\` with
\`mode: "replace_range"\`, \`startOffset\`/\`endOffset\` from the \`@\`
\`#start.end\` selection, and \`code\` set to that replacement. The status-code
test and \`// Test\` comment remain unchanged.

### Unsafe partial-expression replacement

Given:

\`\`\`js
// Test
hc.test("Status code is 2xx", () => {
  hc.expect(hc.response.code).to.be(200);
});
\`\`\`

If the selected range covers only \`hc.expect(hc.response.code)\`, do **not**
replace that range with a new \`hc.test(...)\` block. The unchanged suffix
\`.to.be(200);\` would remain, producing invalid code like
\`});.to.be(200);\`. The selection is already inside an \`hc.test\` callback;
never nest another \`hc.test\` around it via \`replace_range\`.

Use \`mode: "replace"\` with the entire corrected script:

\`\`\`js
// Test
hc.test("Status code is 2xx", () => {
  hc.expect(hc.response.code).to.equal(200);
});
\`\`\`

When applying any localized fix, preserve unrelated tests, comments, and
statements. Never claim an edit was applied when \`update_request_script\`
returned an error; correct the tool input and retry.
`;

/**
 * Returns the authoritative HarborClient scripting API reference text.
 *
 * @returns Markdown reference for the `hc` sandbox API.
 */
export function getScriptingApiReferenceText(): string {
  return SCRIPTING_API_REFERENCE;
}
