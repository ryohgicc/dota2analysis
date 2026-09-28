const decode = (hex: string) => {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw Error('AI 任务密钥未配置')
  return Uint8Array.from(hex.match(/.{2}/g)!, byte => parseInt(byte, 16))
}
const key = (secret: string) => crypto.subtle.importKey('raw', decode(secret), 'AES-GCM', false, ['encrypt', 'decrypt'])
export async function encryptApiKey(apiKey: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret), new TextEncoder().encode(apiKey)))
  return { iv: Array.from(iv), cipher: Array.from(cipher) }
}
export async function decryptApiKey(payload: { iv: number[]; cipher: number[] }, secret: string) {
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(payload.iv) }, await key(secret), new Uint8Array(payload.cipher)))
}
