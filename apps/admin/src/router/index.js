import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue'
import UserList from '../views/UserList.vue'
import PostList from '../views/PostList.vue'
import Dashboard from '../views/Dashboard.vue'
import { authSession } from '../auth/session.js'
import { createAuthGuard } from './authGuard.js'

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: Dashboard, meta: { title: '统计看板' } },
      { path: 'users', component: UserList, meta: { title: '用户管理' } },
      { path: 'posts', component: PostList, meta: { title: '内容管理' } }
    ]
  }
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach(createAuthGuard(authSession))

export default router
