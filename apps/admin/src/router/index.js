import { createRouter, createWebHashHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue'
import UserList from '../views/UserList.vue'
import PostList from '../views/PostList.vue'
import Dashboard from '../views/Dashboard.vue'

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

// TODO(T-701)：改为校验 token 与服务端返回的角色，不要只看本地有没有字符串
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (!to.meta.public && !token) return { path: '/login' }
  return true
})

export default router
