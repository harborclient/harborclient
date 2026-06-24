# Testing

HarborClient lets you write automated checks on HTTP responses using JavaScript in post-request scripts. Each check is a named test that passes when its assertions succeed and fails when an assertion throws. Results appear in the response viewer **Tests** tab after you send a request.

Tests use the same sandbox and `hc` object as other request scripts. See [Request scripts](/request-scripts) for the full API reference.

## Where tests run

Tests belong in **post-request** scripts — either at the collection level or on an individual saved request.

- **Collection post-request script** — in collection settings. Runs after every request in the collection.
- **Request post-request script** — in the request editor, under the **Post** tab. Runs only for that saved request.

When you send a request, scripts run in this order:

1. Collection pre-request script
2. Request pre-request script
3. HTTP request is sent
4. Collection post-request script
5. Request post-request script

Tests in the collection post-request script run before tests in the request post-request script. Both see the same response from the send that just completed.

`hc.response` is available only during post-request scripts. Pre-request scripts cannot read the response or register tests against it.

## Writing a test

Use `hc.test(name, fn)` to register a named test. HarborClient runs `fn` immediately. If `fn` completes without throwing, the test passes. If `fn` throws — including when an `hc.expect` assertion fails — the test fails and the error message is recorded.

```javascript
hc.test('status is 200', function () {
  hc.expect(hc.response.code).to.equal(200);
});
```

Give each test a short, descriptive name. The name is shown in the **Tests** tab so you can tell at a glance which check failed.

## Assertions

Inside a test, use `hc.expect(actual)` to assert on a value. HarborClient supports four matchers:

### hc.expect(actual).to.equal(expected)

Strict equality (`===`). Use for numbers, strings, booleans, and other primitives.

```javascript
hc.expect(hc.response.code).to.equal(200);
hc.expect(hc.response.status).to.equal('OK');
```

### hc.expect(actual).to.eql(expected)

Deep equality via `JSON.stringify` comparison. Use for objects and arrays when you want to compare structure and values.

```javascript
hc.expect(hc.response.json()).to.eql({ ok: true, count: 3 });
```

### hc.expect(actual).to.include(substr)

Asserts that `actual` is a string containing `substr`. Use for partial body checks without parsing JSON.

```javascript
hc.expect(hc.response.text()).to.include('"status":"success"');
```

### hc.expect(actual).be.ok()

Asserts that `actual` is truthy. Use when you only need to confirm a value exists or is non-empty.

```javascript
hc.expect(hc.response.headers['content-type']).be.ok();
hc.expect(hc.response.json().id).be.ok();
```

See [Request scripts](/request-scripts#hctestname-fn) for full signatures and additional `hc` members you can use alongside tests.

## Reading results

After a send completes, open the response viewer and select the **Tests** tab.

Each registered test appears as a row:

- **Green dot** — the test passed (`fn` completed without throwing).
- **Red dot** — the test failed. The test name and the assertion error message are shown on the same row.

If no tests were registered, the tab is empty. Script errors outside of `hc.test` (syntax errors, timeouts, or uncaught exceptions in the script body) appear in the send **Console**, not in the **Tests** tab.

Use `console.log` inside a test when you need to inspect values during development. Log lines are captured in the send console.

## Common patterns

### Check the status code

```javascript
hc.test('returns 200', function () {
  hc.expect(hc.response.code).to.equal(200);
});
```

### Check status text

```javascript
hc.test('status text is OK', function () {
  hc.expect(hc.response.status).to.equal('OK');
});
```

### Validate JSON body shape

```javascript
hc.test('body matches expected shape', function () {
  hc.expect(hc.response.json()).to.eql({
    id: 42,
    name: 'Ada',
    active: true
  });
});
```

### Check a response header

```javascript
hc.test('returns JSON content type', function () {
  hc.expect(hc.response.headers['content-type']).to.include('application/json');
});
```

### Assert response time

```javascript
hc.test('responds within one second', function () {
  hc.expect(hc.response.responseTime < 1000).be.ok();
});
```

### Save a value for the next request

Use tests together with variable setters when a response value should drive a later request in the same collection.

Ephemeral for the current send only:

```javascript
hc.test('response includes a token', function () {
  var data = hc.response.json();
  hc.expect(data.token).be.ok();
  hc.variables.set('token', data.token);
});
```

Persist to the collection for future sends:

```javascript
hc.test('store refreshed token', function () {
  var data = hc.response.json();
  hc.expect(data.token).be.ok();
  hc.collection.variables.set('token', data.token);
});
```

See [Environments](/environments) for how collection and environment variables are merged at send time.

## Tips and limits

- **One concept per test** — keep each `hc.test` focused so failures point to a single expectation.
- **Modern JavaScript** — use `const`, arrow functions, template literals, and other modern syntax. Scripts are transpiled before execution in the sandbox.
- **Five-second timeout** — each script (including all tests inside it) must finish within five seconds.
- **No I/O** — tests cannot open network connections, read files, or call Node or browser APIs. Only `hc`, `console`, and standard JavaScript globals are available.
- **Independent tests** — a failing assertion in one `hc.test` does not stop other tests in the same script from running. Each test is recorded separately.
- **Post-request only** — you cannot assert on a response in a pre-request script because the response does not exist yet.

## What's next

- [Request scripts](/request-scripts) — full `hc` API reference, execution order, and sandbox limits
- [Environments](/environments) — create and switch between variable groups used during sends and tests
- [Making requests](/requests) — send requests, read responses, and use the Console
