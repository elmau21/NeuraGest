import type { SupportedStorage } from '@supabase/supabase-js'
import { load, type Store } from '@tauri-apps/plugin-store'
import { isTauri } from '@/services/twitch'

/**
 * Persistencia de sesión Supabase independiente del origin del webview.
 *
 * En release Tauri la UI se sirve en `http://127.0.0.1:<puerto>` y el puerto
 * puede cambiar en cada arranque. localStorage/IndexedDB van por origin, así
 * que la sesión se perdía al reabrir. plugin-store escribe en AppData.
 */
const TAURI_STORE_FILE = 'supabase-auth.json'

const memory = new Map<string, string>()
let storePromise: Promise<Store> | null = null

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

function removeLocal(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

async function getStore(): Promise<Store | null> {
  if (!isTauri) return null
  if (!storePromise) {
    storePromise = load(TAURI_STORE_FILE, { autoSave: true }).catch((error) => {
      storePromise = null
      throw error
    })
  }
  try {
    return await storePromise
  } catch {
    return null
  }
}

export function createSupabaseAuthStorage(): SupportedStorage {
  return {
    getItem: async (key: string) => {
      if (memory.has(key)) return memory.get(key)!

      const store = await getStore()
      if (store) {
        try {
          const fromDisk = await store.get<string>(key)
          if (typeof fromDisk === 'string') {
            memory.set(key, fromDisk)
            writeLocal(key, fromDisk)
            return fromDisk
          }
        } catch {
          /* fallback below */
        }
      }

      const fromLocal = readLocal(key)
      if (fromLocal != null) {
        memory.set(key, fromLocal)
        // Migra sesión del origin actual hacia AppData (p. ej. tras update).
        if (store) {
          try {
            await store.set(key, fromLocal)
            await store.save()
          } catch {
            /* ignore */
          }
        }
      }
      return fromLocal
    },

    setItem: async (key: string, value: string) => {
      memory.set(key, value)
      writeLocal(key, value)
      const store = await getStore()
      if (!store) return
      try {
        await store.set(key, value)
        await store.save()
      } catch {
        /* localStorage ya tiene copia de esta sesión */
      }
    },

    removeItem: async (key: string) => {
      memory.delete(key)
      removeLocal(key)
      const store = await getStore()
      if (!store) return
      try {
        await store.delete(key)
        await store.save()
      } catch {
        /* ignore */
      }
    },
  }
}

/** Solo tests: vacía caché en memoria. */
export function resetSupabaseAuthStorageMemoryForTests() {
  memory.clear()
  storePromise = null
}
