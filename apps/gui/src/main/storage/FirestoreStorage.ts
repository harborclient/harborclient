import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  orderBy,
  query,
  runTransaction,
  setDoc,
  terminate,
  updateDoc,
  where,
  writeBatch,
  type Firestore
} from 'firebase/firestore';
import { maskVariablesForExport, validateCollectionExport } from './collectionData';
import {
  buildDocumentUuidIndex,
  buildFolderImportMaps,
  buildRequestFingerprintIndexes,
  buildRequestUuidIndex,
  createEmptyFolderImportMaps,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportRequestId,
  resolveImportedCollectionUuid,
  resolveImportedFolderUuid,
  resolveUpsertRequestFolderId,
  savedDocumentToExportedDocument,
  savedRequestToExportedRequest,
  serializeImportedCollectionScriptFields,
  serializeImportedDocumentFields,
  serializeImportedFolderFields,
  serializeImportedRequestFields
} from './collectionImport';
import {
  assertFolderSiblingReorder,
  assertValidFolderParent,
  exportFoldersWithParents,
  folderSubtreeIdsForDeletion,
  maxSiblingFolderSortOrder,
  resolveImportParentFolderId,
  sortExportedFoldersParentFirst,
  wouldCreateFolderCycle
} from './folderStorage';
import {
  docToCollection,
  docToDocument,
  docToEnvironment,
  docToFolder,
  docToProviderSnippet,
  docToRequest,
  rowToProviderLivePage,
  rowToProviderLiveServer
} from './entityMappers';
import { assertContainerItemOrder, planContainerItemMove } from './containerReorder';
import type { ContainerItemRef } from '@harborclient/core/collectionContainerOrder';
import { bundleScriptFieldsWithLegacy } from './scriptFields';
import { trimRequiredName } from './trimRequiredName';
import { defaultAuth } from '@harborclient/core/auth';
import type { IStorage } from './IStorage';
import type {
  AuthConfig,
  Collection,
  CollectionDocument,
  CollectionExport,
  CreateLiveServerInput,
  CreateWebsiteInput,
  Environment,
  FirestoreSettings,
  Folder,
  KeyValue,
  LiveServer,
  SaveDocumentInput,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Snippet,
  UpdateLiveServerInput,
  UpdateWebsiteInput,
  Variable,
  Website
} from '@harborclient/core/types';
import type {
  ProviderRunResult,
  ProviderRunResultSummary,
  SaveRunResultInput
} from '@harborclient/core/collectionRunner';
import type { SnippetScope } from '@harborclient/core/snippetScope';
import { DEFAULT_SCRIPT_STAGE, normalizeScriptStage } from '@harborclient/core/scriptStage';
import type { ScriptStage } from '@harborclient/sdk';
import { generateDocumentUuid } from './uuid';
import { serializeSidebarMarker } from './sidebarMarkerMigration';
import { serializeLiveServerPayload } from '@harborclient/storage-sqlite/liveServerPayload';
import { serializeLivePagePayload } from '@harborclient/storage-sqlite/livePagePayload';

/**
 * Maximum writes per Firestore batch commit.
 */
const WRITE_BATCH_LIMIT = 500;

/**
 * IDs reserved per counter transaction when dispensing via {@link FirestoreStorage.nextId}.
 */
const ID_BLOCK_SIZE = 50;

export class FirestoreStorage implements IStorage {
  readonly #settings: FirestoreSettings;
  #app: FirebaseApp | null = null;
  #firestore: Firestore | null = null;
  /**
   * Unused IDs from the most recent block allocation, keyed by counter name.
   */
  readonly #idBlocks = new Map<string, number[]>();

  /**
   * @param settings - Firebase connection and auth settings.
   */
  constructor(settings: FirestoreSettings) {
    this.#settings = settings;
  }

  /**
   * Returns the active Firestore handle.
   *
   * @throws When init has not been called yet.
   */
  private getFirestore(): Firestore {
    if (!this.#firestore) throw new Error('Database not initialized');
    return this.#firestore;
  }

  /**
   * Allocates a contiguous block of numeric IDs for a named counter.
   *
   * @param counterName - Counter document name.
   * @param count - Number of IDs to allocate.
   * @returns Allocated IDs in ascending order.
   */
  private async allocateIds(counterName: string, count: number): Promise<number[]> {
    if (count <= 0) return [];

    // Bulk allocation must not reuse IDs still cached for single nextId calls.
    this.#idBlocks.delete(counterName);

    const firestore = this.getFirestore();
    const counterRef = doc(firestore, 'counters', counterName);

    return runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? Number(snap.data().value ?? 0) : 0;
      const next = current + count;
      transaction.set(counterRef, { value: next });
      return Array.from({ length: count }, (_, index) => current + index + 1);
    });
  }

  /**
   * Allocates the next numeric ID for a named counter.
   *
   * Uses in-memory hi/lo blocks so routine inserts share one Firestore transaction
   * per {@link ID_BLOCK_SIZE} IDs instead of one transaction per row.
   *
   * @param counterName - Counter document name.
   */
  private async nextId(counterName: string): Promise<number> {
    const cached = this.#idBlocks.get(counterName);
    if (cached != null && cached.length > 0) {
      return cached.shift() as number;
    }

    const ids = await this.allocateIds(counterName, ID_BLOCK_SIZE);
    const [next, ...rest] = ids;
    this.#idBlocks.set(counterName, rest);
    return next;
  }

  /**
   * Commits document writes in Firestore-sized batches.
   *
   * @param firestore - Active Firestore handle.
   * @param writes - Document refs and payloads to set.
   */
  private async commitBatchedSets(
    firestore: Firestore,
    writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }>
  ): Promise<void> {
    for (let offset = 0; offset < writes.length; offset += WRITE_BATCH_LIMIT) {
      const batch = writeBatch(firestore);
      for (const write of writes.slice(offset, offset + WRITE_BATCH_LIMIT)) {
        batch.set(write.ref, write.data);
      }
      await batch.commit();
    }
  }

  /**
   * Commits document deletes in Firestore-sized batches.
   *
   * @param firestore - Active Firestore handle.
   * @param refs - Document refs to delete.
   */
  private async commitBatchedDeletes(
    firestore: Firestore,
    refs: Array<ReturnType<typeof doc>>
  ): Promise<void> {
    for (let offset = 0; offset < refs.length; offset += WRITE_BATCH_LIMIT) {
      const batch = writeBatch(firestore);
      for (const ref of refs.slice(offset, offset + WRITE_BATCH_LIMIT)) {
        batch.delete(ref);
      }
      await batch.commit();
    }
  }

  /**
   * Ensures a Firestore document has a uuid, backfilling legacy rows on read.
   *
   * @param collectionName - Top-level collection name.
   * @param docId - Document id within the collection.
   * @param data - Existing document fields.
   * @returns The persisted uuid string.
   */
  private async ensureDocumentUuid(
    collectionName:
      | 'collections'
      | 'requests'
      | 'environments'
      | 'folders'
      | 'snippets'
      | 'documents',
    docId: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const existing = typeof data.uuid === 'string' ? data.uuid.trim() : '';
    if (existing) {
      return existing;
    }

    const uuid = generateDocumentUuid();
    await updateDoc(doc(this.getFirestore(), collectionName, docId), { uuid });
    return uuid;
  }

  /**
   * Opens the Firestore connection and signs in with configured credentials.
   */
  async init(): Promise<void> {
    if (this.#firestore) return;

    const { apiKey, authDomain, projectId, appId, email, password } = this.#settings;
    if (!apiKey || !authDomain || !projectId || !appId || !email || !password) {
      throw new Error('Firestore settings are incomplete');
    }

    this.#app = initializeApp({ apiKey, authDomain, projectId, appId });
    const auth = getAuth(this.#app);

    const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (authEmulatorHost) {
      const authEmulatorUrl = authEmulatorHost.includes('://')
        ? authEmulatorHost
        : `http://${authEmulatorHost}`;
      connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (authEmulatorHost && code === 'auth/user-not-found') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        if (this.#app) {
          await deleteApp(this.#app);
          this.#app = null;
        }
        throw err;
      }
    }

    this.#firestore = initializeFirestore(this.#app, { experimentalForceLongPolling: true });

    const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
    if (firestoreEmulatorHost) {
      const [host, portText] = firestoreEmulatorHost.split(':');
      const port = Number(portText);
      if (host && Number.isFinite(port)) {
        connectFirestoreEmulator(this.#firestore, host, port);
      }
    }
  }

  /**
   * Lists all collections ordered by name.
   *
   * @returns All collections in the database.
   */
  async listCollections(): Promise<Collection[]> {
    const firestore = this.getFirestore();
    const snap = await getDocs(query(collection(firestore, 'collections'), orderBy('name')));
    const results: Collection[] = [];
    for (const document of snap.docs) {
      const data = document.data() as Record<string, unknown>;
      const uuid = await this.ensureDocumentUuid('collections', document.id, data);
      results.push(docToCollection(Number(document.id), { ...data, uuid }));
    }
    return results;
  }

  /**
   * Creates a new collection with the given name.
   *
   * @param name - Display name for the collection.
   * @returns The newly created collection.
   */
  async createCollection(name: string): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const id = await this.nextId('collections');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      uuid: generateDocumentUuid(),
      name: trimmedName,
      variables: [] as Variable[],
      headers: [] as KeyValue[],
      userAgent: '',
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: '[]',
      post_request_scripts: '[]',
      created_at: createdAt,
      marker: null
    };

    await setDoc(doc(this.getFirestore(), 'collections', String(id)), data);
    return docToCollection(id, data);
  }

  /**
   * Updates a collection's name, variables, headers, user agent, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @param userAgent - User-Agent override; empty inherits the global default.
   * @param preRequestScripts - Ordered collection pre-request script references.
   * @param postRequestScripts - Ordered collection post-request script references.
   * @returns The updated collection.
   */
  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    userAgent: string,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    const legacyPreScript = preScripts.legacy;
    const legacyPostScript = postScripts.legacy;
    const ref = doc(this.getFirestore(), 'collections', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Collection not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, {
      name: trimmedName,
      variables,
      headers,
      userAgent,
      auth,
      pre_request_script: legacyPreScript,
      post_request_script: legacyPostScript,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json
    });

    return docToCollection(id, {
      ...existing,
      name: trimmedName,
      variables,
      headers,
      userAgent,
      auth,
      pre_request_script: legacyPreScript,
      post_request_script: legacyPostScript,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json
    });
  }

  /**
   * Updates a collection's sidebar marker.
   *
   * @param id - Collection ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated collection.
   */
  async setCollectionMarker(id: number, marker: string | null): Promise<Collection> {
    const ref = doc(this.getFirestore(), 'collections', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Collection not found');

    const existing = snap.data() as Record<string, unknown>;
    const normalizedMarker = serializeSidebarMarker(marker);
    await updateDoc(ref, { marker: normalizedMarker });
    return docToCollection(id, { ...existing, marker: normalizedMarker });
  }

  /**
   * Deletes a collection and all of its requests.
   *
   * @param id - Collection ID to delete.
   */
  async deleteCollection(id: number): Promise<void> {
    const firestore = this.getFirestore();
    const requestsSnap = await getDocs(
      query(collection(firestore, 'requests'), where('collection_id', '==', id))
    );
    const foldersSnap = await getDocs(
      query(collection(firestore, 'folders'), where('collection_id', '==', id))
    );
    const documentsSnap = await getDocs(
      query(collection(firestore, 'documents'), where('collection_id', '==', id))
    );

    const refs = [
      ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
      ...foldersSnap.docs.map((folderDoc) => folderDoc.ref),
      ...documentsSnap.docs.map((documentDoc) => documentDoc.ref),
      doc(firestore, 'collections', String(id))
    ];
    await this.commitBatchedDeletes(firestore, refs);
  }

  /**
   * Lists all environments ordered by name.
   *
   * @returns All environments in the database.
   */
  async listEnvironments(): Promise<Environment[]> {
    const firestore = this.getFirestore();
    const snap = await getDocs(query(collection(firestore, 'environments'), orderBy('name')));
    const results: Environment[] = [];
    for (const document of snap.docs) {
      const data = document.data() as Record<string, unknown>;
      const uuid = await this.ensureDocumentUuid('environments', document.id, data);
      results.push(docToEnvironment(Number(document.id), { ...data, uuid }));
    }
    return results;
  }

  /**
   * Creates a new environment with the given name.
   *
   * @param name - Display name for the environment.
   * @returns The newly created environment.
   */
  async createEnvironment(name: string, uuid?: string): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const id = await this.nextId('environments');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      uuid: uuid?.trim() || generateDocumentUuid(),
      name: trimmedName,
      variables: [] as Variable[],
      created_at: createdAt,
      marker: null,
      parentUuid: null as string | null
    };

    await setDoc(doc(this.getFirestore(), 'environments', String(id)), data);
    return docToEnvironment(id, data);
  }

  /**
   * Updates an environment's name, variables, and optional parent link.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @param parentUuid - Parent environment uuid; `null` clears; omit to leave unchanged.
   * @returns The updated environment.
   */
  async updateEnvironment(
    id: number,
    name: string,
    variables: Variable[],
    parentUuid?: string | null
  ): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const ref = doc(this.getFirestore(), 'environments', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Environment not found');

    const existing = snap.data() as Record<string, unknown>;
    const normalizedParent = parentUuid === undefined ? undefined : parentUuid?.trim() || null;
    await updateDoc(ref, {
      name: trimmedName,
      variables,
      ...(normalizedParent === undefined ? {} : { parentUuid: normalizedParent })
    });

    return docToEnvironment(id, {
      ...existing,
      name: trimmedName,
      variables,
      ...(normalizedParent === undefined ? {} : { parentUuid: normalizedParent })
    });
  }

  /**
   * Updates an environment's sidebar marker.
   *
   * @param id - Environment ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated environment.
   */
  async setEnvironmentMarker(id: number, marker: string | null): Promise<Environment> {
    const ref = doc(this.getFirestore(), 'environments', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Environment not found');

    const existing = snap.data() as Record<string, unknown>;
    const normalizedMarker = serializeSidebarMarker(marker);
    await updateDoc(ref, { marker: normalizedMarker });
    return docToEnvironment(id, { ...existing, marker: normalizedMarker });
  }

  /**
   * Deletes an environment and orphans any direct children (clears their parentUuid).
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: number): Promise<void> {
    const firestore = this.getFirestore();
    const ref = doc(firestore, 'environments', String(id));
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      const deletedUuid =
        typeof data.uuid === 'string' && data.uuid.trim() !== '' ? data.uuid.trim() : null;
      if (deletedUuid) {
        const children = await getDocs(
          query(collection(firestore, 'environments'), where('parentUuid', '==', deletedUuid))
        );
        for (const child of children.docs) {
          await updateDoc(child.ref, { parentUuid: null });
        }
      }
    }
    await deleteDoc(ref);
  }

  /**
   * Lists all snippets stored in this provider ordered for display.
   */
  async listSnippets(): Promise<Snippet[]> {
    const firestore = this.getFirestore();
    const snap = await getDocs(collection(firestore, 'snippets'));
    const results: Snippet[] = [];
    for (const document of snap.docs) {
      const data = document.data() as Record<string, unknown>;
      const uuid = await this.ensureDocumentUuid('snippets', document.id, data);
      results.push(docToProviderSnippet(Number(document.id), { ...data, uuid }));
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Creates a new snippet in this provider.
   */
  async createSnippet(
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE,
    uuid?: string
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const id = await this.nextId('snippets');
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    const data = {
      id,
      uuid: uuid?.trim() || generateDocumentUuid(),
      name: trimmedName,
      code: code ?? '',
      scope,
      stage: normalizedRole,
      sort_order: id,
      created_at: now,
      updated_at: now
    };

    await setDoc(doc(this.getFirestore(), 'snippets', String(id)), data);
    return docToProviderSnippet(id, data);
  }

  /**
   * Updates a snippet's name, code, and scope in this provider.
   */
  async updateSnippet(
    id: number,
    name: string,
    code: string,
    scope: SnippetScope = 'any',
    stage: ScriptStage = DEFAULT_SCRIPT_STAGE
  ): Promise<Snippet> {
    const trimmedName = trimRequiredName(name, 'Snippet name');
    const ref = doc(this.getFirestore(), 'snippets', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Snippet not found');

    const existing = snap.data() as Record<string, unknown>;
    const now = new Date().toISOString();
    const normalizedRole = normalizeScriptStage(stage);
    await updateDoc(ref, {
      name: trimmedName,
      code: code ?? '',
      scope,
      stage: normalizedRole,
      updated_at: now
    });

    return docToProviderSnippet(id, {
      ...existing,
      name: trimmedName,
      code: code ?? '',
      scope,
      stage: normalizedRole,
      updated_at: now
    });
  }

  /**
   * Deletes a snippet from this provider.
   */
  async deleteSnippet(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'snippets', String(id)));
  }

  /**
   * Lists live servers ordered by provider sort position.
   */
  async listLiveServers(): Promise<LiveServer[]> {
    const snap = await getDocs(collection(this.getFirestore(), 'live_servers'));
    return snap.docs
      .map((document) =>
        rowToProviderLiveServer({
          ...document.data(),
          id: Number(document.id)
        })
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  /**
   * Creates a live server document.
   *
   * @param input - Live server fields to persist.
   */
  async createLiveServer(input: CreateLiveServerInput): Promise<LiveServer> {
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const id = await this.nextId('live_servers');
    const now = Date.now();
    const data = {
      id,
      uuid: input.uuid?.trim() || generateDocumentUuid(),
      name,
      payload: serializeLiveServerPayload(input),
      sort_order: id,
      created_at: now,
      updated_at: now
    };
    await setDoc(doc(this.getFirestore(), 'live_servers', String(id)), data);
    return rowToProviderLiveServer(data);
  }

  /**
   * Replaces a live server document's mutable fields.
   *
   * @param input - Complete live server update.
   */
  async updateLiveServer(input: UpdateLiveServerInput): Promise<LiveServer> {
    const ref = doc(this.getFirestore(), 'live_servers', String(input.id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Live server not found: ${input.id}`);
    const name = trimRequiredName(input.name, 'Live server name');
    if (!input.root.trim()) throw new Error('Root directory is required');
    const updated = {
      ...snap.data(),
      id: input.id,
      name,
      payload: serializeLiveServerPayload(input),
      updated_at: Date.now()
    };
    await updateDoc(ref, {
      name: updated.name,
      payload: updated.payload,
      updated_at: updated.updated_at
    });
    return rowToProviderLiveServer(updated);
  }

  /**
   * Deletes a live server document.
   *
   * @param id - Provider-local live server id.
   */
  async deleteLiveServer(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'live_servers', String(id)));
  }

  /**
   * Lists live pages ordered by provider sort position.
   */
  async listLivePages(): Promise<Website[]> {
    const snap = await getDocs(collection(this.getFirestore(), 'live_pages'));
    return snap.docs
      .map((document) =>
        rowToProviderLivePage({
          ...document.data(),
          id: Number(document.id)
        })
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Creates a live page document.
   *
   * @param input - Website fields to persist.
   */
  async createLivePage(input: CreateWebsiteInput): Promise<Website> {
    const id = await this.nextId('live_pages');
    const now = Date.now();
    const data = {
      id,
      uuid: input.uuid?.trim() || generateDocumentUuid(),
      name: trimRequiredName(input.name, 'Live page name'),
      payload: serializeLivePagePayload(input),
      sort_order: id,
      created_at: now,
      updated_at: now
    };
    await setDoc(doc(this.getFirestore(), 'live_pages', String(id)), data);
    return rowToProviderLivePage(data);
  }

  /**
   * Replaces a live page document's mutable fields.
   *
   * @param input - Complete live page update.
   */
  async updateLivePage(input: UpdateWebsiteInput): Promise<Website> {
    const ref = doc(this.getFirestore(), 'live_pages', String(input.id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Live page not found: ${input.id}`);
    const updated = {
      ...snap.data(),
      id: input.id,
      name: trimRequiredName(input.name, 'Live page name'),
      payload: serializeLivePagePayload(input),
      updated_at: Date.now()
    };
    await updateDoc(ref, {
      name: updated.name,
      payload: updated.payload,
      updated_at: updated.updated_at
    });
    return rowToProviderLivePage(updated);
  }

  /**
   * Deletes a live page document.
   *
   * @param id - Provider-local live page id.
   */
  async deleteLivePage(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'live_pages', String(id)));
  }

  /**
   * Firestore-backed storage does not persist run result snapshots.
   */
  async listRunResults(): Promise<ProviderRunResultSummary[]> {
    return [];
  }

  /**
   * Firestore-backed storage does not persist run result snapshots.
   */
  async saveRunResult(input: SaveRunResultInput): Promise<ProviderRunResult> {
    void input;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * Firestore-backed storage does not persist run result snapshots.
   */
  async getRunResult(id: number): Promise<ProviderRunResult | null> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * Firestore-backed storage does not persist run result snapshots.
   */
  async deleteRunResult(id: number): Promise<void> {
    void id;
    throw new Error('Run results are not supported for this storage provider');
  }

  /**
   * Lists all saved requests in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Requests ordered by sort_order then name.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const firestore = this.getFirestore();
    const snap = await getDocs(
      query(collection(firestore, 'requests'), where('collection_id', '==', collectionId))
    );

    const results: SavedRequest[] = [];
    for (const document of snap.docs) {
      const data = document.data() as Record<string, unknown>;
      const uuid = await this.ensureDocumentUuid('requests', document.id, data);
      results.push(docToRequest(Number(document.id), { ...data, uuid }));
    }

    return results.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @returns The saved request with ID and timestamps.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const userAgent = typeof input.userAgent === 'string' ? input.userAgent : '';
    const preScripts = bundleScriptFieldsWithLegacy(
      input.pre_request_scripts,
      input.pre_request_script ?? ''
    );
    const postScripts = bundleScriptFieldsWithLegacy(
      input.post_request_scripts,
      input.post_request_script ?? ''
    );
    const preRequestScript = preScripts.legacy;
    const postRequestScript = postScripts.legacy;
    const comment = input.comment ?? '';
    const tags = input.tags ?? '';
    const bodyRaw = input.body_raw ?? null;
    const bodyRawOpen = input.body_raw_open === true;
    const now = new Date().toISOString();
    const firestore = this.getFirestore();
    const folderId = input.folder_id ?? null;
    const normalizedMarker =
      input.marker !== undefined ? serializeSidebarMarker(input.marker) : undefined;

    if (folderId != null) {
      const folderSnap = await getDoc(doc(firestore, 'folders', String(folderId)));
      if (!folderSnap.exists()) throw new Error('Folder not found');
      const folderData = folderSnap.data() as Record<string, unknown>;
      if (folderData.collection_id !== input.collection_id) throw new Error('Folder not found');
    }

    if (input.id) {
      const ref = doc(firestore, 'requests', String(input.id));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = snap.data() as Record<string, unknown>;
        const data: Record<string, unknown> = {
          ...existing,
          collection_id: input.collection_id,
          folder_id: input.folder_id ?? null,
          name: trimmedName,
          method: input.method,
          protocol: input.protocol === 'sse' ? 'sse' : 'http',
          url: input.url,
          headers: input.headers,
          userAgent,
          params: input.params,
          auth: input.auth,
          body: input.body,
          body_type: input.body_type,
          body_raw: bodyRaw,
          body_raw_open: bodyRawOpen,
          pre_request_script: preRequestScript,
          post_request_script: postRequestScript,
          pre_request_scripts: preScripts.json,
          post_request_scripts: postScripts.json,
          comment,
          tags,
          updated_at: now
        };
        if (normalizedMarker !== undefined) {
          data.marker = normalizedMarker;
        }

        await updateDoc(ref, data);
        return docToRequest(input.id, data);
      }
    }

    const existingRequests = await this.listRequests(input.collection_id);
    const maxOrder = existingRequests
      .filter(
        (request) =>
          (folderId == null && request.folder_id == null) || request.folder_id === folderId
      )
      .reduce((max, request) => Math.max(max, request.sort_order), -1);
    const id = await this.nextId('requests');
    const createdAt = now;
    const data = {
      id,
      uuid: input.uuid?.trim() || generateDocumentUuid(),
      collection_id: input.collection_id,
      folder_id: folderId,
      name: trimmedName,
      method: input.method,
      protocol: input.protocol === 'sse' ? 'sse' : 'http',
      url: input.url,
      headers: input.headers,
      userAgent,
      params: input.params,
      auth: input.auth,
      body: input.body,
      body_type: input.body_type,
      body_raw: bodyRaw,
      body_raw_open: bodyRawOpen,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json,
      comment,
      tags,
      sort_order: maxOrder + 1,
      created_at: createdAt,
      updated_at: now,
      marker: normalizedMarker ?? null
    };

    await setDoc(doc(firestore, 'requests', String(id)), data);
    return docToRequest(id, data);
  }

  /**
   * Deletes a saved request by ID.
   *
   * @param id - Request ID to delete.
   */
  async deleteRequest(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'requests', String(id)));
  }

  /**
   * Updates a saved request's sidebar marker.
   *
   * @param id - Request ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated request.
   */
  async setRequestMarker(id: number, marker: string | null): Promise<SavedRequest> {
    const ref = doc(this.getFirestore(), 'requests', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Request not found');

    const existing = snap.data() as Record<string, unknown>;
    const normalizedMarker = serializeSidebarMarker(marker);
    await updateDoc(ref, { marker: normalizedMarker });
    return docToRequest(id, { ...existing, marker: normalizedMarker });
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const firestore = this.getFirestore();
    const snap = await getDocs(
      query(collection(firestore, 'folders'), where('collection_id', '==', collectionId))
    );

    const results: Folder[] = [];
    for (const document of snap.docs) {
      const data = document.data() as Record<string, unknown>;
      const uuid = await this.ensureDocumentUuid('folders', document.id, data);
      results.push(docToFolder(Number(document.id), { ...data, uuid }));
    }

    return results.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @param parentFolderId - Parent folder id, or null/omitted for collection root.
   * @returns The newly created folder.
   */
  async createFolder(
    collectionId: number,
    name: string,
    parentFolderId?: number | null
  ): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const parentId = parentFolderId ?? null;
    const existingFolders = await this.listFolders(collectionId);
    assertValidFolderParent(existingFolders, collectionId, parentId);
    const maxOrder = maxSiblingFolderSortOrder(existingFolders, parentId);
    const id = await this.nextId('folders');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      uuid: generateDocumentUuid(),
      collection_id: collectionId,
      parent_folder_id: parentId,
      name: trimmedName,
      sort_order: maxOrder + 1,
      variables: [],
      headers: [],
      userAgent: '',
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: '[]',
      post_request_scripts: '[]',
      created_at: createdAt,
      marker: null
    };

    await setDoc(doc(this.getFirestore(), 'folders', String(id)), data);
    return docToFolder(id, data);
  }

  /**
   * Moves a folder to a new parent and optional sibling index.
   *
   * @param folderId - Folder to move.
   * @param parentFolderId - New parent folder id, or null for collection root.
   * @param sortOrder - Optional zero-based index among new siblings.
   * @returns The updated folder.
   */
  async moveFolder(
    folderId: number,
    parentFolderId: number | null,
    sortOrder?: number
  ): Promise<Folder> {
    const firestore = this.getFirestore();
    const ref = doc(firestore, 'folders', String(folderId));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Folder not found');

    const existing = docToFolder(folderId, snap.data() as Record<string, unknown>);
    const folders = await this.listFolders(existing.collection_id);
    assertValidFolderParent(folders, existing.collection_id, parentFolderId);
    if (wouldCreateFolderCycle(folderId, parentFolderId, folders)) {
      throw new Error('Cannot move a folder under itself or a descendant');
    }

    const destSiblings = folders
      .filter(
        (folder) => folder.id !== folderId && (folder.parent_folder_id ?? null) === parentFolderId
      )
      .sort(
        (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
      );

    const targetIndex =
      sortOrder != null
        ? Math.max(0, Math.min(sortOrder, destSiblings.length))
        : destSiblings.length;
    const orderedIds = [
      ...destSiblings.slice(0, targetIndex).map((folder) => folder.id),
      folderId,
      ...destSiblings.slice(targetIndex).map((folder) => folder.id)
    ];

    await updateDoc(ref, { parent_folder_id: parentFolderId });
    await this.reorderFolders(existing.collection_id, parentFolderId, orderedIds);

    const updatedSnap = await getDoc(ref);
    if (!updatedSnap.exists()) throw new Error('Folder not found');
    return docToFolder(folderId, updatedSnap.data() as Record<string, unknown>);
  }

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @returns The updated folder.
   */
  async renameFolder(id: number, name: string): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const ref = doc(this.getFirestore(), 'folders', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Folder not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, { name: trimmedName });
    return docToFolder(id, { ...existing, name: trimmedName });
  }

  /**
   * Updates a folder's name, variables, headers, auth, user agent, and scripts.
   *
   * @param id - Folder ID to update.
   * @param name - New display name.
   * @param variables - Folder-scoped variables.
   * @param headers - Headers sent with every request in the folder.
   * @param preRequestScript - Script run before each request in the folder.
   * @param postRequestScript - Script run after each request in the folder.
   * @param auth - Default Authorization settings for requests in the folder.
   * @param userAgent - User-Agent override; empty inherits collection → global.
   * @param preRequestScripts - Ordered folder pre-request script references.
   * @param postRequestScripts - Ordered folder post-request script references.
   * @returns The updated folder.
   */
  async updateFolder(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    userAgent: string,
    preRequestScripts: ScriptRef[] = [],
    postRequestScripts: ScriptRef[] = []
  ): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const ref = doc(this.getFirestore(), 'folders', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Folder not found');

    const preScripts = bundleScriptFieldsWithLegacy(preRequestScripts, preRequestScript);
    const postScripts = bundleScriptFieldsWithLegacy(postRequestScripts, postRequestScript);
    const patch = {
      name: trimmedName,
      variables,
      headers,
      userAgent,
      auth,
      pre_request_script: preScripts.legacy,
      post_request_script: postScripts.legacy,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json
    };
    await updateDoc(ref, patch);
    return docToFolder(id, { ...(snap.data() as Record<string, unknown>), ...patch });
  }

  /**
   * Updates a folder's sidebar marker.
   *
   * @param id - Folder ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated folder.
   */
  async setFolderMarker(id: number, marker: string | null): Promise<Folder> {
    const ref = doc(this.getFirestore(), 'folders', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Folder not found');

    const existing = snap.data() as Record<string, unknown>;
    const normalizedMarker = serializeSidebarMarker(marker);
    await updateDoc(ref, { marker: normalizedMarker });
    return docToFolder(id, { ...existing, marker: normalizedMarker });
  }

  /**
   * Deletes a folder, its descendant folders, and all requests and documents inside the subtree.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const firestore = this.getFirestore();
    const folderSnap = await getDoc(doc(firestore, 'folders', String(id)));
    if (!folderSnap.exists()) throw new Error('Folder not found');

    const folder = docToFolder(id, folderSnap.data() as Record<string, unknown>);
    const folders = await this.listFolders(folder.collection_id);
    const folderIds = folderSubtreeIdsForDeletion(id, folders);

    const refs: ReturnType<typeof doc>[] = [];
    for (const folderId of folderIds) {
      const requestsSnap = await getDocs(
        query(collection(firestore, 'requests'), where('folder_id', '==', folderId))
      );
      const documentsSnap = await getDocs(
        query(collection(firestore, 'documents'), where('folder_id', '==', folderId))
      );
      refs.push(
        ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
        ...documentsSnap.docs.map((documentDoc) => documentDoc.ref),
        doc(firestore, 'folders', String(folderId))
      );
    }
    await this.commitBatchedDeletes(firestore, refs);
  }

  /**
   * Lists all markdown documents in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Documents ordered by sort_order then name.
   */
  async listDocuments(collectionId: number): Promise<CollectionDocument[]> {
    const firestore = this.getFirestore();
    const snap = await getDocs(
      query(collection(firestore, 'documents'), where('collection_id', '==', collectionId))
    );

    const results: CollectionDocument[] = [];
    for (const document of snap.docs) {
      const data = document.data() as Record<string, unknown>;
      const uuid = await this.ensureDocumentUuid('documents', document.id, data);
      results.push(docToDocument(Number(document.id), { ...data, uuid }));
    }

    return results.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  /**
   * Inserts a new document or updates an existing one.
   *
   * @param input - Document fields to persist.
   * @returns The saved document with ID and timestamps.
   */
  async saveDocument(input: SaveDocumentInput): Promise<CollectionDocument> {
    const trimmedName = trimRequiredName(input.name, 'Document name');
    const content = input.content ?? '';
    const folderId = input.folder_id ?? null;
    const now = new Date().toISOString();
    const firestore = this.getFirestore();
    const normalizedMarker =
      input.marker !== undefined ? serializeSidebarMarker(input.marker) : undefined;

    if (folderId != null) {
      const folderSnap = await getDoc(doc(firestore, 'folders', String(folderId)));
      if (!folderSnap.exists()) throw new Error('Folder not found');
      const folderData = folderSnap.data() as Record<string, unknown>;
      if (folderData.collection_id !== input.collection_id) throw new Error('Folder not found');
    }

    if (input.id) {
      const ref = doc(firestore, 'documents', String(input.id));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = snap.data() as Record<string, unknown>;
        const data: Record<string, unknown> = {
          ...existing,
          collection_id: input.collection_id,
          folder_id: folderId,
          name: trimmedName,
          content,
          updated_at: now
        };
        if (normalizedMarker !== undefined) {
          data.marker = normalizedMarker;
        }

        await updateDoc(ref, data);
        return docToDocument(input.id, data);
      }
    }

    const existingDocuments = await this.listDocuments(input.collection_id);
    const maxOrder = existingDocuments
      .filter(
        (document) =>
          (folderId == null && document.folder_id == null) || document.folder_id === folderId
      )
      .reduce((max, document) => Math.max(max, document.sort_order), -1);
    const id = await this.nextId('documents');
    const createdAt = now;
    const data = {
      id,
      uuid: input.uuid?.trim() || generateDocumentUuid(),
      collection_id: input.collection_id,
      folder_id: folderId,
      name: trimmedName,
      content,
      sort_order: maxOrder + 1,
      created_at: createdAt,
      updated_at: now,
      marker: normalizedMarker ?? null
    };

    await setDoc(doc(firestore, 'documents', String(id)), data);
    return docToDocument(id, data);
  }

  /**
   * Deletes a markdown document by ID.
   *
   * @param id - Document ID to delete.
   */
  async deleteDocument(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'documents', String(id)));
  }

  /**
   * Updates a markdown document's sidebar marker.
   *
   * @param id - Document ID to update.
   * @param marker - CSS marker string, or null to clear.
   * @returns The updated document.
   */
  async setDocumentMarker(id: number, marker: string | null): Promise<CollectionDocument> {
    const ref = doc(this.getFirestore(), 'documents', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Document not found');

    const existing = snap.data() as Record<string, unknown>;
    const normalizedMarker = serializeSidebarMarker(marker);
    await updateDoc(ref, { marker: normalizedMarker });
    return docToDocument(id, { ...existing, marker: normalizedMarker });
  }

  /**
   * Reorders requests and markdown documents together within a folder or collection root.
   *
   * @param collectionId - Collection containing the items.
   * @param folderId - Folder ID, or null for root-level items.
   * @param items - Request and document refs in desired unified sidebar order.
   */
  async reorderContainerItems(
    collectionId: number,
    folderId: number | null,
    items: ContainerItemRef[]
  ): Promise<void> {
    const firestore = this.getFirestore();
    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    assertContainerItemOrder(collectionId, folderId, items, requests, documents);

    if (folderId != null) {
      const folderSnap = await getDoc(doc(firestore, 'folders', String(folderId)));
      if (!folderSnap.exists()) throw new Error('Folder not found');
      const folderData = folderSnap.data() as Record<string, unknown>;
      if (folderData.collection_id !== collectionId) throw new Error('Folder not found');
    }

    const batch = writeBatch(firestore);
    items.forEach((item, unifiedIndex) => {
      const collectionName = item.kind === 'request' ? 'requests' : 'documents';
      batch.update(doc(firestore, collectionName, String(item.id)), {
        sort_order: unifiedIndex,
        folder_id: folderId
      });
    });
    await batch.commit();
  }

  /**
   * Reorders documents within a folder or at collection root.
   *
   * @param collectionId - Collection containing the documents.
   * @param folderId - Folder ID, or null for root-level documents.
   * @param orderedDocumentIds - Document IDs in desired order.
   */
  async reorderDocuments(
    collectionId: number,
    folderId: number | null,
    orderedDocumentIds: number[]
  ): Promise<void> {
    const firestore = this.getFirestore();
    await Promise.all(
      orderedDocumentIds.map(async (documentId) => {
        const snap = await getDoc(doc(firestore, 'documents', String(documentId)));
        if (!snap.exists()) throw new Error('Document not found');
        const document = docToDocument(documentId, snap.data() as Record<string, unknown>);
        if (document.collection_id !== collectionId) throw new Error('Document not found');
        const inContainer =
          (folderId == null && document.folder_id == null) || document.folder_id === folderId;
        if (!inContainer) throw new Error('Document not found');
      })
    );

    const batch = writeBatch(firestore);
    orderedDocumentIds.forEach((documentId, index) => {
      batch.update(doc(firestore, 'documents', String(documentId)), {
        sort_order: index,
        folder_id: folderId
      });
    });
    await batch.commit();
  }

  /**
   * Moves a document to another folder or collection root at a given index.
   *
   * @param documentId - Document ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveDocument(documentId: number, folderId: number | null, index: number): Promise<void> {
    const firestore = this.getFirestore();
    const ref = doc(firestore, 'documents', String(documentId));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Document not found');

    const document = docToDocument(documentId, snap.data() as Record<string, unknown>);
    const collectionId = document.collection_id;
    const sourceFolderId = document.folder_id ?? null;

    if (folderId != null) {
      const folderSnap = await getDoc(doc(firestore, 'folders', String(folderId)));
      if (!folderSnap.exists()) throw new Error('Folder not found');
      const folderData = folderSnap.data() as Record<string, unknown>;
      if (folderData.collection_id !== collectionId) throw new Error('Folder not found');
    }

    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    const plan = planContainerItemMove(
      requests,
      documents,
      { kind: 'document', id: documentId },
      sourceFolderId,
      folderId,
      index
    );

    if (plan.sourceOrder) {
      await this.reorderContainerItems(collectionId, sourceFolderId, plan.sourceOrder);
    }
    await this.reorderContainerItems(collectionId, folderId, plan.destinationOrder);
  }

  /**
   * Reorders sibling folders that share the same parent within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param parentFolderId - Parent folder id, or null for collection-root siblings.
   * @param orderedFolderIds - Sibling folder IDs in desired order.
   */
  async reorderFolders(
    collectionId: number,
    parentFolderId: number | null,
    orderedFolderIds: number[]
  ): Promise<void> {
    const firestore = this.getFirestore();
    const folders = await this.listFolders(collectionId);
    assertFolderSiblingReorder(folders, collectionId, parentFolderId, orderedFolderIds);

    await Promise.all(
      orderedFolderIds.map(async (folderId) => {
        const snap = await getDoc(doc(firestore, 'folders', String(folderId)));
        if (!snap.exists()) throw new Error('Folder not found');
        const data = snap.data() as Record<string, unknown>;
        if (data.collection_id !== collectionId) throw new Error('Folder not found');
      })
    );

    const batch = writeBatch(firestore);
    orderedFolderIds.forEach((folderId, index) => {
      batch.update(doc(firestore, 'folders', String(folderId)), { sort_order: index });
    });
    await batch.commit();
  }

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   */
  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const firestore = this.getFirestore();
    await Promise.all(
      orderedRequestIds.map(async (requestId) => {
        const snap = await getDoc(doc(firestore, 'requests', String(requestId)));
        if (!snap.exists()) throw new Error('Request not found');
        const request = docToRequest(requestId, snap.data() as Record<string, unknown>);
        if (request.collection_id !== collectionId) throw new Error('Request not found');
        const inContainer =
          (folderId == null && request.folder_id == null) || request.folder_id === folderId;
        if (!inContainer) throw new Error('Request not found');
      })
    );

    const batch = writeBatch(firestore);
    orderedRequestIds.forEach((requestId, index) => {
      batch.update(doc(firestore, 'requests', String(requestId)), { sort_order: index });
    });
    await batch.commit();
  }

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const firestore = this.getFirestore();
    const ref = doc(firestore, 'requests', String(requestId));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Request not found');

    const request = docToRequest(requestId, snap.data() as Record<string, unknown>);
    const collectionId = request.collection_id;
    const sourceFolderId = request.folder_id ?? null;

    if (folderId != null) {
      const folderSnap = await getDoc(doc(firestore, 'folders', String(folderId)));
      if (!folderSnap.exists()) throw new Error('Folder not found');
      const folderData = folderSnap.data() as Record<string, unknown>;
      if (folderData.collection_id !== collectionId) throw new Error('Folder not found');
    }

    const requests = await this.listRequests(collectionId);
    const documents = await this.listDocuments(collectionId);
    const plan = planContainerItemMove(
      requests,
      documents,
      { kind: 'request', id: requestId },
      sourceFolderId,
      folderId,
      index
    );

    if (plan.sourceOrder) {
      await this.reorderContainerItems(collectionId, sourceFolderId, plan.sourceOrder);
    }
    await this.reorderContainerItems(collectionId, folderId, plan.destinationOrder);
  }

  /**
   * Builds a portable export payload for a collection and its requests.
   *
   * @param id - Collection ID to export.
   * @returns Collection export data without database IDs.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const snap = await getDoc(doc(this.getFirestore(), 'collections', String(id)));
    if (!snap.exists()) throw new Error('Collection not found');

    const data = snap.data() as Record<string, unknown>;
    const collectionUuid = await this.ensureDocumentUuid('collections', String(id), data);
    const collectionRecord = docToCollection(id, { ...data, uuid: collectionUuid });
    const folderRecords = await this.listFolders(id);
    const folders = exportFoldersWithParents(folderRecords);
    const folderNameById = new Map(folderRecords.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRecords.map((folder) => [folder.id, folder.uuid]));

    const requests = (await this.listRequests(id)).map((request) =>
      savedRequestToExportedRequest(
        request,
        request.folder_id != null ? (folderNameById.get(request.folder_id) ?? null) : null,
        request.folder_id != null ? (folderUuidById.get(request.folder_id) ?? null) : null
      )
    );

    const documents = (await this.listDocuments(id)).map((document) =>
      savedDocumentToExportedDocument(
        document,
        document.folder_id != null ? (folderNameById.get(document.folder_id) ?? null) : null,
        document.folder_id != null ? (folderUuidById.get(document.folder_id) ?? null) : null
      )
    );

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collectionRecord.uuid,
      name: collectionRecord.name,
      variables: maskVariablesForExport(collectionRecord.variables),
      headers: collectionRecord.headers,
      userAgent: collectionRecord.userAgent,
      auth: collectionRecord.auth,
      pre_request_script: collectionRecord.pre_request_script,
      post_request_script: collectionRecord.post_request_script,
      pre_request_scripts: collectionRecord.pre_request_scripts,
      post_request_scripts: collectionRecord.post_request_scripts,
      marker: collectionRecord.marker ?? null,
      folders,
      requests,
      documents
    };
  }

  /**
   * Imports a collection and its requests from export data.
   *
   * @param data - Parsed collection export payload.
   * @returns The newly created collection.
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const id = await this.nextId('collections');
    const now = new Date().toISOString();
    const firestore = this.getFirestore();
    const folders = sortExportedFoldersParentFirst(exportData.folders ?? []);

    const collectionScripts = serializeImportedCollectionScriptFields(exportData);
    const collectionData = {
      id,
      uuid: resolveImportedCollectionUuid(exportData),
      name: exportData.name,
      variables: exportData.variables,
      headers: exportData.headers,
      userAgent: typeof exportData.userAgent === 'string' ? exportData.userAgent : '',
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: collectionScripts.pre_request_scripts_json,
      post_request_scripts: collectionScripts.post_request_scripts_json,
      created_at: now,
      marker: serializeSidebarMarker(exportData.marker)
    };

    const folderIds = await this.allocateIds('folders', folders.length);
    const requestIds = await this.allocateIds('requests', exportData.requests.length);
    const documentIds = await this.allocateIds('documents', exportData.documents?.length ?? 0);

    const folderMaps = createEmptyFolderImportMaps();
    const writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
      { ref: doc(firestore, 'collections', String(id)), data: collectionData }
    ];

    folders.forEach((folder, index) => {
      const folderId = folderIds[index];
      const folderUuid = resolveImportedFolderUuid(folder);
      const folderFields = serializeImportedFolderFields(folder);
      const parentFolderId = resolveImportParentFolderId(
        folder.parent_folder_uuid,
        folderMaps.folderIdByUuid
      );
      registerImportedFolderInMaps(folderMaps, folderId, folder.name, folderUuid, parentFolderId);
      writes.push({
        ref: doc(firestore, 'folders', String(folderId)),
        data: {
          id: folderId,
          uuid: folderUuid,
          collection_id: id,
          parent_folder_id: parentFolderId,
          name: folder.name,
          sort_order: folder.sort_order,
          variables: folder.variables ?? [],
          headers: folder.headers ?? [],
          userAgent: folderFields.userAgent,
          auth: folder.auth ?? defaultAuth(),
          pre_request_script: folderFields.pre_request_script,
          post_request_script: folderFields.post_request_script,
          pre_request_scripts: folderFields.pre_request_scripts_json,
          post_request_scripts: folderFields.post_request_scripts_json,
          created_at: now,
          marker: folderFields.marker
        }
      });
    });

    exportData.requests.forEach((request, index) => {
      const requestId = requestIds[index];
      const folderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedRequestFields(request);

      writes.push({
        ref: doc(firestore, 'requests', String(requestId)),
        data: {
          id: requestId,
          uuid: fields.uuid,
          collection_id: id,
          folder_id: folderId,
          name: fields.name,
          method: fields.method,
          protocol: fields.protocol,
          url: fields.url,
          headers: request.headers,
          userAgent: fields.userAgent,
          params: request.params,
          auth: request.auth ?? defaultAuth(),
          body: fields.body,
          body_type: fields.body_type,
          body_raw: fields.body_raw,
          body_raw_open: fields.body_raw_open,
          pre_request_script: fields.pre_request_script,
          post_request_script: fields.post_request_script,
          pre_request_scripts: fields.pre_request_scripts_json,
          post_request_scripts: fields.post_request_scripts_json,
          comment: fields.comment,
          tags: fields.tags,
          sort_order: fields.sort_order,
          created_at: now,
          updated_at: now,
          marker: fields.marker
        }
      });
    });

    (exportData.documents ?? []).forEach((document, index) => {
      const documentId = documentIds[index];
      const folderId = resolveImportFolderId(
        document.folder_uuid,
        document.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedDocumentFields(document);

      writes.push({
        ref: doc(firestore, 'documents', String(documentId)),
        data: {
          id: documentId,
          uuid: fields.uuid,
          collection_id: id,
          folder_id: folderId,
          name: fields.name,
          content: fields.content,
          sort_order: fields.sort_order,
          created_at: now,
          updated_at: now,
          marker: fields.marker
        }
      });
    });

    await this.commitBatchedSets(firestore, writes);

    return docToCollection(id, collectionData);
  }

  /**
   * Looks up a collection by portable uuid within this Firestore store.
   *
   * @param uuid - Stable collection identifier.
   * @returns The collection when found, otherwise null.
   */
  async findCollectionByUuid(uuid: string): Promise<Collection | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const firestore = this.getFirestore();
    const snap = await getDocs(
      query(collection(firestore, 'collections'), where('uuid', '==', trimmed))
    );

    const document = snap.docs[0];
    if (!document) {
      return null;
    }

    const data = document.data() as Record<string, unknown>;
    return docToCollection(Number(document.id), { ...data, uuid: trimmed });
  }

  /**
   * Looks up a request by uuid within a collection in this Firestore store.
   *
   * @param collectionId - Provider-local collection id.
   * @param uuid - Stable request identifier.
   * @returns The request when found, otherwise null.
   */
  async findRequestByUuid(collectionId: number, uuid: string): Promise<SavedRequest | null> {
    const trimmed = uuid.trim();
    if (!trimmed) {
      return null;
    }

    const firestore = this.getFirestore();
    const snap = await getDocs(
      query(
        collection(firestore, 'requests'),
        where('collection_id', '==', collectionId),
        where('uuid', '==', trimmed)
      )
    );

    const document = snap.docs[0];
    if (!document) {
      return null;
    }

    const data = document.data() as Record<string, unknown>;
    return docToRequest(Number(document.id), { ...data, uuid: trimmed });
  }

  /**
   * Updates an existing collection and upserts folders and requests from import data.
   *
   * @param id - Provider-local collection id to update.
   * @param data - Validated collection export payload.
   * @returns The updated collection.
   */
  async updateCollectionFromImport(id: number, data: CollectionExport): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const now = new Date().toISOString();
    const firestore = this.getFirestore();
    const collectionRef = doc(firestore, 'collections', String(id));
    const collectionSnap = await getDoc(collectionRef);
    if (!collectionSnap.exists()) {
      throw new Error('Collection not found');
    }

    const existingCollection = collectionSnap.data() as Record<string, unknown>;
    const collectionScripts = serializeImportedCollectionScriptFields(exportData);
    const importedUserAgent = typeof exportData.userAgent === 'string' ? exportData.userAgent : '';
    await updateDoc(collectionRef, {
      name: exportData.name,
      variables: exportData.variables,
      headers: exportData.headers,
      userAgent: importedUserAgent,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: collectionScripts.pre_request_scripts_json,
      post_request_scripts: collectionScripts.post_request_scripts_json,
      marker: serializeSidebarMarker(exportData.marker)
    });

    const existingFolders = await this.listFolders(id);
    const folderMaps = buildFolderImportMaps(existingFolders);

    for (const folder of sortExportedFoldersParentFirst(exportData.folders ?? [])) {
      const parentFolderId = resolveImportParentFolderId(
        folder.parent_folder_uuid,
        folderMaps.folderIdByUuid
      );
      const plan = planImportedFolderUpsert(folder, folderMaps, parentFolderId);
      if (plan.action === 'update') {
        const folderFields = serializeImportedFolderFields(folder);
        await updateDoc(doc(firestore, 'folders', String(plan.existingId)), {
          name: plan.name,
          parent_folder_id: parentFolderId,
          sort_order: plan.sort_order,
          variables: folder.variables ?? [],
          headers: folder.headers ?? [],
          userAgent: folderFields.userAgent,
          auth: folder.auth ?? defaultAuth(),
          pre_request_script: folderFields.pre_request_script,
          post_request_script: folderFields.post_request_script,
          pre_request_scripts: folderFields.pre_request_scripts_json,
          post_request_scripts: folderFields.post_request_scripts_json,
          marker: folderFields.marker
        });
        registerImportedFolderInMaps(
          folderMaps,
          plan.existingId,
          plan.name,
          plan.uuid,
          parentFolderId
        );
        continue;
      }

      const folderId = await this.nextId('folders');
      const folderFields = serializeImportedFolderFields(folder);
      await setDoc(doc(firestore, 'folders', String(folderId)), {
        id: folderId,
        uuid: plan.uuid,
        collection_id: id,
        parent_folder_id: parentFolderId,
        name: plan.name,
        sort_order: plan.sort_order,
        variables: folder.variables ?? [],
        headers: folder.headers ?? [],
        userAgent: folderFields.userAgent,
        auth: folder.auth ?? defaultAuth(),
        pre_request_script: folderFields.pre_request_script,
        post_request_script: folderFields.post_request_script,
        pre_request_scripts: folderFields.pre_request_scripts_json,
        post_request_scripts: folderFields.post_request_scripts_json,
        created_at: now,
        marker: folderFields.marker
      });
      registerImportedFolderInMaps(folderMaps, folderId, plan.name, plan.uuid, parentFolderId);
    }

    const existingRequests = await this.listRequests(id);
    const requestUuidIndex = buildRequestUuidIndex(existingRequests);
    const requestFingerprints = buildRequestFingerprintIndexes(existingRequests);
    const existingDocuments = await this.listDocuments(id);
    const documentUuidIndex = buildDocumentUuidIndex(existingDocuments);

    for (const request of exportData.requests) {
      const importedFolderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedRequestFields(request);
      const existingRequestId = resolveImportRequestId(
        fields.uuid,
        importedFolderId,
        fields.method,
        fields.name,
        fields.url,
        requestUuidIndex,
        requestFingerprints
      );
      const folderId = resolveUpsertRequestFolderId(
        importedFolderId,
        existingRequestId != null
          ? requestFingerprints.folderIdByRequestId.get(existingRequestId)
          : undefined
      );

      if (existingRequestId != null) {
        await updateDoc(doc(firestore, 'requests', String(existingRequestId)), {
          folder_id: folderId,
          name: fields.name,
          method: fields.method,
          protocol: fields.protocol,
          url: fields.url,
          headers: request.headers,
          userAgent: fields.userAgent,
          params: request.params,
          auth: request.auth ?? defaultAuth(),
          body: fields.body,
          body_type: fields.body_type,
          body_raw: fields.body_raw,
          body_raw_open: fields.body_raw_open,
          pre_request_script: fields.pre_request_script,
          post_request_script: fields.post_request_script,
          pre_request_scripts: fields.pre_request_scripts_json,
          post_request_scripts: fields.post_request_scripts_json,
          comment: fields.comment,
          tags: fields.tags,
          sort_order: fields.sort_order,
          updated_at: now,
          marker: fields.marker
        });
        continue;
      }

      const requestId = await this.nextId('requests');
      await setDoc(doc(firestore, 'requests', String(requestId)), {
        id: requestId,
        uuid: fields.uuid,
        collection_id: id,
        folder_id: folderId,
        name: fields.name,
        method: fields.method,
        protocol: fields.protocol,
        url: fields.url,
        headers: request.headers,
        userAgent: fields.userAgent,
        params: request.params,
        auth: request.auth ?? defaultAuth(),
        body: fields.body,
        body_type: fields.body_type,
        body_raw: fields.body_raw,
        body_raw_open: fields.body_raw_open,
        pre_request_script: fields.pre_request_script,
        post_request_script: fields.post_request_script,
        pre_request_scripts: fields.pre_request_scripts_json,
        post_request_scripts: fields.post_request_scripts_json,
        comment: fields.comment,
        tags: fields.tags,
        sort_order: fields.sort_order,
        created_at: now,
        updated_at: now,
        marker: fields.marker
      });
    }

    for (const document of exportData.documents ?? []) {
      const folderId = resolveImportFolderId(
        document.folder_uuid,
        document.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedDocumentFields(document);
      const existingDocumentId = fields.uuid ? documentUuidIndex.get(fields.uuid) : undefined;

      if (existingDocumentId != null) {
        await updateDoc(doc(firestore, 'documents', String(existingDocumentId)), {
          folder_id: folderId,
          name: fields.name,
          content: fields.content,
          sort_order: fields.sort_order,
          updated_at: now,
          marker: fields.marker
        });
        continue;
      }

      const documentId = await this.nextId('documents');
      await setDoc(doc(firestore, 'documents', String(documentId)), {
        id: documentId,
        uuid: fields.uuid,
        collection_id: id,
        folder_id: folderId,
        name: fields.name,
        content: fields.content,
        sort_order: fields.sort_order,
        created_at: now,
        updated_at: now,
        marker: fields.marker
      });
    }

    const collectionUuid =
      typeof existingCollection.uuid === 'string' && existingCollection.uuid.trim()
        ? existingCollection.uuid
        : await this.ensureDocumentUuid('collections', String(id), existingCollection);

    return docToCollection(id, {
      ...existingCollection,
      uuid: collectionUuid,
      name: exportData.name,
      variables: exportData.variables,
      headers: exportData.headers,
      userAgent: importedUserAgent,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: collectionScripts.pre_request_script,
      post_request_script: collectionScripts.post_request_script,
      pre_request_scripts: collectionScripts.pre_request_scripts_json,
      post_request_scripts: collectionScripts.post_request_scripts_json,
      marker: serializeSidebarMarker(exportData.marker)
    });
  }

  /**
   * Reads a persisted setting by key.
   *
   * @param key - Setting key to look up.
   * @returns The stored value, or undefined when not set.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const snap = await getDoc(doc(this.getFirestore(), 'settings', key));
    if (!snap.exists()) return undefined;
    const value = snap.data().value;
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Persists a setting value, replacing any existing entry for the key.
   *
   * @param key - Setting key to store.
   * @param value - Value to persist.
   */
  async setSetting(key: string, value: string): Promise<void> {
    await setDoc(doc(this.getFirestore(), 'settings', key), { value });
  }

  /**
   * Git-backed providers return status; Firestore is not source-controlled.
   */
  async getSourceControlStatus(): Promise<null> {
    return null;
  }

  /**
   * Closes the database connection.
   */
  async close(): Promise<void> {
    this.#idBlocks.clear();
    if (this.#firestore) {
      await terminate(this.#firestore);
      this.#firestore = null;
    }
    if (this.#app) {
      await deleteApp(this.#app);
      this.#app = null;
    }
  }
}
