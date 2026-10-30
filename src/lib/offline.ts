const DB_NAME = 'pos_offline';
const STORE_NAME = 'pending_transactions';

export interface PendingTransaction {
  id?: number;
  sale_number: string;
  cashier_id: string;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'mobile';
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    purchase_price: number;
    subtotal: number;
  }>;
  customer_id?: string | null;
  customer_name?: string;
  timestamp: number;
  synced: boolean;
}

export const initOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const saveOfflineTransaction = async (transaction: PendingTransaction) => {
  const db = await initOfflineDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add({ ...transaction, timestamp: Date.now(), synced: false });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
};

export const markTransactionSynced = async (id: number) => {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.synced = true;
        const updateRequest = store.put(data);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const getPendingTransactions = async () => {
  const db = await initOfflineDB();
  return new Promise<PendingTransaction[]>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteTransaction = async (id: number) => {
  const db = await initOfflineDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const isOnline = () => navigator.onLine;

export const onConnectionChange = (callback: (online: boolean) => void) => {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
};
