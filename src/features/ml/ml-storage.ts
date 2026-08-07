import { load } from '@tauri-apps/plugin-store'
import { getSetting, saveSetting } from '@/services/settings'
import { isTauri } from '@/services/twitch'
import type { TrainedModelMeta } from './ml-forecast'

const LS_KEY = 'neuragest-ml-forecast-models'
const SUPABASE_KEY = 'ml_forecast_models'
const IDB_NAME = 'neuragest-ml'
const IDB_STORE = 'models'
const TAURI_STORE_FILE = 'ml-models.json'

export type ModelStoreBackend = 'tauri' | 'indexeddb' | 'supabase' | 'localStorage'

let lastBackend: ModelStoreBackend = 'localStorage'

export function getLastModelStoreBackend(): ModelStoreBackend {
  return lastBackend
}

function readLocalStorage(): Record<string, TrainedModelMeta> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) as Record<string, TrainedModelMeta> : {}
  } catch {
    return {}
  }
}

function writeLocalStorage(models: Record<string, TrainedModelMeta>) {
  localStorage.setItem(LS_KEY, JSON.stringify(models))
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB error'))
  })
}

async function readIndexedDb(): Promise<Record<string, TrainedModelMeta> | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await openIdb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const store = tx.objectStore(IDB_STORE)
      const req = store.get('models')
      req.onsuccess = () => {
        resolve((req.result as Record<string, TrainedModelMeta> | undefined) ?? {})
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function writeIndexedDb(models: Record<string, TrainedModelMeta>): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false
  try {
    const db = await openIdb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(models, 'models')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}

async function readTauriStore(): Promise<Record<string, TrainedModelMeta> | null> {
  if (!isTauri) return null
  try {
    const store = await load(TAURI_STORE_FILE, { autoSave: false })
    const models = await store.get<Record<string, TrainedModelMeta>>('models')
    return models ?? {}
  } catch {
    return null
  }
}

async function writeTauriStore(models: Record<string, TrainedModelMeta>): Promise<boolean> {
  if (!isTauri) return false
  try {
    const store = await load(TAURI_STORE_FILE, { autoSave: true })
    await store.set('models', models)
    await store.save()
    return true
  } catch {
    return false
  }
}

async function readSupabase(): Promise<Record<string, TrainedModelMeta> | null> {
  try {
    const data = await getSetting<{ models?: Record<string, TrainedModelMeta> }>(SUPABASE_KEY, {})
    return data.models ?? {}
  } catch {
    return null
  }
}

async function writeSupabase(models: Record<string, TrainedModelMeta>): Promise<boolean> {
  try {
    return saveSetting(SUPABASE_KEY, { models })
  } catch {
    return false
  }
}

/** Lectura síncrona desde localStorage (fallback UI inicial). */
export function getStoredModelsSync(): Record<string, TrainedModelMeta> {
  return readLocalStorage()
}

/** Carga modelos desde el backend persistente más adecuado. */
export async function loadStoredModels(): Promise<Record<string, TrainedModelMeta>> {
  const tauri = await readTauriStore()
  if (tauri && Object.keys(tauri).length > 0) {
    lastBackend = 'tauri'
    writeLocalStorage(tauri)
    return tauri
  }

  const idb = await readIndexedDb()
  if (idb && Object.keys(idb).length > 0) {
    lastBackend = 'indexeddb'
    writeLocalStorage(idb)
    return idb
  }

  const remote = await readSupabase()
  if (remote && Object.keys(remote).length > 0) {
    lastBackend = 'supabase'
    writeLocalStorage(remote)
    return remote
  }

  lastBackend = 'localStorage'
  return readLocalStorage()
}

/** Persiste modelos en Tauri → IndexedDB → Supabase → localStorage. */
export async function saveStoredModels(models: Record<string, TrainedModelMeta>): Promise<void> {
  writeLocalStorage(models)

  if (await writeTauriStore(models)) {
    lastBackend = 'tauri'
    return
  }
  if (await writeIndexedDb(models)) {
    lastBackend = 'indexeddb'
    void writeSupabase(models)
    return
  }
  if (await writeSupabase(models)) {
    lastBackend = 'supabase'
    return
  }
  lastBackend = 'localStorage'
}

export async function clearStoredModels(): Promise<void> {
  writeLocalStorage({})
  if (isTauri) {
    try {
      const store = await load(TAURI_STORE_FILE, { autoSave: true })
      await store.delete('models')
      await store.save()
    } catch { /* ignore */ }
  }
  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await openIdb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite')
        tx.objectStore(IDB_STORE).delete('models')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch { /* ignore */ }
  }
  void saveSetting(SUPABASE_KEY, { models: {} })
}
