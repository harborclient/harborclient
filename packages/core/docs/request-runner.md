# Request runner

[`RequestRunner`](https://github.com/harborclient/harborclient/blob/main/packages/core/src/requestRunner/RequestRunner.ts) runs a full request pipeline without depending on Redux, Electron, or browser globals:

1. Resolve variables and cookies for the target URL
2. Run pre-request scripts (when a script runner is provided)
3. Build and send the HTTP request via the host transport
4. Run post-request scripts with the response
5. Return HTTP result plus script logs, test results, and flow-control state

Hosts inject dependencies (`RequestRunnerDeps`): cookie jar, optional script runner, and the HTTP send function. Script source resolution and persistence of collection/folder/environment mutations remain host responsibilities; the runner returns mutation events for the host to apply.
