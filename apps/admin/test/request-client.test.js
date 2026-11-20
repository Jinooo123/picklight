import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import axios from 'axios'
import { createRequestClient, DEFAULT_TIMEOUT_MS } from '../src/api/createRequestClient.js'

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function fixture(t, handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => {
    server.close(resolve)
    server.closeAllConnections()
  }))

  const session = { token: 'test-session-a', cleared: 0, redirected: 0, messages: [] }
  const baseURL = `http://127.0.0.1:${server.address().port}/api/v1`
  const client = createRequestClient({
    baseURL,
    getToken: () => session.token,
    clearToken: () => { session.token = null; session.cleared += 1 },
    onUnauthorized: () => { session.redirected += 1 },
    onError: (message) => session.messages.push(message)
  })
  // Keep the local HTTP fixture independent of workstation proxy settings.
  client.defaults.proxy = false
  return { client, session, baseURL }
}

test('baseURL and current token are applied; successful JSON is returned unchanged', async (t) => {
  const { client, session, baseURL } = await fixture(t, (request, response) => {
    json(response, 200, { path: request.url, authorization: request.headers.authorization || null })
  })

  assert.equal(client.defaults.baseURL, baseURL)
  assert.equal(client.defaults.timeout, DEFAULT_TIMEOUT_MS)
  assert.deepEqual(await client.get('/admin/users', { params: { page: 2 } }), {
    path: '/api/v1/admin/users?page=2', authorization: 'Bearer test-session-a'
  })
  session.token = 'test-session-b'
  assert.equal((await client.get('/admin/users')).authorization, 'Bearer test-session-b')
  session.token = null
  assert.equal((await client.get('/admin/users', {
    headers: { Authorization: 'Bearer stale-test-session' }
  })).authorization, null)
  assert.deepEqual(session.messages, [])
})

test('success envelopes are preserved without guessing a business success code', async (t) => {
  const payload = { code: 0, message: 'ok', data: { items: [], total: 0 } }
  const { client } = await fixture(t, (_request, response) => json(response, 200, payload))
  assert.deepEqual(await client.get('/admin/users'), payload)
})

test('backend message is presented and the original HTTP error remains available', async (t) => {
  const { client, session } = await fixture(t, (_request, response) => {
    json(response, 400, { code: 40012, message: '用户名不能为空', details: [] })
  })
  await assert.rejects(client.get('/admin/users'), (error) => {
    assert.equal(error.response.status, 400)
    assert.equal(error.userMessage, '用户名不能为空')
    return true
  })
  assert.deepEqual(session.messages, ['用户名不能为空'])
  assert.equal(session.cleared, 0)
})

test('numeric messages fall back to readable text; 403 keeps the session', async (t) => {
  const { client, session } = await fixture(t, (_request, response) => {
    json(response, 403, { code: 40301, message: '40301' })
  })
  await assert.rejects(client.delete('/admin/users/2'))
  assert.deepEqual(session.messages, ['没有权限执行此操作'])
  assert.equal(session.token, 'test-session-a')
  assert.equal(session.redirected, 0)
})

test('concurrent protected 401 responses clear the token and notify only once', async (t) => {
  const { client, session } = await fixture(t, (_request, response) => {
    json(response, 401, { code: 40101, message: '登录已过期，请重新登录' })
  })
  const results = await Promise.allSettled([
    client.get('/admin/users'), client.get('/admin/posts')
  ])
  assert.ok(results.every((result) => result.status === 'rejected'))
  assert.equal(session.token, null)
  assert.equal(session.cleared, 1)
  assert.equal(session.redirected, 1)
  assert.deepEqual(session.messages, ['登录已过期，请重新登录'])
})

test('a late 401 from an old session does not sign out a new session', async (t) => {
  let signalArrival
  let releaseResponse
  const arrived = new Promise((resolve) => { signalArrival = resolve })
  const { client, session } = await fixture(t, (_request, response) => {
    releaseResponse = () => json(response, 401, { message: '旧登录已过期' })
    signalArrival()
  })
  const result = client.get('/admin/users')
  const rejected = assert.rejects(result, (error) => error.response.status === 401)
  await arrived
  session.token = 'test-new-session'
  releaseResponse()
  await rejected
  assert.equal(session.token, 'test-new-session')
  assert.equal(session.cleared, 0)
  assert.equal(session.redirected, 0)
  assert.deepEqual(session.messages, [])
})

test('public login requests send no stored token and their 401 does not invalidate a session', async (t) => {
  let authorization
  const { client, session } = await fixture(t, (request, response) => {
    authorization = request.headers.authorization
    json(response, 401, { message: '用户名或密码错误' })
  })
  await assert.rejects(client.post('/auth/login', {}, { skipAuth: true }))
  assert.equal(authorization, undefined)
  assert.equal(session.token, 'test-session-a')
  assert.equal(session.redirected, 0)
  assert.deepEqual(session.messages, ['用户名或密码错误'])
})

test('session checks keep Authorization but leave 401 navigation to the guard', async (t) => {
  let authorization
  const { client, session } = await fixture(t, (request, response) => {
    authorization = request.headers.authorization
    json(response, 401, { code: 40100, message: '登录已过期' })
  })
  await assert.rejects(client.get('/me', { silent: true, handleUnauthorized: false }),
    (error) => error.response.status === 401)
  assert.equal(authorization, 'Bearer test-session-a')
  assert.equal(session.token, 'test-session-a')
  assert.equal(session.cleared, 0)
  assert.equal(session.redirected, 0)
  assert.deepEqual(session.messages, [])
})

test('timeout prompts a manual retry and never repeats a write request', async (t) => {
  let requests = 0
  const { client, session } = await fixture(t, (_request, response) => {
    requests += 1
    const timer = setTimeout(() => json(response, 200, { ok: true }), 300)
    timer.unref()
  })
  await assert.rejects(client.post('/admin/posts/2/status', {}, { timeout: 60 }),
    (error) => error.userMessage === '请求超时，请稍后重试')
  assert.equal(requests, 1)
  assert.deepEqual(session.messages, ['请求超时，请稍后重试'])
})

test('connection failure presents a readable retry message', async (t) => {
  const { client, session } = await fixture(t, (request) => request.socket.destroy())
  await assert.rejects(client.get('/admin/users'),
    (error) => error.userMessage === '网络连接失败，请检查网络后重试')
  assert.deepEqual(session.messages, ['网络连接失败，请检查网络后重试'])
})

test('silent mode leaves errors to the caller; cancellation produces no error toast', async (t) => {
  const { client, session } = await fixture(t, (_request, response) => {
    json(response, 500, { message: '服务繁忙' })
  })
  await assert.rejects(client.get('/admin/users', { silent: true }),
    (error) => error.userMessage === '服务繁忙')
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(client.get('/admin/users', { signal: controller.signal }), axios.isCancel)
  assert.deepEqual(session.messages, [])
  assert.equal(session.redirected, 0)
})
