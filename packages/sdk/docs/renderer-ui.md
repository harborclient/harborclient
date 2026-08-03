# UI contributions

All `hc.ui.register*` methods:

- Require the `ui` permission.
- Return a `Disposable` that unregisters the contribution when called.
- Require an `id` that matches an entry in the corresponding `manifest.contributes.*` array.

Registration disposables are tracked automatically when you call `hc.ui.register*` methods. Custom disposables (timers, focus sync, etc.) should be disposed in `deactivate()` or React effect cleanup.

See [Manifest](/manifest#contribution-types) for the manifest keys that correspond to each registrar.

<HcMethod name="ui.registerSettingsSection" :level="2" />

<HcMethod name="ui.registerSidebarPanel" :level="2" />

<HcMethod name="ui.registerSidebarRailItem" :level="2" />

<HcMethod name="ui.registerSidebarSection" :level="2" />

<HcMethod name="ui.registerMainView" :level="2" />

<HcMethod name="ui.registerModal" :level="2" />

<HcMethod name="ui.openModal" :level="2" />

<HcMethod name="ui.closeModal" :level="2" />

<HcMethod name="ui.registerRequestTab" :level="2" />

<HcMethod name="ui.registerResponseTab" :level="2" />

<HcMethod name="ui.registerCollectionSettingsTab" :level="2" />

<HcMethod name="ui.registerFooterPanel" :level="2" />

<HcMethod name="ui.setFooterPanelIndicator" :level="2" />

<HcMethod name="ui.registerMenuItem" :level="2" />

<HcMethod name="actions.register" :level="2" />

<HcMethod name="ui.registerRequestToolbarAction" :level="2" />

<HcMethod name="ui.registerLivePageChromeAction" :level="2" />

<HcMethod name="ui.registerScriptEditorAction" :level="2" />

<HcMethod name="ui.registerWorkflowToolbarAction" :level="2" />

<HcMethod name="ui.registerWorkflowActionBlock" :level="2" />

<HcMethod name="ui.registerContextMenuItem" :level="2" />

<HcMethod name="ui.registerStatusBarItem" :level="2" />

<HcMethod name="ui.showToast" :level="2" />
