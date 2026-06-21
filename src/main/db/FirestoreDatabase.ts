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
import { maskVariablesForExport, validateCollectionExport } from '#/main/db/collectionData';
import {
  docToCollection,
  docToEnvironment,
  docToFolder,
  docToRequest
} from '#/main/db/entityMappers';
import { trimRequiredName } from '#/main/db/trimRequiredName';
import { defaultAuth } from '#/shared/auth';
import type { IDatabase } from '#/main/db/IDatabase';
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
  Variable
} from '#/shared/types';

/**
 * Maximum writes per Firestore batch commit.
 */
const WRITE_BATCH_LIMIT = 500;

/**
 * IDs reserved per counter transaction when dispensing via {@link FirestoreDatabase.nextId}.
 */
const ID_BLOCK_SIZE = 50;

export class FirestoreDatabase implements IDatabase {
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
    const snap = await getDocs(
      query(collection(this.getFirestore(), 'collections'), orderBy('name'))
    );
    return snap.docs.map((document) =>
      docToCollection(Number(document.id), document.data() as Record<string, unknown>)
    );
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
      name: trimmedName,
      variables: [] as Variable[],
      headers: [] as KeyValue[],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
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
    auth: AuthConfig
  ): Promise<Collection> {
    const trimmedName = trimRequiredName(name, 'Collection name');
    const ref = doc(this.getFirestore(), 'collections', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Collection not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, {
      name: trimmedName,
      variables,
      headers,
      auth,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript
    });

    return docToCollection(id, {
      ...existing,
      name: trimmedName,
      variables,
      headers,
      auth,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript
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
    const snap = await getDocs(
      query(collection(this.getFirestore(), 'environments'), orderBy('name'))
    );
    return snap.docs.map((document) =>
      docToEnvironment(Number(document.id), document.data() as Record<string, unknown>)
    );
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
    const snap = await getDocs(
      query(collection(this.getFirestore(), 'requests'), where('collection_id', '==', collectionId))
    );

    return snap.docs
      .map((document) =>
        docToRequest(Number(document.id), document.data() as Record<string, unknown>)
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }

  /**
   * Inserts a new request or updates an existing one.
   *
   * @param input - Request fields to persist.
   * @returns The saved request with ID and timestamps.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const trimmedName = trimRequiredName(input.name, 'Request name');
    const preRequestScript = input.pre_request_script ?? '';
    const postRequestScript = input.post_request_script ?? '';
    const comment = input.comment ?? '';
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
          comment,
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
      comment,
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
    const snap = await getDocs(
      query(collection(this.getFirestore(), 'folders'), where('collection_id', '==', collectionId))
    );

    return snap.docs
      .map((document) =>
        docToFolder(Number(document.id), document.data() as Record<string, unknown>)
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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
    const collectionRecord = docToCollection(id, data);
    const folderRecords = await this.listFolders(id);
    const folders = folderRecords.map(({ name, sort_order }) => ({ name, sort_order }));
    const folderNameById = new Map(folderRecords.map((folder) => [folder.id, folder.name]));

    const requests = (await this.listRequests(id)).map(
      ({
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
        sort_order,
        folder_id
      }) => ({
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
        sort_order,
        folder_name: folder_id != null ? (folderNameById.get(folder_id) ?? null) : null
      })
    );

    return {
      harborclientVersion: 2,
      harborclientExport: 'collection',
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

    const folderIdByName = new Map<string, number>();
    const writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [
      { ref: doc(firestore, 'collections', String(id)), data: collectionData }
    ];

    folders.forEach((folder, index) => {
      if (folderIdByName.has(folder.name)) {
        throw new Error(`Invalid collection file: duplicate folder name "${folder.name}"`);
      }
      const folderId = folderIds[index];
      folderIdByName.set(folder.name, folderId);
      writes.push({
        ref: doc(firestore, 'folders', String(folderId)),
        data: {
          id: folderId,
          collection_id: id,
          name: folder.name,
          sort_order: folder.sort_order,
          created_at: now
        }
      });
    });

    exportData.requests.forEach((request, index) => {
      const requestId = requestIds[index];
      const folderName = request.folder_name ?? null;
      const folderId =
        folderName != null && folderName.trim() ? (folderIdByName.get(folderName) ?? null) : null;

      writes.push({
        ref: doc(firestore, 'requests', String(requestId)),
        data: {
          id: requestId,
          collection_id: id,
          folder_id: folderId,
          name: request.name,
          method: request.method,
          url: request.url,
          headers: request.headers,
          params: request.params,
          auth: request.auth ?? defaultAuth(),
          body: request.body,
          body_type: request.body_type,
          pre_request_script: request.pre_request_script,
          post_request_script: request.post_request_script,
          comment: request.comment,
          sort_order: request.sort_order,
          created_at: now,
          updated_at: now
        }
      });
    });

    await this.commitBatchedSets(firestore, writes);

    return docToCollection(id, collectionData);
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
