import type {
  RegisteredCollectionSettingsTab,
  RegisteredContextMenuItem,
  RegisteredFooterPanel,
  RegisteredMainView,
  RegisteredModal,
  RegisteredMenuItem,
  RegisteredPluginTheme,
  RegisteredRequestTab,
  RegisteredRequestToolbarAction,
  RegisteredResponseTab,
  RegisteredSettingsSection,
  RegisteredSidebarPanel,
  RegisteredSidebarSection,
  RegisteredStatusBarItem,
  ThemeContribution,
  Disposable
} from '#/shared/plugin/types';

type Listener = () => void;

interface MutableRegistryState {
  settingsSections: RegisteredSettingsSection[];
  themes: RegisteredPluginTheme[];
  sidebarSections: RegisteredSidebarSection[];
  sidebarPanels: RegisteredSidebarPanel[];
  mainViews: RegisteredMainView[];
  modals: RegisteredModal[];
  requestTabs: RegisteredRequestTab[];
  responseTabs: RegisteredResponseTab[];
  collectionSettingsTabs: RegisteredCollectionSettingsTab[];
  footerPanels: RegisteredFooterPanel[];
  statusBarItems: RegisteredStatusBarItem[];
  menuItems: RegisteredMenuItem[];
  requestToolbarActions: RegisteredRequestToolbarAction[];
  contextMenuItems: RegisteredContextMenuItem[];
}

interface CachedRegistrySnapshot {
  settingsSections: RegisteredSettingsSection[];
  themes: RegisteredPluginTheme[];
  sidebarSections: RegisteredSidebarSection[];
  sidebarPanels: RegisteredSidebarPanel[];
  mainViews: RegisteredMainView[];
  modals: RegisteredModal[];
  requestTabs: RegisteredRequestTab[];
  responseTabs: RegisteredResponseTab[];
  collectionSettingsTabs: RegisteredCollectionSettingsTab[];
  footerPanels: RegisteredFooterPanel[];
  statusBarItems: RegisteredStatusBarItem[];
  menuItems: RegisteredMenuItem[];
  requestToolbarActions: RegisteredRequestToolbarAction[];
  contextMenuItems: RegisteredContextMenuItem[];
}

const state: MutableRegistryState = {
  settingsSections: [],
  themes: [],
  sidebarSections: [],
  sidebarPanels: [],
  mainViews: [],
  modals: [],
  requestTabs: [],
  responseTabs: [],
  collectionSettingsTabs: [],
  footerPanels: [],
  statusBarItems: [],
  menuItems: [],
  requestToolbarActions: [],
  contextMenuItems: []
};

const listeners = new Set<Listener>();

let cachedSnapshot: CachedRegistrySnapshot = emptySnapshot();

/**
 * Returns an empty cached snapshot object.
 */
function emptySnapshot(): CachedRegistrySnapshot {
  return {
    settingsSections: [],
    themes: [],
    sidebarSections: [],
    sidebarPanels: [],
    mainViews: [],
    modals: [],
    requestTabs: [],
    responseTabs: [],
    collectionSettingsTabs: [],
    footerPanels: [],
    statusBarItems: [],
    menuItems: [],
    requestToolbarActions: [],
    contextMenuItems: []
  };
}

/**
 * Sorts contributions by order then title for stable UI ordering.
 *
 * @param entries - Contributions with optional order and title.
 */
function sortByOrderThenTitle<T extends { order?: number; title: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    const leftOrder = left.order ?? 100;
    const rightOrder = right.order ?? 100;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.title.localeCompare(right.title);
  });
}

/**
 * Sorts menu items by menu, group, order, and label.
 *
 * @param entries - Menu item contributions.
 */
function sortMenuItems(entries: RegisteredMenuItem[]): RegisteredMenuItem[] {
  return [...entries].sort((left, right) => {
    const menuCompare = left.menu.localeCompare(right.menu);
    if (menuCompare !== 0) {
      return menuCompare;
    }
    const leftGroup = left.group ?? '';
    const rightGroup = right.group ?? '';
    const groupCompare = leftGroup.localeCompare(rightGroup);
    if (groupCompare !== 0) {
      return groupCompare;
    }
    const leftOrder = left.order ?? 100;
    const rightOrder = right.order ?? 100;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return (left.label ?? left.command).localeCompare(right.label ?? right.command);
  });
}

/**
 * Sorts status bar items by alignment, order, and id.
 *
 * @param entries - Status bar item contributions.
 */
function sortStatusBarItems(entries: RegisteredStatusBarItem[]): RegisteredStatusBarItem[] {
  return [...entries].sort((left, right) => {
    const leftAlignment = left.alignment ?? 'right';
    const rightAlignment = right.alignment ?? 'right';
    if (leftAlignment !== rightAlignment) {
      return leftAlignment.localeCompare(rightAlignment);
    }
    const leftOrder = left.order ?? 100;
    const rightOrder = right.order ?? 100;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.id.localeCompare(right.id);
  });
}

/**
 * Rebuilds cached snapshots after registry mutations so getSnapshot returns
 * stable references until the next emitChange.
 */
function rebuildCachedSnapshots(): void {
  cachedSnapshot = {
    settingsSections: [...state.settingsSections].sort((left, right) =>
      left.title.localeCompare(right.title)
    ),
    themes: [...state.themes].sort((left, right) => left.title.localeCompare(right.title)),
    sidebarSections: sortByOrderThenTitle(state.sidebarSections),
    sidebarPanels: sortByOrderThenTitle(state.sidebarPanels),
    mainViews: [...state.mainViews].sort((left, right) => left.title.localeCompare(right.title)),
    modals: [...state.modals].sort((left, right) => left.title.localeCompare(right.title)),
    requestTabs: sortByOrderThenTitle(state.requestTabs),
    responseTabs: sortByOrderThenTitle(state.responseTabs),
    collectionSettingsTabs: sortByOrderThenTitle(state.collectionSettingsTabs),
    footerPanels: [...state.footerPanels].sort((left, right) =>
      left.title.localeCompare(right.title)
    ),
    statusBarItems: sortStatusBarItems(state.statusBarItems),
    menuItems: sortMenuItems(state.menuItems),
    requestToolbarActions: sortByOrderThenTitle(
      state.requestToolbarActions.map((entry) => ({ ...entry, title: entry.title }))
    ),
    contextMenuItems: sortByOrderThenTitle(
      state.contextMenuItems.map((entry) => ({ ...entry, title: entry.title }))
    )
  };
}

/**
 * Notifies subscribers that registry contents changed.
 */
function emitChange(): void {
  rebuildCachedSnapshots();
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Registers one contribution in a typed registry bucket.
 *
 * @param bucket - Mutable contribution array.
 * @param pluginId - Plugin manifest id.
 * @param entryId - Namespaced contribution id.
 * @param entry - Contribution payload.
 * @param matches - Predicate identifying an existing entry for replacement.
 */
function registerContribution<T extends { pluginId: string }>(
  bucket: T[],
  pluginId: string,
  entryId: string,
  entry: T,
  matches: (item: T) => boolean
): Disposable {
  const next = bucket.filter((item) => !matches(item));
  next.push(entry);
  bucket.length = 0;
  bucket.push(...next);
  emitChange();
  return {
    dispose: () => {
      const index = bucket.indexOf(entry);
      if (index >= 0) {
        bucket.splice(index, 1);
        emitChange();
      }
    }
  };
}

/**
 * Subscribes to registry changes for useSyncExternalStore.
 *
 * @param listener - Called when contributions change.
 */
export function subscribePluginRegistry(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns the current registry snapshot with stable array references.
 */
export function getPluginRegistrySnapshot(): CachedRegistrySnapshot {
  return cachedSnapshot;
}

/**
 * Registers a plugin settings section contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param section - Settings section contribution metadata.
 */
export function registerSettingsSectionContribution(
  pluginId: string,
  section: Omit<RegisteredSettingsSection, 'pluginId'>
): Disposable {
  const entry: RegisteredSettingsSection = { pluginId, ...section };
  return registerContribution(
    state.settingsSections,
    pluginId,
    section.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === section.id
  );
}

/**
 * Registers a plugin theme contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param theme - Theme contribution metadata.
 */
export function registerThemeContribution(pluginId: string, theme: ThemeContribution): Disposable {
  const entry: RegisteredPluginTheme = {
    pluginId,
    id: theme.id,
    title: theme.title,
    type: theme.type,
    colors: theme.colors,
    stylesheet: theme.stylesheet
  };
  return registerContribution(
    state.themes,
    pluginId,
    theme.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === theme.id
  );
}

/**
 * Registers a collapsible sidebar section contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param section - Sidebar section contribution metadata.
 */
export function registerSidebarSectionContribution(
  pluginId: string,
  section: Omit<RegisteredSidebarSection, 'pluginId'>
): Disposable {
  const entry: RegisteredSidebarSection = { pluginId, ...section };
  return registerContribution(
    state.sidebarSections,
    pluginId,
    section.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === section.id
  );
}

/**
 * Registers a switchable sidebar panel contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param panel - Sidebar panel contribution metadata.
 */
export function registerSidebarPanelContribution(
  pluginId: string,
  panel: Omit<RegisteredSidebarPanel, 'pluginId'>
): Disposable {
  const entry: RegisteredSidebarPanel = { pluginId, ...panel };
  return registerContribution(
    state.sidebarPanels,
    pluginId,
    panel.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === panel.id
  );
}

/**
 * Registers a main-area overlay contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param view - Main view contribution metadata.
 */
export function registerMainViewContribution(
  pluginId: string,
  view: Omit<RegisteredMainView, 'pluginId'>
): Disposable {
  const entry: RegisteredMainView = { pluginId, ...view };
  return registerContribution(
    state.mainViews,
    pluginId,
    view.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === view.id
  );
}

/**
 * Registers a modal overlay contribution rendered at the application root.
 *
 * @param pluginId - Plugin manifest id.
 * @param modal - Modal contribution metadata.
 */
export function registerModalContribution(
  pluginId: string,
  modal: Omit<RegisteredModal, 'pluginId'>
): Disposable {
  const entry: RegisteredModal = { pluginId, ...modal };
  return registerContribution(
    state.modals,
    pluginId,
    modal.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === modal.id
  );
}

/**
 * Registers a request editor tab contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param tab - Request tab contribution metadata.
 */
export function registerRequestTabContribution(
  pluginId: string,
  tab: Omit<RegisteredRequestTab, 'pluginId'>
): Disposable {
  const entry: RegisteredRequestTab = { pluginId, ...tab };
  return registerContribution(
    state.requestTabs,
    pluginId,
    tab.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === tab.id
  );
}

/**
 * Registers a response viewer tab contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param tab - Response tab contribution metadata.
 */
export function registerResponseTabContribution(
  pluginId: string,
  tab: Omit<RegisteredResponseTab, 'pluginId'>
): Disposable {
  const entry: RegisteredResponseTab = { pluginId, ...tab };
  return registerContribution(
    state.responseTabs,
    pluginId,
    tab.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === tab.id
  );
}

/**
 * Registers a collection settings tab contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param tab - Collection settings tab contribution metadata.
 */
export function registerCollectionSettingsTabContribution(
  pluginId: string,
  tab: Omit<RegisteredCollectionSettingsTab, 'pluginId'>
): Disposable {
  const entry: RegisteredCollectionSettingsTab = { pluginId, ...tab };
  return registerContribution(
    state.collectionSettingsTabs,
    pluginId,
    tab.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === tab.id
  );
}

/**
 * Registers a footer slide-up panel contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param panel - Footer panel contribution metadata.
 */
export function registerFooterPanelContribution(
  pluginId: string,
  panel: Omit<RegisteredFooterPanel, 'pluginId'>
): Disposable {
  const entry: RegisteredFooterPanel = { pluginId, ...panel };
  return registerContribution(
    state.footerPanels,
    pluginId,
    panel.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === panel.id
  );
}

/**
 * Registers a status bar item contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param item - Status bar item contribution metadata.
 */
export function registerStatusBarItemContribution(
  pluginId: string,
  item: Omit<RegisteredStatusBarItem, 'pluginId'>
): Disposable {
  const entry: RegisteredStatusBarItem = { pluginId, ...item };
  return registerContribution(
    state.statusBarItems,
    pluginId,
    item.id,
    entry,
    (existing) => existing.pluginId === pluginId && existing.id === item.id
  );
}

/**
 * Registers an application menu item contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param item - Menu item contribution metadata.
 */
export function registerMenuItemContribution(
  pluginId: string,
  item: Omit<RegisteredMenuItem, 'pluginId'>
): Disposable {
  const entry: RegisteredMenuItem = { pluginId, ...item };
  return registerContribution(
    state.menuItems,
    pluginId,
    `${item.menu}:${item.command}`,
    entry,
    (existing) =>
      existing.pluginId === pluginId &&
      existing.menu === item.menu &&
      existing.command === item.command
  );
}

/**
 * Registers a request toolbar action contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param action - Toolbar action contribution metadata.
 */
export function registerRequestToolbarActionContribution(
  pluginId: string,
  action: Omit<RegisteredRequestToolbarAction, 'pluginId'>
): Disposable {
  const entry: RegisteredRequestToolbarAction = { pluginId, ...action };
  return registerContribution(
    state.requestToolbarActions,
    pluginId,
    action.id,
    entry,
    (item) => item.pluginId === pluginId && item.id === action.id
  );
}

/**
 * Registers a sidebar context menu item contribution.
 *
 * @param pluginId - Plugin manifest id.
 * @param item - Context menu item contribution metadata.
 */
export function registerContextMenuItemContribution(
  pluginId: string,
  item: Omit<RegisteredContextMenuItem, 'pluginId'>
): Disposable {
  const entry: RegisteredContextMenuItem = { pluginId, ...item };
  return registerContribution(
    state.contextMenuItems,
    pluginId,
    item.id,
    entry,
    (existing) => existing.pluginId === pluginId && existing.id === item.id
  );
}

/**
 * Removes one contribution from the registry by kind and manifest id.
 *
 * @param pluginId - Plugin manifest id.
 * @param kind - Contribution bucket key.
 * @param contributionId - Manifest contribution id or menu key.
 */
export function unregisterContribution(
  pluginId: string,
  kind:
    | 'settingsSections'
    | 'themes'
    | 'sidebarPanels'
    | 'sidebarSections'
    | 'mainViews'
    | 'modals'
    | 'requestTabs'
    | 'responseTabs'
    | 'collectionSettingsTabs'
    | 'footerPanels'
    | 'statusBarItems'
    | 'menuItems'
    | 'requestToolbarActions'
    | 'contextMenuItems',
  contributionId: string
): void {
  const filter = <T extends { pluginId: string }>(
    bucket: T[],
    matches: (item: T) => boolean
  ): void => {
    const next = bucket.filter((item) => !matches(item));
    bucket.length = 0;
    bucket.push(...next);
  };

  switch (kind) {
    case 'settingsSections':
      filter(
        state.settingsSections,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'themes':
      filter(state.themes, (item) => item.pluginId === pluginId && item.id === contributionId);
      break;
    case 'sidebarPanels':
      filter(
        state.sidebarPanels,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'sidebarSections':
      filter(
        state.sidebarSections,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'mainViews':
      filter(
        state.mainViews,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'modals':
      filter(
        state.modals,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'requestTabs':
      filter(
        state.requestTabs,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'responseTabs':
      filter(
        state.responseTabs,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'collectionSettingsTabs':
      filter(
        state.collectionSettingsTabs,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'footerPanels':
      filter(
        state.footerPanels,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'statusBarItems':
      filter(
        state.statusBarItems,
        (item) => item.pluginId === pluginId && item.contributionId === contributionId
      );
      break;
    case 'menuItems': {
      const [menu, command] = contributionId.split(':');
      filter(
        state.menuItems,
        (item) => item.pluginId === pluginId && item.menu === menu && item.command === command
      );
      break;
    }
    case 'requestToolbarActions':
      filter(
        state.requestToolbarActions,
        (item) => item.pluginId === pluginId && item.id === contributionId
      );
      break;
    case 'contextMenuItems':
      filter(
        state.contextMenuItems,
        (item) => item.pluginId === pluginId && item.id === contributionId
      );
      break;
    default:
      break;
  }
  emitChange();
}

/**
 * Removes every contribution owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPluginContributions(pluginId: string): void {
  state.settingsSections = state.settingsSections.filter((item) => item.pluginId !== pluginId);
  state.themes = state.themes.filter((item) => item.pluginId !== pluginId);
  state.sidebarSections = state.sidebarSections.filter((item) => item.pluginId !== pluginId);
  state.sidebarPanels = state.sidebarPanels.filter((item) => item.pluginId !== pluginId);
  state.mainViews = state.mainViews.filter((item) => item.pluginId !== pluginId);
  state.modals = state.modals.filter((item) => item.pluginId !== pluginId);
  state.requestTabs = state.requestTabs.filter((item) => item.pluginId !== pluginId);
  state.responseTabs = state.responseTabs.filter((item) => item.pluginId !== pluginId);
  state.collectionSettingsTabs = state.collectionSettingsTabs.filter(
    (item) => item.pluginId !== pluginId
  );
  state.footerPanels = state.footerPanels.filter((item) => item.pluginId !== pluginId);
  state.statusBarItems = state.statusBarItems.filter((item) => item.pluginId !== pluginId);
  state.menuItems = state.menuItems.filter((item) => item.pluginId !== pluginId);
  state.requestToolbarActions = state.requestToolbarActions.filter(
    (item) => item.pluginId !== pluginId
  );
  state.contextMenuItems = state.contextMenuItems.filter((item) => item.pluginId !== pluginId);
  emitChange();
}

export const getRegisteredSettingsSections = (): RegisteredSettingsSection[] =>
  cachedSnapshot.settingsSections;
export const getRegisteredPluginThemes = (): RegisteredPluginTheme[] => cachedSnapshot.themes;
export const getRegisteredSidebarSections = (): RegisteredSidebarSection[] =>
  cachedSnapshot.sidebarSections;
export const getRegisteredSidebarPanels = (): RegisteredSidebarPanel[] =>
  cachedSnapshot.sidebarPanels;
export const getRegisteredMainViews = (): RegisteredMainView[] => cachedSnapshot.mainViews;
export const getRegisteredModals = (): RegisteredModal[] => cachedSnapshot.modals;
export const getRegisteredRequestTabs = (): RegisteredRequestTab[] => cachedSnapshot.requestTabs;
export const getRegisteredResponseTabs = (): RegisteredResponseTab[] => cachedSnapshot.responseTabs;
export const getRegisteredCollectionSettingsTabs = (): RegisteredCollectionSettingsTab[] =>
  cachedSnapshot.collectionSettingsTabs;
export const getRegisteredFooterPanels = (): RegisteredFooterPanel[] => cachedSnapshot.footerPanels;
export const getRegisteredStatusBarItems = (): RegisteredStatusBarItem[] =>
  cachedSnapshot.statusBarItems;
export const getRegisteredMenuItems = (): RegisteredMenuItem[] => cachedSnapshot.menuItems;
export const getRegisteredRequestToolbarActions = (): RegisteredRequestToolbarAction[] =>
  cachedSnapshot.requestToolbarActions;
export const getRegisteredContextMenuItems = (): RegisteredContextMenuItem[] =>
  cachedSnapshot.contextMenuItems;
