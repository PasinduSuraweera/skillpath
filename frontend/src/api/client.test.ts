// Unit tests for the API client's error handling, with fetch replaced by a stub.
// Run: npm test
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ValidationError, getOptions, predict } from './client'

const reply = (status: number, body: unknown) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('API client', () => {
  it('posts the profile as JSON and returns the body', async () => {
    const body = { roles: [{ rank: 1 }], ranking: [], families: [], model: {} }
    const fetch = reply(200, body)
    vi.stubGlobal('fetch', fetch)
    await expect(predict({ years_code: 3 })).resolves.toEqual(body)
    const [path, init] = fetch.mock.calls[0]
    expect(path).toBe('/api/predict')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ years_code: 3 })
  })

  it('turns a 422 into a ValidationError that keeps the field list', async () => {
    const fields = [{ field: 'years_code', message: 'Input should be greater than or equal to 0' }]
    vi.stubGlobal('fetch', reply(422, { error: 'invalid_input', message: 'Some answers are not valid.', fields }))
    const err = await predict({ years_code: -1 }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ValidationError)
    expect((err as ValidationError).message).toBe('Some answers are not valid.')
    expect((err as ValidationError).fields).toEqual(fields)
  })

  it.each([502, 503, 504])('explains how to start the API when the proxy answers %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status })))
    await expect(getOptions()).rejects.toThrow(/Cannot reach the SkillPath API.*uvicorn app\.main:app/)
  })

  it('tells a visitor to the hosted app to wait, not to start the API', async () => {
    vi.stubEnv('DEV', false)
    vi.resetModules()
    const hosted = await import('./client')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502 })))
    const err = await hosted.getOptions().catch((e: Error) => e.message)
    expect(err).toMatch(/Cannot reach the SkillPath API.*starting up/)
    expect(err).not.toMatch(/uvicorn/)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })))
    await expect(hosted.getOptions()).rejects.toThrow(/cannot read.*starting up/)
  })

  it('explains how to start the API when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getOptions()).rejects.toThrow(/Cannot reach the SkillPath API/)
  })

  it('rejects a 200 that is not the API\'s JSON (e.g. an HTML page from a proxy)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!doctype html><title>proxy</title>', { status: 200 })))
    await expect(predict({})).rejects.toThrow(/sent a response this page cannot read/)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 })))
    await expect(getOptions()).rejects.toThrow(/sent a response this page cannot read/)
  })

  it('rejects JSON without the parts the page relies on', async () => {
    vi.stubGlobal('fetch', reply(200, { ok: true }))
    await expect(predict({})).rejects.toThrow(/sent a response this page cannot read/)
    vi.stubGlobal('fetch', reply(200, { roles: [], ranking: [], families: [], model: {} }))
    await expect(predict({})).rejects.toThrow(/sent a response this page cannot read/)
  })

  it('reports other HTTP errors with their status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 })))
    await expect(predict({})).rejects.toThrow('The API returned an error (HTTP 500).')
  })
})
