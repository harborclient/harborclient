import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  collection,
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
import type { IDatabase } from '#/main/db/IDatabase';
import type {
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

export class FirestoreDatabase implements IDatabase {
  readonly #settings: FirestoreSettings;
  #app: FirebaseApp | null = null;
  #firestore: Firestore | null = null;

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
   * Allocates the next numeric ID for a named counter.
   *
   * @param counterName - Counter document name.
   */
  private async nextId(counterName: string): Promise<number> {
    const firestore = this.getFirestore();
    const counterRef = doc(firestore, 'counters', counterName);

    return runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? Number(snap.data().value ?? 0) : 0;
      const next = current + 1;
      transaction.set(counterRef, { value: next });
      return next;
    });
  }

  async init(): Promise<void> {
    if (this.#firestore) return;

    const { apiKey, authDomain, projectId, appId, email, password } = this.#settings;
    if (!apiKey || !authDomain || !projectId || !appId || !email || !password) {
      throw new Error('Firestore settings are incomplete');
    }

    this.#app = initializeApp({ apiKey, authDomain, projectId, appId });
    const auth = getAuth(this.#app);
    await signInWithEmailAndPassword(auth, email, password);
    this.#firestore = initializeFirestore(this.#app, { experimentalForceLongPolling: true });
  }

  async listCollections(): Promise<Collection[]> {
    const snap = await getDocs(
      query(collection(this.getFirestore(), 'collections'), orderBy('name'))
    );
    return snap.docs.map((document) =>
      docToCollection(Number(document.id), document.data() as Record<string, unknown>)
    );
  }

  async createCollection(name: string): Promise<Collection> {
    const id = await this.nextId('collections');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      name: name.trim(),
      variables: [] as Variable[],
      headers: [] as KeyValue[],
      pre_request_script: '',
      post_request_script: '',
      created_at: createdAt
    };

    await setDoc(doc(this.getFirestore(), 'collections', String(id)), data);
    return docToCollection(id, data);
  }

  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string
  ): Promise<Collection> {
    const ref = doc(this.getFirestore(), 'collections', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Collection not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, {
      name: name.trim(),
      variables,
      headers,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript
    });

    return docToCollection(id, {
      ...existing,
      name: name.trim(),
      variables,
      headers,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript
    });
  }

  async deleteCollection(id: number): Promise<void> {
    const firestore = this.getFirestore();
    const requestsSnap = await getDocs(
      query(collection(firestore, 'requests'), where('collection_id', '==', id))
    );
    const foldersSnap = await getDocs(
      query(collection(firestore, 'folders'), where('collection_id', '==', id))
    );

    const batch = writeBatch(firestore);
    for (const requestDoc of requestsSnap.docs) {
      batch.delete(requestDoc.ref);
    }
    for (const folderDoc of foldersSnap.docs) {
      batch.delete(folderDoc.ref);
    }
    batch.delete(doc(firestore, 'collections', String(id)));
    await batch.commit();
  }

  async listEnvironments(): Promise<Environment[]> {
    const snap = await getDocs(
      query(collection(this.getFirestore(), 'environments'), orderBy('name'))
    );
    return snap.docs.map((document) =>
      docToEnvironment(Number(document.id), document.data() as Record<string, unknown>)
    );
  }

  async createEnvironment(name: string): Promise<Environment> {
    const id = await this.nextId('environments');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      name: name.trim(),
      variables: [] as Variable[],
      created_at: createdAt
    };

    await setDoc(doc(this.getFirestore(), 'environments', String(id)), data);
    return docToEnvironment(id, data);
  }

  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const ref = doc(this.getFirestore(), 'environments', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Environment not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, {
      name: name.trim(),
      variables
    });

    return docToEnvironment(id, {
      ...existing,
      name: name.trim(),
      variables
    });
  }

  async deleteEnvironment(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'environments', String(id)));
  }

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

  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const preRequestScript = input.pre_request_script ?? '';
    const postRequestScript = input.post_request_script ?? '';
    const comment = input.comment ?? '';
    const now = new Date().toISOString();
    const firestore = this.getFirestore();

    if (input.id) {
      const ref = doc(firestore, 'requests', String(input.id));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = snap.data() as Record<string, unknown>;
        const data = {
          ...existing,
          collection_id: input.collection_id,
          folder_id: input.folder_id ?? null,
          name: input.name.trim(),
          method: input.method,
          url: input.url,
          headers: input.headers,
          params: input.params,
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

    const folderId = input.folder_id ?? null;
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
      name: input.name.trim(),
      method: input.method,
      url: input.url,
      headers: input.headers,
      params: input.params,
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

  async deleteRequest(id: number): Promise<void> {
    await deleteDoc(doc(this.getFirestore(), 'requests', String(id)));
  }

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

  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const existing = await this.listFolders(collectionId);
    const maxOrder = existing.reduce((max, folder) => Math.max(max, folder.sort_order), -1);
    const id = await this.nextId('folders');
    const createdAt = new Date().toISOString();
    const data = {
      id,
      collection_id: collectionId,
      name: name.trim(),
      sort_order: maxOrder + 1,
      created_at: createdAt
    };

    await setDoc(doc(this.getFirestore(), 'folders', String(id)), data);
    return docToFolder(id, data);
  }

  async renameFolder(id: number, name: string): Promise<Folder> {
    const ref = doc(this.getFirestore(), 'folders', String(id));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Folder not found');

    const existing = snap.data() as Record<string, unknown>;
    await updateDoc(ref, { name: name.trim() });
    return docToFolder(id, { ...existing, name: name.trim() });
  }

  async deleteFolder(id: number): Promise<void> {
    const firestore = this.getFirestore();
    const requestsSnap = await getDocs(
      query(collection(firestore, 'requests'), where('folder_id', '==', id))
    );

    const batch = writeBatch(firestore);
    for (const requestDoc of requestsSnap.docs) {
      batch.delete(requestDoc.ref);
    }
    batch.delete(doc(firestore, 'folders', String(id)));
    await batch.commit();
  }

  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
    const firestore = this.getFirestore();
    const batch = writeBatch(firestore);
    orderedFolderIds.forEach((folderId, index) => {
      batch.update(doc(firestore, 'folders', String(folderId)), {
        sort_order: index,
        collection_id: collectionId
      });
    });
    await batch.commit();
  }

  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const firestore = this.getFirestore();
    const batch = writeBatch(firestore);
    orderedRequestIds.forEach((requestId, index) => {
      batch.update(doc(firestore, 'requests', String(requestId)), {
        sort_order: index,
        folder_id: folderId,
        collection_id: collectionId
      });
    });
    await batch.commit();
  }

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

    const listInContainer = async (targetFolderId: number | null): Promise<number[]> => {
      const all = await this.listRequests(collectionId);
      return all
        .filter(
          (item) =>
            (targetFolderId == null && item.folder_id == null) || item.folder_id === targetFolderId
        )
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .map((item) => item.id);
    };

    const reindexContainer = async (
      targetFolderId: number | null,
      orderedIds: number[]
    ): Promise<void> => {
      const batch = writeBatch(firestore);
      orderedIds.forEach((id, sortIndex) => {
        batch.update(doc(firestore, 'requests', String(id)), {
          sort_order: sortIndex,
          folder_id: targetFolderId
        });
      });
      await batch.commit();
    };

    if (oldFolderId === folderId) {
      const siblings = (await listInContainer(folderId)).filter((id) => id !== requestId);
      siblings.splice(index, 0, requestId);
      await reindexContainer(folderId, siblings);
      return;
    }

    const oldIds = (await listInContainer(oldFolderId)).filter((id) => id !== requestId);
    await reindexContainer(oldFolderId, oldIds);

    const newIds = (await listInContainer(folderId)).filter((id) => id !== requestId);
    newIds.splice(index, 0, requestId);
    await reindexContainer(folderId, newIds);
  }

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
      formatVersion: 2,
      name: collectionRecord.name,
      variables: maskVariablesForExport(collectionRecord.variables),
      headers: collectionRecord.headers,
      pre_request_script: collectionRecord.pre_request_script,
      post_request_script: collectionRecord.post_request_script,
      folders,
      requests
    };
  }

  async importCollectionData(data: unknown): Promise<Collection> {
    const exportData = validateCollectionExport(data);
    const id = await this.nextId('collections');
    const now = new Date().toISOString();
    const firestore = this.getFirestore();

    const collectionData = {
      id,
      name: exportData.name,
      variables: exportData.variables,
      headers: exportData.headers,
      pre_request_script: exportData.pre_request_script,
      post_request_script: exportData.post_request_script,
      created_at: now
    };

    await setDoc(doc(firestore, 'collections', String(id)), collectionData);

    const folderIdByName = new Map<string, number>();
    for (const folder of exportData.folders ?? []) {
      const folderId = await this.nextId('folders');
      await setDoc(doc(firestore, 'folders', String(folderId)), {
        id: folderId,
        collection_id: id,
        name: folder.name,
        sort_order: folder.sort_order,
        created_at: now
      });
      folderIdByName.set(folder.name, folderId);
    }

    for (const request of exportData.requests) {
      const requestId = await this.nextId('requests');
      const folderName = request.folder_name ?? null;
      const folderId =
        folderName != null && folderName.trim() ? (folderIdByName.get(folderName) ?? null) : null;

      await setDoc(doc(firestore, 'requests', String(requestId)), {
        id: requestId,
        collection_id: id,
        folder_id: folderId,
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        body: request.body,
        body_type: request.body_type,
        pre_request_script: request.pre_request_script,
        post_request_script: request.post_request_script,
        comment: request.comment,
        sort_order: request.sort_order,
        created_at: now,
        updated_at: now
      });
    }

    return docToCollection(id, collectionData);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const snap = await getDoc(doc(this.getFirestore(), 'settings', key));
    if (!snap.exists()) return undefined;
    const value = snap.data().value;
    return typeof value === 'string' ? value : undefined;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await setDoc(doc(this.getFirestore(), 'settings', key), { value });
  }

  async close(): Promise<void> {
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
