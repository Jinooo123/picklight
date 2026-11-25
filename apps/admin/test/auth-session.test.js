import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthSession } from '../src/auth/createAuthSession.js'
import { createAuthGuard, loginDestination } from '../src/router/authGuard.js'

const admin = { id: 1, username: 'admin_test', role: 'ADMIN', status: 'ACTIVE' }
const ordinary = { ...admin, role: 'USER' }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function setup(overrides = {}, token = null) {
  let stored = token
  const storage = { get: () => stored, set: (value) => { stored = value }, clear: () => { stored = null } }
  const api = { login: async () => ({ token: 'admin-session', user: admin }), me: async () => admin, ...overrides }
  return { session: createAuthSession({ api, storage }), storage }
}

test('anonymous navigation preserves destination including query and fragment', async () => {
  const { session } = setup()
  const guard = createAuthGuard(session)
  assert.deepEqual(await guard({ meta: {}, fullPath: '/users?page=2#results' }), {
    path: '/login', query: { redirect: '/users?page=2#results' }
  })
  assert.equal(await guard({ meta: { public: true }, fullPath: '/login' }), true)
})

test('only active administrators receive a stored session', async () => {
  const { session, storage } = setup()
  assert.deepEqual(await session.login({ username: 'test', password: 'test' }), admin)
  assert.equal(storage.get(), 'admin-session')
  assert.deepEqual(await session.ensureSession(), admin)
  session.logout()
  assert.equal(storage.get(), null)
  assert.equal(await session.ensureSession(), null)
})

test('ordinary, disabled and malformed accounts fail closed without persisting the returned token', async () => {
  for (const user of [ordinary, { ...admin, status: 'DISABLED' }, { ...admin, status: 'DELETED' }, { role: 'ADMIN' }, null]) {
    const { session, storage } = setup({ login: async () => ({ token: 'rejected', user }) }, 'old-session')
    await assert.rejects(session.login({}), /权限|禁用|状态/)
    assert.equal(storage.get(), null)
  }
  const { session, storage } = setup({ login: async () => ({ token: '', user: admin }) })
  await assert.rejects(session.login({}), /凭证/)
  assert.equal(storage.get(), null)
})

test('reload checks stored token with server and shares concurrent checks', async () => {
  let calls = 0
  const check = deferred()
  const { session } = setup({ me: () => { calls++; return check.promise } }, 'persisted')
  const first = session.ensureSession()
  const second = session.ensureSession()
  assert.equal(calls, 1)
  check.resolve(admin)
  assert.deepEqual(await first, admin)
  assert.deepEqual(await second, admin)
  assert.deepEqual(await session.ensureSession(), admin)
  assert.equal(calls, 1)
})

test('server profile overrides local token presence and denies ordinary user after refresh', async () => {
  const { session, storage } = setup({ me: async () => ordinary }, 'ordinary-token')
  const guard = createAuthGuard(session)
  assert.deepEqual(await guard({ meta: {}, fullPath: '/posts' }), {
    path: '/login', query: { redirect: '/posts', reason: 'forbidden' }
  })
  assert.equal(storage.get(), null)
})

test('expired and disabled sessions are cleared, while network failures retain token and allow retry', async () => {
  for (const [status, code, reason] of [[401, 40100, 'expired'], [403, 40301, 'disabled'], [403, 40300, 'forbidden']]) {
    const { session, storage } = setup({ me: async () => { throw { response: { status, data: { code } } } } }, 'old')
    await assert.rejects(session.ensureSession(), (error) => error.reason === reason)
    assert.equal(storage.get(), null)
  }
  let fail = true
  const { session, storage } = setup({ me: async () => { if (fail) throw new Error('offline'); return admin } }, 'retry-token')
  await assert.rejects(session.ensureSession(), (error) => error.reason === 'unavailable')
  assert.equal(storage.get(), 'retry-token')
  fail = false
  assert.deepEqual(await session.ensureSession(), admin)
})

test('late verification cannot restore logout or clear a newer successful login', async () => {
  for (const succeeds of [true, false]) {
    const old = deferred()
    const { session, storage } = setup({ me: () => old.promise }, 'old-token')
    const result = session.ensureSession()
    session.logout()
    await session.login({})
    if (succeeds) old.resolve(ordinary)
    else old.reject({ response: { status: 401 } })
    assert.equal(await result, null)
    assert.equal(storage.get(), 'admin-session')
    assert.deepEqual(await session.ensureSession(), admin)
  }
})

test('late login cannot undo logout and failed persistence never authorizes', async () => {
  const pendingLogin = deferred()
  const { session, storage } = setup({ login: () => pendingLogin.promise })
  const result = session.login({})
  session.logout()
  pendingLogin.resolve({ token: 'late', user: admin })
  await assert.rejects(result, /取消/)
  assert.equal(storage.get(), null)

  const blocked = createAuthSession({ api: { login: async () => ({ token: 'x', user: admin }) }, storage: {
    get: () => null, clear() {}, set() { throw new Error('storage blocked') }
  } })
  await assert.rejects(blocked.login({}), /storage blocked/)
  assert.equal(await blocked.ensureSession(), null)
})

test('login return path accepts known internal pages and rejects external or looping destinations', () => {
  assert.equal(loginDestination('/users?page=2#results'), '/users?page=2#results')
  assert.equal(loginDestination('/posts?tag=%E6%A0%A1%E5%9B%AD'), '/posts?tag=%E6%A0%A1%E5%9B%AD')
  for (const value of [undefined, ['//evil.example'], 'https://evil.example', '//evil.example', '/\\evil.example', '/login?redirect=/users', '/unknown', '/users\n', '/%2f%2fevil.example']) {
    assert.equal(loginDestination(value), '/dashboard')
  }
})
