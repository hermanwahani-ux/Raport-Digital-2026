const DB_NAME = 'WaliKuIndexedDB';
const STORE_NAME = 'pdf_reports';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB instance.
 */
export function initIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Saves a PDF base64 payload to IndexedDB under the specified report ID.
 */
export async function savePDFToIndexedDB(id: string, fileData: string): Promise<void> {
  if (!id || !fileData) return;
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(fileData, id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to save PDF to IndexedDB:', error);
  }
}

/**
 * Retrieves a PDF base64 payload from IndexedDB by report ID.
 */
export async function getPDFFromIndexedDB(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  } catch (error) {
    console.error('Failed to get PDF from IndexedDB:', error);
    return null;
  }
}

/**
 * Deletes a PDF record from IndexedDB by report ID.
 */
export async function deletePDFFromIndexedDB(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to delete PDF from IndexedDB:', error);
  }
}

/**
 * Clears all PDF records from IndexedDB storage.
 */
export async function clearAllPDFsFromIndexedDB(): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Failed to clear IndexedDB:', error);
  }
}
