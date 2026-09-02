import { get, set, del } from 'idb-keyval';
import { Persister } from '@tanstack/react-query-persist-client';

/**
 * Creates an IndexedDB persister for React Query using idb-keyval.
 * Enables zero-latency UI by surviving reloads and providing offline persistence.
 */
export const createIDBPersister = (idbValidKey: IDBValidKey = 'kinetix-query-cache') => {
  return {
    persistClient: async (client: any) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  } as Persister;
};
