type Entry = { path: string; value: unknown }
const CHUNK_LENGTH = 3500

function entries(value: unknown, path: string): Entry[] {
  if (JSON.stringify({ path, value }).length <= CHUNK_LENGTH) return [{ path, value }]
  if (Array.isArray(value)) return value.flatMap((item, index) => entries(item, `${path}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => entries(item, path ? `${path}.${key}` : key))
  if (typeof value === 'string') {
    const size = CHUNK_LENGTH - JSON.stringify(path).length - 100
    return Array.from({ length: Math.ceil(value.length / size) }, (_, index) => ({ path: `${path}（文本片段 ${index + 1}）`, value: value.slice(index * size, (index + 1) * size) }))
  }
  return [{ path, value }]
}

/** Preserve every sampled evidence field while keeping each model request small. */
export function evidenceChunks(evidence: unknown): string[] {
  const pieces = entries(evidence, '')
  const chunks: string[] = []
  let current: Entry[] = []
  for (const piece of pieces) {
    const next = JSON.stringify([...current, piece])
    if (next.length > CHUNK_LENGTH && current.length) {
      chunks.push(JSON.stringify(current))
      current = []
    }
    current.push(piece)
  }
  if (current.length) chunks.push(JSON.stringify(current))
  return chunks
}
