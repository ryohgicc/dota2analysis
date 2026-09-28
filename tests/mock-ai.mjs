const originalFetch = globalThis.fetch
globalThis.fetch = async (input, options) => {
  if (String(input) === 'https://api.openai.com/v1/chat/completions') {
    const body = JSON.parse(options.body)
    return Response.json({ choices: [{ message: { content: `mock:${body.model}:${body.messages[0].content}:${options.headers.Authorization === 'Bearer test-key'}` } }] })
  }
  return originalFetch(input, options)
}

const completionFetch = globalThis.fetch
globalThis.fetch = async (input, options) => {
  const target = String(input)
  if (target === 'https://api.opendota.com/api/matches/777777') return Response.json(null)
  if (options?.method === 'POST' && target.startsWith('https://api.opendota.com/api/request/')) {
    const matchId = target.slice(target.lastIndexOf('/') + 1)
    if (matchId === '429') return Response.json({ error: 'rate limited' }, { status: 429 })
    if (matchId === '501') return Response.json(null)
    if (matchId === '500') return Response.json({ error: 'token or upstream details' }, { status: 500 })
    return Response.json({ job: { jobId: 12345 } })
  }
  return completionFetch(input, options)
}
