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
import { maskVariablesForExport, validateCollectionExport } from '#/main/storage/collectionData';
import {
  buildFolderImportMaps,
  buildRequestUuidIndex,
  planImportedFolderUpsert,
  registerImportedFolderInMaps,
  resolveImportFolderId,
  resolveImportedCollectionUuid,
  resolveImportedFolderUuid,
  serializeImportedRequestFields
} from '#/main/storage/collectionImport';
import {
  docToCollection,
  docToEnvironment,
  docToFolder,
  docToRequest
} from '#/main/storage/entityMappers';
import { bundleScriptFieldsWithLegacy } from '#/main/storage/scriptFields';
import { trimRequiredName } from '#/main/storage/trimRequiredName';
import { defaultAuth } from '#/shared/auth';
import type { IStorage } from '#/main/storage/IStorage';
import type {
  AuthConfig,
  Collection,
  CollectionExport,
  Environment,
  FirestoreSettings,
  Folder,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  ScriptRef,
  Variable
} from '#/shared/types';
import { generateDocumentUuid } from '#/main/storage/uuid';

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
    collectionName: 'collections' | 'requests' | 'environments' | 'folders',
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
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: '[]',
      post_request_scripts: '[]',
      created_at: createdAt
    };

    await setDoc(doc(this.getFirestore(), 'collections', String(id)), data);
    return docToCollection(id, data);
  }

  /**
   * Updates a collection's name, variables, headers, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
   * @returns The updated collection.
   */
  /**
   * Updates a collection's name, variables, headers, and scripts.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   * @param headers - Headers sent with every request in the collection.
   * @param preRequestScript - Script run before each request in the collection.
   * @param postRequestScript - Script run after each request in the collection.
   * @param auth - Default Authorization settings for requests in the collection.
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
      auth,
      pre_request_script: legacyPreScript,
      post_request_script: legacyPostScript,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json
    });
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

    const refs = [
      ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
      ...foldersSnap.docs.map((folderDoc) => folderDoc.ref),
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
  async createEnvironment(name: string): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const id = await this.nextId('environments');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      uuid: generateDocumentUuid(),
      name: trimmedName,
      variables: [] as Variable[],
      created_at: createdAt
    };

    await setDoc(doc(this.getFirestore(), 'environments', String(id)), data);
    return docToEnvironment(id, data);
  }

  /**
   * Updates an environment's name and variables.
   *
   * @param id - Environment ID to update.
   * @param name - New display name.
   * @param variables - Environment-scoped variables.
   * @returns The updated environment.
   */
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const trimmedName = trimRequiredName(name, 'Environment name');
    const ref = doc(this.getFirestore(), 'environments', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Environment not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, {
      name: trimmedName,
      variables
    });

    return docToEnvironment(id, {
      ...existing,
      name: trimmedName,
      variables
    });
  }

  /**
   * Deletes an environment.
   *
   * @param id - Environment ID to delete.
   */
  async deleteEnvironment(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'environments', String(id)));
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
    const now = new Date().toISOString();
    const firestore = this.getFirestore();
    const folderId = input.folder_id ?? null;

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
        const data = {
          ...existing,
          collection_id: input.collection_id,
          folder_id: input.folder_id ?? null,
          name: trimmedName,
          method: input.method,
          url: input.url,
          headers: input.headers,
          params: input.params,
          auth: input.auth,
          body: input.body,
          body_type: input.body_type,
          pre_request_script: preRequestScript,
          post_request_script: postRequestScript,
          pre_request_scripts: preScripts.json,
          post_request_scripts: postScripts.json,
          comment,
          tags,
          updated_at: now
        };

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
      url: input.url,
      headers: input.headers,
      params: input.params,
      auth: input.auth,
      body: input.body,
      body_type: input.body_type,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
      pre_request_scripts: preScripts.json,
      post_request_scripts: postScripts.json,
      comment,
      tags,
      sort_order: maxOrder + 1,
      created_at: createdAt,
      updated_at: now
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
   * @returns The newly created folder.
   */
  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const trimmedName = trimRequiredName(name, 'Folder name');
    const existing = await this.listFolders(collectionId);
    const maxOrder = existing.reduce((max, folder) => Math.max(max, folder.sort_order), -1);
    const id = await this.nextId('folders');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      uuid: generateDocumentUuid(),
      collection_id: collectionId,
      name: trimmedName,
      sort_order: maxOrder + 1,
      created_at: createdAt
    };

    await setDoc(doc(this.getFirestore(), 'folders', String(id)), data);
    return docToFolder(id, data);
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
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const firestore = this.getFirestore();
    const requestsSnap = await getDocs(
      query(collection(firestore, 'requests'), where('folder_id', '==', id))
    );

    const refs = [
      ...requestsSnap.docs.map((requestDoc) => requestDoc.ref),
      doc(firestore, 'folders', String(id))
    ];
    await this.commitBatchedDeletes(firestore, refs);
  }

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
    const firestore = this.getFirestore();
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
    const oldFolderId = request.folder_id;

    if (folderId != null) {
      const folderSnap = await getDoc(doc(firestore, 'folders', String(folderId)));
      if (!folderSnap.exists()) throw new Error('Folder not found');
      const folderData = folderSnap.data() as Record<string, unknown>;
      if (folderData.collection_id !== collectionId) throw new Error('Folder not found');
    }

    const allRequests = await this.listRequests(collectionId);

    const listInContainer = (targetFolderId: number | null): number[] =>
      allRequests
        .filter(
          (item) =>
            (targetFolderId == null && item.folder_id == null) || item.folder_id === targetFolderId
        )
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((item) => item.id);

    // Stage all source- and destination-container updates into a single batch so
    // the move commits atomically; a partial commit cannot leave duplicate or
    // gap-filled sort_order values across the two containers.
    const batch = writeBatch(firestore);
    const stageReindex = (targetFolderId: number | null, orderedIds: number[]): void => {
      orderedIds.forEach((id, sortIndex) => {
        batch.update(doc(firestore, 'requests', String(id)), {
          sort_order: sortIndex,
          folder_id: targetFolderId
        });
      });
    };

    if (oldFolderId === folderId) {
      const siblings = listInContainer(folderId).filter((id) => id !== requestId);
      siblings.splice(index, 0, requestId);
      stageReindex(folderId, siblings);
    } else {
      const oldIds = listInContainer(oldFolderId).filter((id) => id !== requestId);
      stageReindex(oldFolderId, oldIds);

      const newIds = listInContainer(folderId).filter((id) => id !== requestId);
      newIds.splice(index, 0, requestId);
      stageReindex(folderId, newIds);
    }

    await batch.commit();
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
    const folders = folderRecords.map(({ uuid, name, sort_order }) => ({
      uuid,
      name,
      sort_order
    }));
    const folderNameById = new Map(folderRecords.map((folder) => [folder.id, folder.name]));
    const folderUuidById = new Map(folderRecords.map((folder) => [folder.id, folder.uuid]));

    const requests = (await this.listRequests(id)).map(
      ({
        uuid,
        name,
        method,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        tags,
        sort_order,
        folder_id
      }) => ({
        uuid,
        name,
        method,
        url,
        headers,
        params,
        auth,
        body,
        body_type,
        pre_request_script,
        post_request_script,
        comment,
        tags,
        sort_order,
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null,
        folder_uuid: folder_id != null ? (folderUuidById.get(folder_id) ?? null) : null
      })
    );

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection',
      uuid: collectionRecord.uuid,
      name: collectionRecord.name,
      variables: maskVariablesForExport(collectionRecord.variables),
      headers: collectionRecord.headers,
      auth: collectionRecord.auth,
      pre_request_script: collectionRecord.pre_request_script,
      post_request_script: collectionRecord.post_request_script,
      folders,
      requests
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
    const folders = exportData.folders ?? [];

    const collectionData = {
      id,
      uuid: resolveImportedCollectionUuid(exportData),
      name: exportData.name,
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script,
      created_at: now
    };

    const folderIds = await this.allocateIds('folders', folders.length);
    const requestIds = await this.allocateIds('requests', exportData.requests.length);

    const folderMaps: ReturnType<typeof buildFolderImportMaps> = {
      folderIdByUuid: new Map(),
      folderIdByName: new Map(),
      folderUuidById: new Map()
    };
    const writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
      { ref: doc(firestore, 'collections', String(id)), data: collectionData }
    ];

    folders.forEach((folder, index) => {
      const folderId = folderIds[index];
      const folderUuid = resolveImportedFolderUuid(folder);
      registerImportedFolderInMaps(folderMaps, folderId, folder.name, folderUuid);
      writes.push({
        ref: doc(firestore, 'folders', String(folderId)),
        data: {
          id: folderId,
          uuid: folderUuid,
          collection_id: id,
          name: folder.name,
          sort_order: folder.sort_order,
          created_at: now
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
          url: fields.url,
          headers: request.headers,
          params: request.params,
          auth: request.auth ?? defaultAuth(),
          body: fields.body,
          body_type: fields.body_type,
          pre_request_script: fields.pre_request_script,
          post_request_script: fields.post_request_script,
          comment: fields.comment,
          tags: fields.tags,
          sort_order: fields.sort_order,
          created_at: now,
          updated_at: now
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
    await updateDoc(collectionRef, {
      name: exportData.name,
      variables: exportData.variables,
      headers: exportData.headers,
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script
    });

    const existingFolders = await this.listFolders(id);
    const folderMaps = buildFolderImportMaps(existingFolders);

    for (const folder of exportData.folders ?? []) {
      const plan = planImportedFolderUpsert(folder, folderMaps);
      if (plan.action === 'update') {
        await updateDoc(doc(firestore, 'folders', String(plan.existingId)), {
          name: plan.name,
          sort_order: plan.sort_order
        });
        registerImportedFolderInMaps(folderMaps, plan.existingId, plan.name, plan.uuid);
        continue;
      }

      const folderId = await this.nextId('folders');
      await setDoc(doc(firestore, 'folders', String(folderId)), {
        id: folderId,
        uuid: plan.uuid,
        collection_id: id,
        name: plan.name,
        sort_order: plan.sort_order,
        created_at: now
      });
      registerImportedFolderInMaps(folderMaps, folderId, plan.name, plan.uuid);
    }

    const existingRequests = await this.listRequests(id);
    const requestUuidIndex = buildRequestUuidIndex(existingRequests);

    for (const request of exportData.requests) {
      const folderId = resolveImportFolderId(
        request.folder_uuid,
        request.folder_name,
        folderMaps.folderIdByUuid,
        folderMaps.folderIdByName
      );
      const fields = serializeImportedRequestFields(request);
      const existingRequestId = fields.uuid ? requestUuidIndex.get(fields.uuid) : undefined;

      if (existingRequestId != null) {
        await updateDoc(doc(firestore, 'requests', String(existingRequestId)), {
          folder_id: folderId,
          name: fields.name,
          method: fields.method,
          url: fields.url,
          headers: request.headers,
          params: request.params,
          auth: request.auth ?? defaultAuth(),
          body: fields.body,
          body_type: fields.body_type,
          pre_request_script: fields.pre_request_script,
          post_request_script: fields.post_request_script,
          comment: fields.comment,
          tags: fields.tags,
          sort_order: fields.sort_order,
          updated_at: now
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
        url: fields.url,
        headers: request.headers,
        params: request.params,
        auth: request.auth ?? defaultAuth(),
        body: fields.body,
        body_type: fields.body_type,
        pre_request_script: fields.pre_request_script,
        post_request_script: fields.post_request_script,
        comment: fields.comment,
        tags: fields.tags,
        sort_order: fields.sort_order,
        created_at: now,
        updated_at: now
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
      auth: exportData.auth ?? defaultAuth(),
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script
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
