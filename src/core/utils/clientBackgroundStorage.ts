export interface LocalClientBackgroundRecord {
  clientKey: string
  blob: Blob
  fileName: string
  mimeType: string
  size: number
  overlayOpacity: number
  updatedAt: string
}

const DATABASE_NAME = 'dhole.local-appearance'
const DATABASE_VERSION = 1
const STORE_NAME = 'client-backgrounds'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'clientKey' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
  })
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = action(transaction.objectStore(STORE_NAME))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () =>
        reject(request.error ?? new Error('No se pudo completar la operación local.'))
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('La operación local fue cancelada.'))
    })
  } finally {
    database.close()
  }
}

export const ClientBackgroundStorage = {
  async get(clientKey: string): Promise<LocalClientBackgroundRecord | null> {
    const record = await runRequest<LocalClientBackgroundRecord | undefined>('readonly', (store) =>
      store.get(clientKey),
    )

    return record ?? null
  },

  async save(record: LocalClientBackgroundRecord): Promise<void> {
    await runRequest<IDBValidKey>('readwrite', (store) => store.put(record))
  },

  async remove(clientKey: string): Promise<void> {
    await runRequest<undefined>('readwrite', (store) => store.delete(clientKey))
  },
}
