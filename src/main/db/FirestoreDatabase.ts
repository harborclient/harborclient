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
import {
  maskVariablesForExport,
  normalizeVariable,
  validateCollectionExport
} from '#/main/db/collectionData';
import type { IDatabase } from '#/main/db/IDatabase';
import type {
  BodyType,
  Collection,
  CollectionExport,
  FirestoreSettings,
  HttpMethod,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';

/**
 * Maps a Firestore collection document to a Collection object.
 *
 * @param id - Numeric document ID.
 * @param data - Raw Firestore document fields.
 * @returns Normalized collection.
 */
function docToCollection(id: number, data: Record<string, unknown>): Collection {
  const variables = Array.isArray(data.variables)
    ? (data.variables as Partial<Variable>[]).map(normalizeVariable)
    : [];
  const headers = Array.isArray(data.headers) ? (data.headers as KeyValue[]) : [];

  return {
    id,
    name: typeof data.name === 'string' ? data.name : '',
    variables,
    headers,
    pre_request_script: typeof data.pre_request_script === 'string' ? data.pre_request_script : '',
    post_request_script:
      typeof data.post_request_script === 'string' ? data.post_request_script : '',
    created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString()
  };
}

/**
 * Maps a Firestore request document to a SavedRequest object.
 *
 * @param id - Numeric document ID.
 * @param data - Raw Firestore document fields.
 * @returns Normalized saved request.
 */
function docToRequest(id: number, data: Record<string, unknown>): SavedRequest {
  return {
    id,
    collection_id: typeof data.collection_id === 'number' ? data.collection_id : 0,
    name: typeof data.name === 'string' ? data.name : '',
    method: (typeof data.method === 'string' ? data.method : 'GET') as HttpMethod,
    url: typeof data.url === 'string' ? data.url : '',
    headers: Array.isArray(data.headers) ? (data.headers as KeyValue[]) : [],
    params: Array.isArray(data.params) ? (data.params as KeyValue[]) : [],
    body: typeof data.body === 'string' ? data.body : '',
    body_type: (typeof data.body_type === 'string' ? data.body_type : 'none') as BodyType,
    pre_request_script: typeof data.pre_request_script === 'string' ? data.pre_request_script : '',
    post_request_script:
      typeof data.post_request_script === 'string' ? data.post_request_script : '',
    sort_order: typeof data.sort_order === 'number' ? data.sort_order : 0,
    created_at: typeof data.created_at === 'string' ? data.created_at : new Date().toISOString(),
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : new Date().toISOString()
  };
}

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

    const batch = writeBatch(firestore);
    for (const requestDoc of requestsSnap.docs) {
      batch.delete(requestDoc.ref);
    }
    batch.delete(doc(firestore, 'collections', String(id)));
    await batch.commit();
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
          name: input.name.trim(),
          method: input.method,
          url: input.url,
          headers: input.headers,
          params: input.params,
          body: input.body,
          body_type: input.body_type,
          pre_request_script: preRequestScript,
          post_request_script: postRequestScript,
          updated_at: now
        };

        await updateDoc(ref, data);
        return docToRequest(input.id, data);
      }
    }

    const existingRequests = await this.listRequests(input.collection_id);
    const maxOrder = existingRequests.reduce(
      (max, request) => Math.max(max, request.sort_order),
      -1
    );
    const id = await this.nextId('requests');
    const createdAt = now;
    const data = {
      id,
      collection_id: input.collection_id,
      name: input.name.trim(),
      method: input.method,
      url: input.url,
      headers: input.headers,
      params: input.params,
      body: input.body,
      body_type: input.body_type,
      pre_request_script: preRequestScript,
      post_request_script: postRequestScript,
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

  async exportCollectionData(id: number): Promise<CollectionExport> {
    const snap = await getDoc(doc(this.getFirestore(), 'collections', String(id)));
    if (!snap.exists()) throw new Error('Collection not found');

    const data = snap.data() as Record<string, unknown>;
    const collectionRecord = docToCollection(id, data);
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
        sort_order
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
        sort_order
      })
    );

    return {
      formatVersion: 1,
      name: collectionRecord.name,
      variables: maskVariablesForExport(collectionRecord.variables),
      headers: collectionRecord.headers,
      pre_request_script: collectionRecord.pre_request_script,
      post_request_script: collectionRecord.post_request_script,
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

    for (const request of exportData.requests) {
      const requestId = await this.nextId('requests');
      await setDoc(doc(firestore, 'requests', String(requestId)), {
        id: requestId,
        collection_id: id,
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        body: request.body,
        body_type: request.body_type,
        pre_request_script: request.pre_request_script,
        post_request_script: request.post_request_script,
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
