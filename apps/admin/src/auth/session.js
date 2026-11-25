import { authApi } from '../api/auth.js'
import { createAuthSession } from './createAuthSession.js'
import { tokenStorage } from './tokenStorage.js'

export const authSession = createAuthSession({ api: authApi, storage: tokenStorage })
