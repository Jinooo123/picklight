<script setup>
import { ref, computed, onMounted } from "vue";
import {
  Aperture,
  Compass,
  BookOpen,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Star,
  MessageCircle,
  X,
  ImagePlus,
  Film,
  LogOut,
  LayoutDashboard,
  Users,
  ShieldCheck,
  Trash2,
  Eye,
  CalendarDays,
  Settings,
  Menu,
  RefreshCw,
} from "lucide-vue-next";
const user = ref(null),
  token = ref(localStorage.getItem("moment-token") || ""),
  view = ref(location.hash.startsWith("#admin") ? "admin" : "discover"),
  adminTab = ref("overview"),
  modal = ref(""),
  busy = ref(false),
  loading = ref(false),
  error = ref(""),
  toast = ref(""),
  posts = ref([]),
  topics = ref([]),
  tags = ref([]),
  total = ref(0),
  page = ref(1),
  q = ref(""),
  tag = ref(""),
  topic = ref(""),
  from = ref(""),
  to = ref(""),
  filters = ref(false),
  selected = ref(null),
  comments = ref([]),
  comment = ref(""),
  score = ref(0),
  stats = ref(null),
  adminRows = ref([]),
  audit = ref([]),
  searchAdmin = ref(""),
  uploading = ref(false);
const authForm = ref({ username: "", password: "", nickname: "" }),
  register = ref(false),
  password = ref({ oldPassword: "", password: "" }),
  editor = ref({
    title: "",
    body: "",
    tags: "",
    topicId: "",
    media: [],
    id: null,
  });
const title = computed(
  () =>
    ({ discover: "发现片刻", mine: "我的回忆", admin: "管理工作台" })[
      view.value
    ],
);
const chartMax = computed(() =>
  Math.max(
    1,
    ...(stats.value?.daily || []).flatMap((d) => [d.users, d.posts, d.active]),
  ),
);
async function api(url, options = {}) {
  const form = options.body instanceof FormData;
  const r = await fetch("/api" + url, {
    ...options,
    headers: {
      ...(form ? {} : { "Content-Type": "application/json" }),
      ...(token.value ? { Authorization: "Bearer " + token.value } : {}),
      ...options.headers,
    },
    body: options.body
      ? form
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });
  const b = await r.json();
  if (!r.ok) {
    if (r.status === 401 && user.value) {
      user.value = null;
      token.value = "";
      localStorage.removeItem("moment-token");
    }
    throw Error(b.message || "请求失败");
  }
  return b.data;
}
function notice(t) {
  toast.value = t;
  setTimeout(() => (toast.value = ""), 3500);
}
async function action(fn) {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await fn();
  } catch (e) {
    error.value = e.message;
    notice(e.message);
  } finally {
    busy.value = false;
  }
}
function open(name) {
  error.value = "";
  modal.value = name;
}
function needLogin() {
  if (user.value) return true;
  open("auth");
  return false;
}
async function load(reset = true) {
  if (reset) page.value = 1;
  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      q: q.value,
      tag: tag.value,
      topic: topic.value,
      from: from.value,
      to: to.value,
    });
    const b = await api(
      (view.value === "mine" ? "/me/posts" : "/posts") + "?" + params,
    );
    posts.value = b.items;
    total.value = b.total;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function navigate(v) {
  if (v === "mine" && !needLogin()) return;
  view.value = v;
  location.hash = v === "admin" ? "admin" : "";
  page.value = 1;
  q.value = "";
  tag.value = "";
  topic.value = "";
  if (v === "admin") {
    if (user.value?.role === "ADMIN") await loadAdmin();
  } else await load();
}
async function login() {
  await action(async () => {
    const b = await api("/auth/" + (register.value ? "register" : "login"), {
      method: "POST",
      body: authForm.value,
    });
    token.value = b.token;
    user.value = b.user;
    localStorage.setItem("moment-token", b.token);
    modal.value = "";
    notice("欢迎来到片刻");
    if (view.value === "admin" && b.user.role === "ADMIN") await loadAdmin();
    else if (view.value === "admin") await navigate("discover");
  });
}
async function logout() {
  await action(async () => {
    await api("/auth/logout", { method: "POST" });
    token.value = "";
    user.value = null;
    localStorage.removeItem("moment-token");
    await navigate("discover");
  });
}
function publish(p) {
  if (!needLogin()) return;
  editor.value = p
    ? {
        ...p,
        tags: p.tags.join("，"),
        topicId: p.topic_id || "",
        media: [...p.media],
      }
    : {
        title: "",
        body: "",
        tags: "",
        topicId: topic.value || "",
        media: [],
        id: null,
      };
  open("editor");
}
async function upload(e) {
  uploading.value = true;
  try {
    for (const file of [...e.target.files]) {
      if (editor.value.media.length >= 9) throw Error("最多 9 个媒体文件");
      const data = new FormData();
      data.append("file", file);
      const media = await api("/media", { method: "POST", body: data });
      editor.value.media.push({ ...media, unpublished: true });
    }
  } catch (e) {
    error.value = e.message;
    notice(e.message);
  } finally {
    uploading.value = false;
    e.target.value = "";
  }
}
async function save() {
  await action(async () => {
    const f = editor.value;
    await api("/posts" + (f.id ? "/" + f.id : ""), {
      method: f.id ? "PUT" : "POST",
      body: {
        title: f.title,
        body: f.body,
        tags: f.tags.split(/[,，\s]+/).filter(Boolean),
        topicId: f.topicId || null,
        mediaIds: f.media.map((m) => m.id),
      },
    });
    modal.value = "";
    await load();
    notice(f.id ? "片刻已更新" : "你的片刻已发布");
    tags.value = await api("/tags");
  });
}
async function detail(p) {
  await action(async () => {
    selected.value = await api("/posts/" + p.id);
    comments.value = (
      await api("/posts/" + p.id + "/comments?pageSize=50")
    ).items;
    score.value = 0;
    comment.value = "";
    open("detail");
  });
}
async function rate(n) {
  if (!needLogin()) return;
  await action(async () => {
    selected.value = await api("/posts/" + selected.value.id + "/rating", {
      method: "PUT",
      body: { score: n },
    });
    score.value = n;
    notice("评分已保存");
    await load(false);
  });
}
async function sendComment() {
  await action(async () => {
    await api("/posts/" + selected.value.id + "/comments", {
      method: "POST",
      body: { body: comment.value },
    });
    comment.value = "";
    comments.value = (
      await api("/posts/" + selected.value.id + "/comments?pageSize=50")
    ).items;
    selected.value.commentCount++;
    await load(false);
  });
}
async function removeComment(c) {
  await action(async () => {
    await api("/comments/" + c.id, { method: "DELETE" });
    comments.value = comments.value.filter((x) => x.id !== c.id);
    selected.value.commentCount--;
    await load(false);
  });
}
async function removePost(p) {
  if (!confirm("确定删除这个片刻？删除后将不再公开展示。")) return;
  await action(async () => {
    await api("/posts/" + p.id, { method: "DELETE" });
    modal.value = "";
    await load();
    notice("已删除");
  });
}
async function changePassword() {
  await action(async () => {
    await api("/me/password", { method: "PUT", body: password.value });
    token.value = "";
    user.value = null;
    localStorage.removeItem("moment-token");
    modal.value = "auth";
    notice("密码已修改，请重新登录");
  });
}
async function loadAdmin() {
  loading.value = true;
  try {
    if (adminTab.value === "overview") stats.value = await api("/admin/stats");
    else if (adminTab.value === "audit")
      audit.value = await api("/admin/audit");
    else {
      const b = await api(
        "/admin/" +
          (adminTab.value === "users" ? "users" : "posts") +
          "?pageSize=50&q=" +
          encodeURIComponent(searchAdmin.value),
      );
      adminRows.value = b.items;
      total.value = b.total;
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function moderate(row, status) {
  if (
    !confirm(
      `确认将${adminTab.value === "users" ? "用户" : "内容"}设为${status === "DELETED" ? "已删除" : status === "HIDDEN" ? "已下架" : status === "DISABLED" ? "已禁用" : "正常"}？`,
    )
  )
    return;
  await action(async () => {
    await api(
      "/admin/" +
        (adminTab.value === "users" ? "users" : "posts") +
        "/" +
        row.id,
      { method: "PATCH", body: { status } },
    );
    await loadAdmin();
    notice("操作已记录");
  });
}
function date(s) {
  return new Date(s).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
}
function editorMediaUrl(m) {
  if (!m.unpublished) return m.url;
  return m.url + (m.url.startsWith("/uploads/") ? "?token=" + encodeURIComponent(token.value) : "");
}
onMounted(async () => {
  try {
    if (token.value) user.value = await api("/me");
  } catch {
    token.value = "";
    localStorage.removeItem("moment-token");
  }
  try {
    [topics.value, tags.value] = await Promise.all([
      api("/topics"),
      api("/tags"),
    ]);
    if (view.value === "admin" && user.value?.role === "ADMIN")
      await loadAdmin();
    else await load();
  } catch (e) {
    error.value = e.message;
  }
});
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#" @click.prevent="navigate('discover')"
        ><span class="brand-icon"><Aperture :size="25" /></span
        ><b>片刻<span>MOMENT</span></b></a
      >
      <div class="nav-label">把日常留给以后</div>
      <nav>
        <button
          :class="{ active: view === 'discover' }"
          @click="navigate('discover')"
        >
          <Compass />发现片刻<span>探索</span>
        </button>
        <button :class="{ active: view === 'mine' }" @click="navigate('mine')">
          <BookOpen />我的回忆
        </button>
        <button @click="publish()"><Plus />记录一个片刻</button>
        <template v-if="user?.role === 'ADMIN'"
          ><div class="nav-label space">工作空间</div>
          <button
            :class="{ active: view === 'admin' }"
            @click="navigate('admin')"
          >
            <ShieldCheck />管理工作台
          </button></template
        >
      </nav>
      <div class="sidebar-note">
        <Aperture :size="30" />
        <p>生活不必很特别，<br />也值得被记录。</p>
        <span>MAKE ROOM FOR THE ORDINARY.</span>
      </div>
      <div class="account" v-if="user">
        <div class="avatar">{{ user.nickname.slice(0, 1) }}</div>
        <div>
          <b>{{ user.nickname }}</b
          ><button @click="open('password')">账号设置</button>
        </div>
        <button aria-label="退出登录" @click="logout">
          <LogOut :size="18" />
        </button>
      </div>
      <button v-else class="login-side" @click="open('auth')">
        登录 / 加入片刻
      </button>
    </aside>
    <main>
      <header class="topbar">
        <span
          ><span class="breadcrumb">片刻空间</span><span class="slash">/</span
          >{{ title }}</span
        >
        <div>
          <button class="plain" v-if="!user" @click="open('auth')">登录</button
          ><button class="primary small" @click="publish()">
            <Plus :size="16" />记录片刻
          </button>
        </div>
      </header>
      <div class="content" v-if="view !== 'admin'">
        <div class="heading">
          <div>
            <div class="eyebrow">
              {{
                view === "mine"
                  ? "YOUR PERSONAL COLLECTION"
                  : "A LITTLE PAUSE, A LITTLE WONDER"
              }}
            </div>
            <h1>
              {{
                view === "mine" ? "把日子，慢慢收藏。" : "普通日常，也有闪光。"
              }}
            </h1>
            <p>
              {{
                view === "mine"
                  ? "你记录的每一个片刻，都是未来的礼物。"
                  : "一张照片、一段声音之外的故事，和此刻的你。"
              }}
            </p>
          </div>
          <span class="date-badge"
            ><CalendarDays :size="17" />{{
              new Date().toLocaleDateString("zh-CN", {
                month: "long",
                day: "numeric",
              })
            }}</span
          >
        </div>
        <section v-if="view === 'discover'" class="theme-banner">
          <div>
            <span class="theme-label"><span></span>本期主题 · OPEN CALL</span>
            <h2>收集一束光</h2>
            <p>
              窗边、树下、回家路上。<br />记录光落下的地方，也记录那个停下来的你。
            </p>
            <button
              @click="
                topic = '1';
                publish();
              "
            >
              参与主题 <ArrowUpRight :size="17" />
            </button>
          </div>
          <div class="banner-art" aria-hidden="true">
            <div class="sun"></div>
            <div class="window-lines"></div>
            <div class="hill back"></div>
            <div class="hill front"></div>
            <span>LIGHT<br />IN EVERYDAY.</span>
          </div>
        </section>
        <div class="section-head">
          <div>
            <h2>{{ view === "mine" ? "我的片刻" : "片刻广场" }}</h2>
            <span>{{ total }} 个被留下的瞬间</span>
          </div>
          <button class="plain" @click="filters = !filters">
            <SlidersHorizontal :size="17" />{{
              filters ? "收起筛选" : "筛选与检索"
            }}
          </button>
        </div>
        <form class="filters" @submit.prevent="load()">
          <div class="search">
            <Search :size="18" /><input
              v-model="q"
              placeholder="寻找片刻、文字或创作者…"
              aria-label="搜索片刻"
            /><button type="submit">搜索</button>
          </div>
          <div v-if="filters" class="filter-extra">
            <label>开始日期<input type="date" v-model="from" /></label
            ><label>结束日期<input type="date" v-model="to" /></label
            ><select v-model="topic" @change="load()" aria-label="主题">
              <option value="">所有主题</option>
              <option v-for="t in topics" :value="t.id">
                {{ t.title }}
              </option></select
            ><button
              type="button"
              @click="
                q = '';
                tag = '';
                topic = '';
                from = '';
                to = '';
                load();
              "
            >
              重置
            </button>
          </div>
        </form>
        <div class="chips">
          <button
            :class="{ selected: !tag }"
            @click="
              tag = '';
              load();
            "
          >
            全部片刻</button
          ><button
            v-for="t in tags"
            :key="t.name"
            :class="{ selected: tag === t.name }"
            @click="
              tag = t.name;
              load();
            "
          >
            # {{ t.name }}
          </button>
        </div>
        <div class="state" v-if="loading">正在寻找片刻…</div>
        <div class="state error" v-else-if="error">
          {{ error }}<button @click="load()">重新加载</button>
        </div>
        <div class="state" v-else-if="!posts.length">
          <BookOpen />
          <h3>这里还没有片刻</h3>
          <p>试试其他筛选，或留下第一条记录。</p>
          <button class="primary" @click="publish()">记录一个片刻</button>
        </div>
        <div class="post-grid" v-else>
          <article class="post-card" v-for="p in posts" :key="p.id">
            <button class="cover" v-if="p.media.length" @click="detail(p)">
              <img
                v-if="p.media[0].type === 'image'"
                :src="p.media[0].url"
                alt="片刻影像"
                loading="lazy"
              /><video
                v-else
                :src="p.media[0].url"
                preload="metadata"
              /><span class="media-label">{{
                p.media[0].type === "video"
                  ? "视频片刻"
                  : p.media.length + " 张影像"
              }}</span>
            </button>
            <button
              v-else
              class="text-cover"
              :class="'tone-' + (p.id % 3)"
              @click="detail(p)"
            >
              <Aperture :size="28" /><span>{{ p.title }}</span
              ><small>WORDS TO REMEMBER</small>
            </button>
            <div class="card-body">
              <div class="card-tags">
                <button
                  v-for="t in p.tags"
                  @click="
                    tag = t;
                    load();
                  "
                >
                  # {{ t }}</button
                ><span v-if="p.status === 'HIDDEN'">已下架</span>
              </div>
              <button class="card-title" @click="detail(p)">
                {{ p.title }}
              </button>
              <p>{{ p.body }}</p>
              <div class="card-footer">
                <span class="mini-avatar">{{ p.author.slice(0, 1) }}</span
                ><b>{{ p.author }}</b
                ><span>{{ date(p.created_at) }}</span>
              </div>
              <div class="card-meta">
                <span
                  ><Star :size="14" />{{ p.average || "暂无评分"
                  }}<small v-if="p.ratingCount"
                    >({{ p.ratingCount }})</small
                  ></span
                ><span><MessageCircle :size="14" />{{ p.commentCount }}</span>
                <div v-if="view === 'mine'">
                  <button v-if="p.status === 'PUBLISHED'" @click="publish(p)">
                    编辑</button
                  ><button @click="removePost(p)">删除</button>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div class="pagination" v-if="total > 12">
          <button
            :disabled="page === 1"
            @click="
              page--;
              load(false);
            "
          >
            上一页</button
          ><span>第 {{ page }} 页 / 共 {{ Math.ceil(total / 12) }} 页</span
          ><button
            :disabled="page * 12 >= total"
            @click="
              page++;
              load(false);
            "
          >
            下一页
          </button>
        </div>
        <footer>片刻 MOMENT <span>让值得记住的，不止留在相册里。</span></footer>
      </div>
      <div class="content" v-else>
        <div class="heading">
          <div>
            <div class="eyebrow">MOMENT STUDIO</div>
            <h1>让社区，好好生长。</h1>
            <p>看见每一次记录，也守护每一个片刻。</p>
          </div>
          <ShieldCheck :size="38" />
        </div>
        <div v-if="user?.role !== 'ADMIN'" class="state">
          <ShieldCheck />
          <h3>管理员工作空间</h3>
          <p>请使用管理员账号登录。</p>
          <button class="primary" @click="open('auth')">管理员登录</button>
        </div>
        <template v-else>
          <div class="chips admin-tabs">
            <button
              v-for="[key, label] in [
                ['overview', '数据概览'],
                ['posts', '内容管理'],
                ['users', '用户管理'],
                ['audit', '操作记录'],
              ]"
              :class="{ selected: adminTab === key }"
              @click="
                adminTab = key;
                searchAdmin = '';
                loadAdmin();
              "
            >
              {{ label }}
            </button>
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <div v-if="loading" class="state">加载中…</div>
          <template v-else-if="adminTab === 'overview' && stats">
            <div class="stat-grid">
              <div
                v-for="[label, n] in [
                  ['累计普通用户', stats.totalUsers],
                  ['累计发布片刻', stats.totalPosts],
                  ['今日活跃用户', stats.activeToday],
                  ['可见评论', stats.totalComments],
                ]"
              >
                <span>{{ label }}</span
                ><strong>{{ n }}</strong
                ><small>来自真实系统数据</small>
              </div>
            </div>
            <section class="chart-box">
              <div class="section-head">
                <h2>最近 7 日 · 社区足迹</h2>
                <span>北京时间 / 含今天</span>
              </div>
              <div class="legend">
                <span>新增用户</span><span>新增片刻</span><span>活跃用户</span>
              </div>
              <div class="chart">
                <div class="chart-day" v-for="d in stats.daily">
                  <div class="bars">
                    <div
                      v-for="(key, i) in ['users', 'posts', 'active']"
                      :class="'bar b' + i"
                      :style="{
                        height: Math.max(2, (d[key] / chartMax) * 180) + 'px',
                      }"
                    >
                      <span>{{ d[key] }}</span>
                    </div>
                  </div>
                  <small>{{ d.date.slice(5) }}</small>
                </div>
              </div>
            </section>
            <section class="chart-box">
              <h2>大家正在记录</h2>
              <div class="tag-stats">
                <span v-for="t in stats.tags"
                  ># {{ t.name }}<b>{{ t.count }} 条</b></span
                >
              </div>
              <p class="tip">
                统计时间：{{
                  new Date(stats.asOf).toLocaleString("zh-CN")
                }}。累计包含后来删除或下架的数据；活跃为当日成功登录、发布、评论、评分的普通用户去重数。
              </p>
            </section>
          </template>
          <section
            class="table-box"
            v-else-if="adminTab === 'users' || adminTab === 'posts'"
          >
            <form class="search" @submit.prevent="loadAdmin()">
              <Search :size="18" /><input
                v-model="searchAdmin"
                placeholder="按账号、作者或内容查询"
              /><button>查询</button>
            </form>
            <p class="tip">
              共 {{ total }} 条，当前展示前 50 条；可使用搜索缩小范围。
            </p>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>
                      {{ adminTab === "users" ? "账号 / 昵称" : "标题 / 作者" }}
                    </th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in adminRows">
                    <td>#{{ r.id }}</td>
                    <td>
                      <b>{{ r.title || r.username }}</b
                      ><small>{{ r.author || r.nickname }}</small>
                    </td>
                    <td>
                      <span class="status">{{
                        {
                          ACTIVE: "正常",
                          DISABLED: "已禁用",
                          DELETED: "已删除",
                          PUBLISHED: "已发布",
                          HIDDEN: "已下架",
                        }[r.status]
                      }}</span>
                    </td>
                    <td>{{ date(r.created_at || r.createdAt) }}</td>
                    <td>
                      <template v-if="r.role !== 'ADMIN'"
                        ><button
                          v-if="r.status !== 'DELETED'"
                          @click="
                            moderate(
                              r,
                              adminTab === 'users'
                                ? r.status === 'ACTIVE'
                                  ? 'DISABLED'
                                  : 'ACTIVE'
                                : r.status === 'PUBLISHED'
                                  ? 'HIDDEN'
                                  : 'PUBLISHED',
                            )
                          "
                        >
                          {{
                            r.status === "ACTIVE"
                              ? "禁用"
                              : r.status === "PUBLISHED"
                                ? "下架"
                                : "恢复"
                          }}</button
                        ><button
                          v-if="r.status !== 'DELETED'"
                          class="danger"
                          @click="moderate(r, 'DELETED')"
                        >
                          删除
                        </button></template
                      ><span v-else>受保护</span>
                    </td>
                  </tr>
                  <tr v-if="!adminRows.length">
                    <td colspan="5">暂无匹配记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section class="table-box" v-else>
            <h2>最近 100 次管理操作</h2>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>管理员</th>
                    <th>对象</th>
                    <th>操作</th>
                    <th>时间</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="a in audit">
                    <td>{{ a.admin }}</td>
                    <td>{{ a.target_type }} #{{ a.target_id }}</td>
                    <td>{{ a.action }}</td>
                    <td>
                      {{ new Date(a.created_at).toLocaleString("zh-CN") }}
                    </td>
                  </tr>
                  <tr v-if="!audit.length">
                    <td colspan="4">还没有管理操作</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </div>
    </main>
  </div>
  <div class="toast" role="status" v-if="toast">{{ toast }}</div>
  <div class="overlay" v-if="modal" @click.self="modal = ''">
    <section
      class="dialog"
      :class="{ wide: modal === 'detail' || modal === 'editor' }"
      role="dialog"
      aria-modal="true"
      :aria-label="
        modal === 'auth'
          ? '登录片刻'
          : modal === 'editor'
            ? '记录片刻'
            : '片刻详情'
      "
    >
      <button class="close" aria-label="关闭" @click="modal = ''"><X /></button>
      <template v-if="modal === 'auth'"
        ><Aperture class="dialog-icon" :size="35" />
        <div class="eyebrow">WELCOME TO MOMENT</div>
        <h2>{{ register ? "让故事从这里开始" : "欢迎回到，片刻。" }}</h2>
        <p>登录后，把今天留给未来的自己。</p>
        <form @submit.prevent="login">
          <label
            >账号<input
              v-model="authForm.username"
              required
              minlength="3"
              maxlength="20"
              autocomplete="username"
              placeholder="3-20 位字母、数字或下划线" /></label
          ><label v-if="register"
            >昵称<input
              v-model="authForm.nickname"
              required
              maxlength="20"
              placeholder="怎么称呼你？" /></label
          ><label
            >密码<input
              v-model="authForm.password"
              required
              type="password"
              minlength="8"
              maxlength="64"
              :autocomplete="register ? 'new-password' : 'current-password'"
              placeholder="至少 8 位"
          /></label>
          <p class="error" v-if="error">{{ error }}</p>
          <button class="primary full" :disabled="busy">
            {{ busy ? "请稍候…" : register ? "创建账号" : "登录片刻" }}
          </button>
        </form>
        <button
          class="switch-auth"
          @click="
            register = !register;
            error = '';
          "
        >
          {{ register ? "已有账号？去登录" : "第一次来？创建账号" }}
        </button></template
      >
      <template v-if="modal === 'password'"
        ><h2>账号与安全</h2>
        <p>修改密码后，所有设备需要重新登录。</p>
        <form @submit.prevent="changePassword">
          <label
            >原密码<input
              v-model="password.oldPassword"
              type="password"
              required
              autocomplete="current-password" /></label
          ><label
            >新密码<input
              v-model="password.password"
              type="password"
              minlength="8"
              maxlength="64"
              required
              autocomplete="new-password"
          /></label>
          <p class="error">{{ error }}</p>
          <button class="primary full" :disabled="busy">保存新密码</button>
        </form></template
      >
      <template v-if="modal === 'editor'"
        ><div class="eyebrow">CAPTURE THE ORDINARY</div>
        <h2>{{ editor.id ? "再好好写一次" : "今天，想留下什么？" }}</h2>
        <form @submit.prevent="save">
          <label
            >给片刻起个名字<input
              v-model="editor.title"
              maxlength="60"
              required
              placeholder="比如：下课以后，去看一场日落" /></label
          ><label
            >此刻的故事<textarea
              v-model="editor.body"
              maxlength="2000"
              rows="5"
              placeholder="不用写得很特别，真实就很好。"
            />
          </label>
          <div class="upload-box">
            <label
              ><ImagePlus :size="22" /><span>{{
                uploading ? "上传中…" : "添加图片或视频"
              }}</span
              ><small>JPEG / PNG ≤10MB · MP4 ≤30MB</small
              ><input
                class="file"
                type="file"
                multiple
                accept="image/jpeg,image/png,video/mp4"
                :disabled="uploading"
                @change="upload"
            /></label>
          </div>
          <div class="media-previews">
            <div v-for="(m, i) in editor.media">
              <img
                v-if="m.type === 'image'"
                :src="editorMediaUrl(m)"
                alt="已上传图片"
              /><video v-else :src="editorMediaUrl(m)" controls /><button
                type="button"
                @click="editor.media.splice(i, 1)"
                aria-label="移除媒体"
              >
                <X :size="15" />
              </button>
            </div>
          </div>
          <div class="form-row">
            <label
              >标签<input
                v-model="editor.tags"
                placeholder="校园，光影（最多 5 个）" /></label
            ><label
              >参与主题<select v-model="editor.topicId">
                <option value="">自由记录</option>
                <option v-for="t in topics" :value="t.id">{{ t.title }}</option>
              </select></label
            >
          </div>
          <p class="error" v-if="error">{{ error }}</p>
          <button class="primary full" :disabled="busy || uploading">
            {{ busy ? "保存中…" : editor.id ? "保存修改" : "发布这个片刻" }}
          </button>
        </form></template
      >
      <template v-if="modal === 'detail' && selected"
        ><div class="eyebrow">A MOMENT TO REMEMBER</div>
        <h2>{{ selected.title }}</h2>
        <div class="detail-by">
          {{ selected.author }} · {{ date(selected.created_at) }}
        </div>
        <p class="detail-body">{{ selected.body }}</p>
        <div class="detail-media">
          <template v-for="m in selected.media"
            ><img
              v-if="m.type === 'image'"
              :src="m.url"
              alt="片刻影像" /><video v-else controls :src="m.url"
          /></template>
        </div>
        <div class="card-tags">
          <span v-for="t in selected.tags"># {{ t }}</span>
        </div>
        <section class="rating">
          <div>
            <b>给这个片刻打个分</b
            ><small
              >当前 {{ selected.average }} 分 ·
              {{ selected.ratingCount }} 人评分</small
            >
          </div>
          <div>
            <button
              v-for="n in 5"
              :aria-label="n + ' 分'"
              :disabled="busy || selected.user_id === user?.id"
              @click="rate(n)"
            >
              <Star
                :size="23"
                :fill="n <= score ? '#da9e42' : 'none'"
                :color="n <= score ? '#da9e42' : '#9a9c98'"
              />
            </button>
          </div>
        </section>
        <h3>片刻回应 · {{ selected.commentCount }}</h3>
        <form v-if="user" class="comment-form" @submit.prevent="sendComment">
          <input
            v-model="comment"
            required
            maxlength="500"
            placeholder="说说让你有共鸣的地方…"
          /><button class="primary" :disabled="busy">发送</button>
        </form>
        <button v-else class="plain" @click="open('auth')">
          登录后，留下你的回应
        </button>
        <div class="comment" v-for="c in comments">
          <div class="mini-avatar">{{ c.author.slice(0, 1) }}</div>
          <div>
            <b>{{ c.author }}</b>
            <p>{{ c.body }}</p>
            <small>{{ date(c.created_at) }}</small>
          </div>
          <button
            v-if="c.user_id === user?.id || user?.role === 'ADMIN'"
            @click="removeComment(c)"
            aria-label="删除评论"
          >
            <Trash2 :size="15" />
          </button>
        </div>
        <p class="tip" v-if="!comments.length">
          还没有回应，做第一个认真看见的人。
        </p>
        <p v-if="selected.commentCount > 50" class="tip">
          当前展示最近 50 条回应。
        </p></template
      >
    </section>
  </div>
</template>
