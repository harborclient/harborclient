import { z } from 'zod';

/**
 * Non-negative integer database / entity id used by plugin host bridge payloads.
 */
const dbId = z.number().int().nonnegative();

/**
 * Non-empty string id used for registrations, commands, and contribution keys.
 */
const nonEmptyString = z.string().min(1);

/**
 * Envelope for `plugins:uiBridge` invoke messages from plugin preloads.
 */
export const pluginUiBridgeInvokeEnvelopeSchema = z.object({
  op: nonEmptyString,
  payload: z.unknown().optional()
});

/**
 * Contribution bucket keys accepted by register/unregister contribution ops.
 */
export const contributionKindSchema = z.enum([
  'settingsSections',
  'themes',
  'sidebarPanels',
  'sidebarRailItems',
  'sidebarSections',
  'mainViews',
  'modals',
  'requestTabs',
  'responseTabs',
  'collectionSettingsTabs',
  'footerPanels',
  'statusBarItems',
  'menuItems',
  'requestToolbarActions',
  'livePageChromeActions',
  'scriptEditorActions',
  'workflowToolbarActions',
  'workflowActionBlocks',
  'contextMenuItems',
  'actions'
]);

export type ContributionKind = z.infer<typeof contributionKindSchema>;

const titledContribution = z.object({
  id: nonEmptyString,
  title: nonEmptyString,
  contributionId: nonEmptyString
});

const orderedTitledContribution = titledContribution.extend({
  order: z.number().optional()
});

/**
 * Per-kind contribution object schemas for runtime registration from agent webviews.
 */
export const contributionByKindSchema = {
  settingsSections: titledContribution,
  themes: z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    type: z.enum(['light', 'dark', 'high-contrast']),
    colors: z.record(z.string(), z.string()).optional(),
    metrics: z.record(z.string(), z.string()).optional(),
    stylesheet: z.string().optional()
  }),
  sidebarPanels: orderedTitledContribution.extend({
    icon: z.string().optional(),
    replaces: z.literal('collections').optional()
  }),
  sidebarRailItems: orderedTitledContribution.extend({
    icon: nonEmptyString
  }),
  sidebarSections: orderedTitledContribution.extend({
    hasHeaderActions: z.boolean().optional()
  }),
  mainViews: titledContribution.extend({
    icon: z.string().optional()
  }),
  modals: titledContribution,
  requestTabs: orderedTitledContribution,
  responseTabs: orderedTitledContribution.extend({
    when: z.enum(['always', 'hasResponse', 'noResponse']).optional()
  }),
  collectionSettingsTabs: orderedTitledContribution,
  footerPanels: titledContribution,
  statusBarItems: z.object({
    id: nonEmptyString,
    contributionId: nonEmptyString,
    alignment: z.enum(['left', 'right']).optional(),
    order: z.number().optional()
  }),
  menuItems: z.object({
    menu: z.enum(['file', 'edit', 'view', 'help']),
    command: nonEmptyString,
    label: z.string().optional(),
    group: z.string().optional(),
    order: z.number().optional()
  }),
  requestToolbarActions: z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    command: nonEmptyString,
    icon: z.string().optional(),
    order: z.number().optional()
  }),
  livePageChromeActions: z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    command: nonEmptyString,
    icon: z.string().optional()
  }),
  scriptEditorActions: z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    command: nonEmptyString,
    icon: z.string().optional(),
    order: z.number().optional(),
    phases: z.array(z.enum(['pre', 'post'])).optional()
  }),
  workflowToolbarActions: z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    command: nonEmptyString,
    icon: z.string().optional(),
    order: z.number().optional()
  }),
  workflowActionBlocks: orderedTitledContribution.extend({
    actionTypes: z.array(z.string().min(1)).optional()
  }),
  contextMenuItems: z.object({
    id: nonEmptyString,
    title: nonEmptyString,
    command: nonEmptyString,
    when: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    group: z.string().optional(),
    order: z.number().optional()
  }),
  actions: z.object({
    namespace: nonEmptyString,
    label: nonEmptyString,
    commandId: nonEmptyString
  })
} as const;

const footerPanelIndicatorStateSchema = z.object({
  status: z.enum(['success', 'danger', 'muted', 'accent', 'warning', 'info']),
  label: z.string().optional()
});

const environmentVariableSchema = z.object({
  key: z.string(),
  value: z.string().optional(),
  defaultValue: z.string().optional(),
  enabled: z.boolean().optional(),
  share: z.boolean().optional()
});

const libraryListOptionsSchema = z
  .object({
    includeArchived: z.boolean().optional()
  })
  .optional();

const optionalEmpty = z.union([z.undefined(), z.null(), z.object({}).passthrough()]).optional();

/**
 * Finite number when present; non-finite values (NaN/Infinity) become undefined so
 * handlers can ignore invalid size reports without rejecting the whole op.
 */
const optionalFiniteNumber = z.preprocess((value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}, z.number().optional());

/**
 * Payload schemas keyed by plugin UI bridge / host bridge operation name.
 */
export const pluginUiBridgePayloadSchemas = {
  'storage.get': z.object({ key: nonEmptyString }),
  'storage.set': z.object({ key: nonEmptyString, value: z.unknown() }),
  'database.query': z.object({
    mode: z.enum(['get', 'all', 'run']),
    sql: nonEmptyString,
    params: z.array(z.unknown()).optional(),
    txnId: z.string().optional()
  }),
  'database.exec': z.object({ sql: nonEmptyString }),
  'database.beginTransaction': optionalEmpty,
  'database.endTransaction': z.object({
    txnId: nonEmptyString,
    action: z.enum(['commit', 'rollback'])
  }),
  'fs.pickFile': z
    .object({
      options: z
        .object({
          title: z.string().optional(),
          filters: z
            .array(
              z.object({
                name: z.string(),
                extensions: z.array(z.string())
              })
            )
            .optional(),
          defaultPath: z.string().optional(),
          multiple: z.boolean().optional()
        })
        .passthrough()
        .optional()
    })
    .optional()
    .default({}),
  'fs.pickDirectory': z
    .object({
      defaultPath: z.string().optional()
    })
    .optional()
    .default({}),
  'fs.saveFile': z.object({
    content: z.string(),
    options: z
      .object({
        title: z.string().optional(),
        defaultPath: z.string().optional(),
        filters: z
          .array(
            z.object({
              name: z.string(),
              extensions: z.array(z.string())
            })
          )
          .optional()
      })
      .passthrough()
      .optional()
  }),
  'fs.readFile': z.object({ path: nonEmptyString }),
  'fs.writeFile': z.object({ path: nonEmptyString, content: z.string() }),
  'fs.writeBytes': z.object({ path: nonEmptyString, base64: z.string() }),
  'fs.watchFile': z.object({ path: nonEmptyString }),
  'ipc.invoke': z.object({
    channel: nonEmptyString,
    args: z.array(z.unknown()).optional()
  }),
  'themes.getActive': optionalEmpty,
  'themes.register': z.object({
    theme: contributionByKindSchema.themes
  }),
  'themes.unregister': z.object({ themeId: nonEmptyString }),
  'registerContribution': z.object({
    kind: contributionKindSchema,
    contribution: z.record(z.string(), z.unknown())
  }),
  'unregisterContribution': z.object({
    kind: contributionKindSchema,
    contributionId: nonEmptyString
  }),
  'view.getContext': optionalEmpty,
  'view.reportSize': z.object({
    height: optionalFiniteNumber,
    width: optionalFiniteNumber,
    slot: z.string().optional()
  }),
  'ui.showToast': z.object({
    message: z.string(),
    options: z.object({ duration: z.number().optional() }).optional()
  }),
  'ui.setFooterPanelIndicator': z.object({
    panelId: nonEmptyString,
    state: footerPanelIndicatorStateSchema.nullable()
  }),
  'ui.openModal': z.object({
    modalId: nonEmptyString,
    context: z.unknown().optional()
  }),
  'ui.closeModal': z
    .object({
      modalId: z.string().optional()
    })
    .optional()
    .default({}),
  'commands.execute': z.object({
    pluginId: z.string().optional(),
    commandId: nonEmptyString,
    args: z.array(z.unknown()).optional()
  }),
  'commands.executeRemote': z.object({
    pluginId: nonEmptyString,
    commandId: nonEmptyString,
    args: z.array(z.unknown()).optional()
  }),
  'imports.registerHandler': z.object({
    registrationId: nonEmptyString,
    extensions: z.array(z.string())
  }),
  'imports.unregisterHandler': z.object({
    registrationId: nonEmptyString
  }),
  'imports.invokeComplete': z.object({
    requestId: z.number().int().positive(),
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional()
  }),
  'ai.parseChatPointerComplete': z.object({
    requestId: z.number().int().positive(),
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional()
  }),
  'ai.beforeTurnComplete': z.object({
    requestId: z.number().int().positive(),
    ok: z.boolean(),
    result: z.unknown().optional(),
    error: z.string().optional()
  }),
  'ai.registerInstructions': z.object({
    registrationId: nonEmptyString,
    text: z.string().optional()
  }),
  'ai.unregisterInstructions': z.object({
    registrationId: nonEmptyString
  }),
  'mcp.registerServer': z.object({
    registrationId: nonEmptyString,
    name: nonEmptyString,
    serverURL: nonEmptyString,
    enabled: z.boolean().optional(),
    headers: z
      .array(
        z.object({
          key: z.string(),
          value: z.string()
        })
      )
      .optional(),
    icon: z.string().optional()
  }),
  'mcp.unregisterServer': z.object({
    registrationId: nonEmptyString
  }),
  'ai.registerChatPointer': z.object({
    registrationId: nonEmptyString,
    pointerId: nonEmptyString,
    agentGuidance: z.string().optional(),
    match: z
      .object({
        source: z.string(),
        flags: z.string().optional()
      })
      .optional()
  }),
  'ai.unregisterChatPointer': z.object({
    registrationId: nonEmptyString
  }),
  'ai.trackChatPointer': z.object({
    registrationId: nonEmptyString,
    pointerId: nonEmptyString,
    matchSource: z.string().optional(),
    agentGuidance: z.string().optional()
  }),
  'ai.untrackChatPointer': z.object({
    registrationId: nonEmptyString
  }),
  'ai.copyToChat': z.object({
    pointerId: nonEmptyString,
    key: z.string().optional(),
    token: z.string().optional(),
    label: nonEmptyString,
    context: z.string(),
    selection: z
      .object({
        start: z.number(),
        end: z.number()
      })
      .optional()
  }),
  'host.openRequestDraft': z.object({ payload: z.unknown() }),
  'host.applyRequestDraft': z.object({ payload: z.unknown() }),
  'host.loadRequest': z.object({ requestId: dbId }),
  'host.loadDocument': z.object({ documentId: dbId }),
  'host.openCollectionSettings': z.object({ collectionId: dbId }),
  'host.openCollectionRunner': z.object({ collectionId: dbId }),
  'host.openShareModal': z.object({ collectionId: dbId }),
  'host.showEntityContextMenu': z.object({
    target: z.union([
      z.object({ type: z.literal('collection'), collectionId: dbId }),
      z.object({ type: z.literal('folder'), collectionId: dbId, folderId: dbId }),
      z.object({ type: z.literal('request'), requestId: dbId })
    ]),
    x: z.number(),
    y: z.number(),
    pluginId: nonEmptyString,
    contributionId: nonEmptyString
  }),
  'host.getSidebarSelection': optionalEmpty,
  'host.setSidebarSelection': z.object({ selection: z.unknown() }),
  'host.send': optionalEmpty,
  'host.createEnvironmentWithVariables': z.object({
    name: nonEmptyString,
    variables: z.array(environmentVariableSchema)
  }),
  'host.updateEnvironmentVariables': z.object({
    environmentId: dbId,
    variables: z.array(environmentVariableSchema)
  }),
  'host.createCollection': z.object({ payload: z.unknown() }),
  'host.updateCollection': z.object({
    id: dbId,
    name: nonEmptyString
  }),
  'host.deleteCollection': z.object({ collectionId: dbId }),
  'host.reorderCollections': z.object({ orderedIds: z.array(dbId) }),
  'host.setCollectionArchived': z.object({
    collectionId: dbId,
    archived: z.boolean()
  }),
  'host.duplicateCollection': z.object({ collectionId: dbId }),
  'host.createFolder': z.object({
    collectionId: dbId,
    name: nonEmptyString,
    parentFolderId: dbId.nullable().optional()
  }),
  'host.renameFolder': z.object({
    folderId: dbId,
    collectionId: dbId,
    name: nonEmptyString
  }),
  'host.deleteFolder': z.object({
    folderId: dbId,
    collectionId: dbId
  }),
  'host.moveFolder': z.object({
    collectionId: dbId,
    folderId: dbId,
    parentFolderId: dbId.nullable(),
    sortOrder: z.number().int().optional()
  }),
  'host.reorderFolders': z.object({
    collectionId: dbId,
    parentFolderId: dbId.nullable(),
    orderedFolderIds: z.array(dbId)
  }),
  'host.createRequest': z.object({
    collectionId: dbId,
    folderId: dbId.nullable().optional(),
    name: z.string().optional(),
    method: z.string().optional(),
    protocol: z.string().optional(),
    url: z.string().optional()
  }),
  'host.deleteRequest': z.object({ requestId: dbId }),
  'host.duplicateRequest': z.object({ requestId: dbId }),
  'host.moveRequest': z.object({
    collectionId: dbId,
    requestId: dbId,
    folderId: dbId.nullable(),
    index: z.number().int().optional()
  }),
  'host.reorderRequests': z.object({
    collectionId: dbId,
    folderId: dbId.nullable(),
    orderedRequestIds: z.array(dbId)
  }),
  'host.createDocument': z.object({
    collectionId: dbId,
    folderId: dbId.nullable().optional(),
    name: nonEmptyString,
    content: z.string().optional()
  }),
  'host.renameDocument': z.object({
    id: dbId,
    collectionId: dbId,
    name: nonEmptyString
  }),
  'host.deleteDocument': z.object({
    id: dbId,
    collectionId: dbId
  }),
  'host.moveDocument': z.object({
    collectionId: dbId,
    documentId: dbId,
    folderId: dbId.nullable(),
    index: z.number().int().optional()
  }),
  'host.reorderDocuments': z.object({
    collectionId: dbId,
    folderId: dbId.nullable(),
    orderedDocumentIds: z.array(dbId)
  }),
  'host.reorderContainerItems': z.object({
    collectionId: dbId,
    folderId: dbId.nullable(),
    items: z.array(
      z.object({
        kind: z.enum(['request', 'document']),
        id: dbId
      })
    )
  }),
  'host.listCollections': z
    .object({
      options: libraryListOptionsSchema
    })
    .optional()
    .default({}),
  'host.listFolders': z.object({ collectionId: dbId }),
  'host.listRequests': z.object({ collectionId: dbId }),
  'host.listDocuments': z.object({ collectionId: dbId }),
  'host.listLibraryTree': z
    .object({
      options: libraryListOptionsSchema
    })
    .optional()
    .default({}),
  'host.listCollectionRequests': z.object({
    collectionId: dbId,
    folderId: dbId.nullable().optional()
  }),
  'host.getCollectionMetadata': z.object({ collectionId: dbId }),
  'host.listWorkflows': optionalEmpty,
  'host.getWorkflow': z.object({ workflowId: dbId }),
  'host.createWorkflow': z.object({ input: z.unknown() }),
  'host.updateWorkflow': z.object({ input: z.unknown() }),
  'host.renameWorkflow': z.object({
    workflowId: dbId,
    name: nonEmptyString
  }),
  'host.deleteWorkflow': z.object({ workflowId: dbId }),
  'host.logRequestToConsole': z.object({ payload: z.unknown() }),
  'host.fetch': z.object({
    input: z.unknown(),
    init: z.unknown().optional()
  }),
  'host.clearResponse': optionalEmpty,
  'host.openImageView': z.object({ payload: z.unknown() }),
  'livePage.open': z
    .object({
      url: z.string().optional(),
      reuse: z.boolean().optional()
    })
    .optional()
    .default({}),
  'livePage.focus': z.object({ tabId: z.string() }),
  'livePage.close': z.object({ tabId: z.string() }),
  'livePage.query': z.object({
    tabId: z.string(),
    selector: z.string(),
    all: z.boolean().optional(),
    maxElements: z.number().optional()
  }),
  'livePage.evaluate': z.object({
    tabId: z.string(),
    expression: z.string()
  }),
  'livePage.injectScript': z.object({
    tabId: z.string(),
    source: z.string()
  }),
  'livePage.injectStylesheet': z.object({
    tabId: z.string(),
    css: z.string()
  }),
  'livePage.screenshot': z.object({
    tabId: z.string(),
    fullPage: z.boolean().optional()
  }),
  'livePage.goBack': z.object({ tabId: z.string() }),
  'livePage.goForward': z.object({ tabId: z.string() }),
  'livePage.reload': z.object({ tabId: z.string() }),
  'livePage.navigate': z.object({
    tabId: z.string(),
    url: z.string()
  }),
  'liveServers.list': optionalEmpty,
  'liveServers.get': z.object({ idOrUuid: z.union([dbId, nonEmptyString]) }),
  'liveServers.create': z.object({ input: z.unknown() }),
  'liveServers.update': z.object({ input: z.unknown() }),
  'liveServers.delete': z.object({ id: dbId }),
  'liveServers.start': z.object({ input: z.unknown() }),
  'liveServers.stop': z.object({ query: z.unknown() }),
  'liveServers.listRunning': optionalEmpty,
  'liveServers.getStatus': z.object({ query: z.unknown() }),
  'liveServers.getLogs': z.object({ query: z.unknown() }),
  'liveServers.clearLogs': z.object({ query: z.unknown() }),
  'livePages.list': optionalEmpty,
  'livePages.get': z.object({ idOrUuid: z.union([dbId, nonEmptyString]) }),
  'livePages.create': z.object({ input: z.unknown() }),
  'livePages.update': z.object({ input: z.unknown() }),
  'livePages.delete': z.object({ id: dbId })
} as const;

export type PluginUiBridgeOp = keyof typeof pluginUiBridgePayloadSchemas;

/**
 * Host-renderer contribution sync message from the main-process broker.
 */
export const contributionMessageSchema = z.discriminatedUnion('op', [
  z.object({
    pluginId: nonEmptyString,
    op: z.literal('unregisterContribution'),
    kind: contributionKindSchema,
    contributionId: nonEmptyString
  }),
  z.object({
    pluginId: nonEmptyString,
    op: z.literal('registerContribution'),
    kind: contributionKindSchema,
    contribution: z.record(z.string(), z.unknown())
  })
]);

export type ContributionMessage = z.infer<typeof contributionMessageSchema>;

/**
 * Import-handler sync message from the main-process broker.
 */
export const importHandlerMessageSchema = z.object({
  pluginId: nonEmptyString,
  op: z.enum(['register', 'unregister']),
  registrationId: nonEmptyString,
  extensions: z.array(z.string()).optional()
});

export type ImportHandlerMessage = z.infer<typeof importHandlerMessageSchema>;

/**
 * Void host-bridge push message from the main-process broker.
 */
export const hostBridgeMessageSchema = z.object({
  pluginId: nonEmptyString,
  op: nonEmptyString,
  payload: z.unknown().optional()
});

export type HostBridgeMessage = z.infer<typeof hostBridgeMessageSchema>;

/**
 * Correlated host-bridge invoke message from the main-process broker.
 */
export const hostBridgeInvokeMessageSchema = hostBridgeMessageSchema.extend({
  requestId: z.number().int().positive()
});

export type HostBridgeInvokeMessage = z.infer<typeof hostBridgeInvokeMessageSchema>;

/**
 * Formats a Zod failure into a stable bridge error message.
 *
 * @param label - Human-readable context (channel or op name).
 * @param error - Zod validation error.
 */
function formatZodError(label: string, error: z.ZodError): string {
  return `Invalid plugin UI bridge payload for "${label}": ${error.message}`;
}

/**
 * Parses and validates a `plugins:uiBridge` envelope.
 *
 * @param raw - Unknown IPC argument.
 * @returns Validated op + optional payload.
 * @throws When the envelope shape is invalid.
 */
export function parsePluginUiBridgeInvokeEnvelope(raw: unknown): {
  op: string;
  payload?: unknown;
} {
  const result = pluginUiBridgeInvokeEnvelopeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(formatZodError('plugins:uiBridge', result.error));
  }
  return result.data;
}

/**
 * Parses a broker/host-bridge operation payload with the per-op Zod schema.
 *
 * @param op - Bridge operation name.
 * @param payload - Raw payload from the guest or broker.
 * @returns Validated payload typed loosely as unknown (callers narrow via op).
 * @throws When the op is unknown or the payload fails validation.
 */
export function parsePluginUiBridgePayload(op: string, payload: unknown): unknown {
  const schema = pluginUiBridgePayloadSchemas[op as PluginUiBridgeOp];
  if (!schema) {
    throw new Error(`Unsupported plugin UI bridge operation: ${op}`);
  }
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(formatZodError(op, result.error));
  }
  return result.data;
}

/**
 * Parses a contribution register/unregister message for the host renderer.
 *
 * @param raw - Unknown message from `plugins:contributions`.
 * @returns Validated contribution message.
 * @throws When validation fails.
 */
export function parseContributionMessage(raw: unknown): ContributionMessage {
  const envelope = contributionMessageSchema.safeParse(raw);
  if (!envelope.success) {
    throw new Error(formatZodError('plugins:contributions', envelope.error));
  }

  if (envelope.data.op === 'unregisterContribution') {
    return envelope.data;
  }

  const kindSchema = contributionByKindSchema[envelope.data.kind];
  const contributionResult = kindSchema.safeParse(envelope.data.contribution);
  if (!contributionResult.success) {
    throw new Error(
      formatZodError(`plugins:contributions:${envelope.data.kind}`, contributionResult.error)
    );
  }

  return {
    ...envelope.data,
    contribution: contributionResult.data as Record<string, unknown>
  };
}

/**
 * Parses an import-handler sync message for the host renderer.
 *
 * @param raw - Unknown message from `plugins:importHandlers`.
 * @returns Validated import-handler message.
 * @throws When validation fails.
 */
export function parseImportHandlerMessage(raw: unknown): ImportHandlerMessage {
  const result = importHandlerMessageSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(formatZodError('plugins:importHandlers', result.error));
  }
  return result.data;
}

/**
 * Parses a void host-bridge message for the host renderer.
 *
 * @param raw - Unknown message from `plugins:hostBridge`.
 * @returns Validated host bridge message with per-op payload parsing when known.
 * @throws When validation fails.
 */
export function parseHostBridgeMessage(raw: unknown): HostBridgeMessage {
  const envelope = hostBridgeMessageSchema.safeParse(raw);
  if (!envelope.success) {
    throw new Error(formatZodError('plugins:hostBridge', envelope.error));
  }
  if (envelope.data.op in pluginUiBridgePayloadSchemas) {
    return {
      ...envelope.data,
      payload: parsePluginUiBridgePayload(envelope.data.op, envelope.data.payload)
    };
  }
  return envelope.data;
}

/**
 * Parses a correlated host-bridge invoke message for the host renderer.
 *
 * @param raw - Unknown message from `plugins:hostBridgeInvoke`.
 * @returns Validated invoke message with per-op payload parsing.
 * @throws When validation fails.
 */
export function parseHostBridgeInvokeMessage(raw: unknown): HostBridgeInvokeMessage {
  const envelope = hostBridgeInvokeMessageSchema.safeParse(raw);
  if (!envelope.success) {
    throw new Error(formatZodError('plugins:hostBridgeInvoke', envelope.error));
  }
  return {
    ...envelope.data,
    payload: parsePluginUiBridgePayload(envelope.data.op, envelope.data.payload)
  };
}

/**
 * Validates a registerContribution payload and returns the typed contribution body.
 *
 * @param kind - Contribution bucket.
 * @param contribution - Raw contribution object.
 * @returns Validated contribution for the kind.
 * @throws When validation fails.
 */
export function parseContributionForKind(
  kind: ContributionKind,
  contribution: unknown
): Record<string, unknown> {
  const result = contributionByKindSchema[kind].safeParse(contribution);
  if (!result.success) {
    throw new Error(formatZodError(`registerContribution:${kind}`, result.error));
  }
  return result.data as Record<string, unknown>;
}
