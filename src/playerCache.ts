const TTL = 2 * 60 * 1000
const LIMIT = 40
const PREFIX = 'insight-player-cache:'
type Entry = { expires: number; data: unknown }
const memory = new Map<string, Entry>()
const pending = new Map<string, Promise<unknown>>()

export function playerCacheKey(kind: 'profile' | 'heroes' | 'matches' | 'teammates', id: string, options = '') {
  return `${kind}:${id}:${options}`
}

export function readPlayerCache<T>(key: string): T | undefined {
  let entry = memory.get(key)
  if (!entry) {
    try {
      const raw = sessionStorage.getItem(PREFIX + key)
      if (raw) entry = JSON.parse(raw) as Entry
    } catch { /* Cache is optional when storage is blocked. */ }
  }
  if (!entry) return undefined
  if (typeof entry.expires !== 'number' || entry.expires <= Date.now()) {
    memory.delete(key)
    try { sessionStorage.removeItem(PREFIX + key) } catch { /* Storage may be unavailable. */ }
    return undefined
  }
  memory.delete(key)
  memory.set(key, entry)
  return entry.data as T
}

export function cachedPlayerRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = readPlayerCache<T>(key)
  if (cached !== undefined) return Promise.resolve(cached)
  const existing = pending.get(key)
  if (existing) return existing as Promise<T>
  const request = load().then(data => {
    if (data !== undefined) {
      const entry: Entry = { expires: Date.now() + TTL, data }
      memory.delete(key)
      memory.set(key, entry)
      if (memory.size > LIMIT) {
        const oldest = memory.keys().next().value!
        memory.delete(oldest)
        try { sessionStorage.removeItem(PREFIX + oldest) } catch { /* Storage may be unavailable. */ }
      }
      try { sessionStorage.setItem(PREFIX + key, JSON.stringify(entry)) } catch { /* Memory cache still works. */ }
    }
    return data
  }).finally(() => { pending.delete(key) })
  pending.set(key, request)
  return request
}
