type AiConnectionSettings = { baseUrl: string; apiKey: string; model: string }

export async function testAiConnection(settings: AiConnectionSettings, request: typeof fetch = fetch): Promise<void> {
  if (!settings.apiKey.trim() || !settings.baseUrl.trim() || !settings.model.trim()) {
    throw new Error('请先填写 API Key、Base URL 和模型名称。')
  }
  let response: Response
  try {
    response = await request('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: [{ role: 'user', content: '请只回复 OK。' }]
      })
    })
  } catch {
    throw new Error('无法连接到应用服务，请检查网络和服务状态。')
  }
  if (!response.ok) throw await aiResponseError(response)
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (typeof body?.content !== 'string' || !body.content.trim()) throw new Error('模型未返回文本，请检查服务兼容性。')
}

export async function aiResponseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (response.status === 400 && (body?.error === 'Base URL 格式不正确' || body?.error === 'Base URL 必须是可公开访问的 HTTPS 地址')) return new Error(body.error)
  if (response.status === 524) return new Error('模型服务响应超时，请稍后重试或选用响应更快的模型。')
  if (response.status === 502) {
    const status = /^模型服务返回 (\d{3})(?:：|$)/.exec(typeof body?.error === 'string' ? body.error : '')?.[1]
    if (status === '401' || status === '403') return new Error('模型服务拒绝授权，请检查 API Key 和访问权限。')
    if (status === '404') return new Error('模型接口或模型不存在，请检查 Base URL 和模型名称。')
    if (status === '429') return new Error('模型服务请求过于频繁或额度不足，请稍后重试。')
    if (status === '524' || body?.error === '模型响应超时') return new Error('模型服务响应超时，请稍后重试或选用响应更快的模型。')
    return new Error('模型服务连接或响应失败，请检查地址、API Key 和模型名称。')
  }
  return new Error('分析请求失败，请稍后重试。')
}
