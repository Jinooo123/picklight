import express from "express";
import multer from "multer";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = () => new Date().toISOString();
const hash = (p) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
const verify = (p, h) => {
  const [s, v] = h.split(":");
  return timingSafeEqual(scryptSync(p, s, 64), Buffer.from(v, "hex"));
};
const digest = (t) => createHash("sha256").update(t).digest("hex");
export function createApp({
  directory = path.join(root, "data"),
  seed = false,
} = {}) {
  mkdirSync(directory, { recursive: true });
  const uploads = path.join(directory, "uploads");
  mkdirSync(uploads, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "moment.sqlite"));
  db.exec(readFileSync(path.join(root, "server/schema.sql"), "utf8"));
  const one = (q, ...p) => db.prepare(q).get(...p),
    all = (q, ...p) => db.prepare(q).all(...p),
    run = (q, ...p) => db.prepare(q).run(...p);
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  const fail = (status, message) => {
    throw Object.assign(new Error(message), { status });
  };
  const ok = (res, data) => res.json({ code: 0, message: "成功", data });
  const words = () =>
    readFileSync(path.join(root, "server/blocked-words.txt"), "utf8")
      .split(/\r?\n/)
      .filter((x) => x && !x.startsWith("#"));
  function text(value, max = 2000) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max)
      fail(400, `请填写 1-${max} 字内容`);
    const v = value.trim().normalize("NFKC");
    if (words().some((w) => v.toLowerCase().includes(w.toLowerCase())))
      fail(400, "内容含有不适宜词语，请调整后重试");
    return v;
  }
  function credentials(b) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(b.username || ""))
      fail(400, "账号须为 3-20 位字母、数字或下划线");
    if (
      typeof b.password !== "string" ||
      b.password.length < 8 ||
      b.password.length > 64
    )
      fail(400, "密码须为 8-64 位");
  }
  const safe = (u) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
  });
  function auth(req, res, next) {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    req.user = one(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
      digest(token),
      now(),
    );
    if (!req.user || req.user.status !== "ACTIVE")
      return next(Object.assign(new Error("请重新登录"), { status: 401 }));
    next();
  }
  function admin(req, res, next) {
    if (req.user.role !== "ADMIN")
      return next(Object.assign(new Error("仅管理员可操作"), { status: 403 }));
    next();
  }
  function event(u, action) {
    if (u.role === "USER")
      run(
        "INSERT INTO events(user_id,action,created_at) VALUES(?,?,?)",
        u.id,
        action,
        now(),
      );
  }
  function session(u) {
    const token = randomBytes(32).toString("hex");
    run(
      "INSERT INTO sessions VALUES(?,?,?)",
      digest(token),
      u.id,
      new Date(Date.now() + 7 * 86400000).toISOString(),
    );
    event(u, "LOGIN");
    return { token, user: safe(u) };
  }
  function visible(id) {
    const p = one(
      "SELECT p.* FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? AND p.status='PUBLISHED' AND u.status='ACTIVE'",
      id,
    );
    if (!p) fail(404, "内容不存在或已下架");
    return p;
  }
  function mapped(p, viewer) {
    const a = one("SELECT nickname FROM users WHERE id=?", p.user_id);
    const r = one(
      "SELECT coalesce(round(avg(score),1),0) average,count(*) count FROM ratings WHERE post_id=?",
      p.id,
    );
    return {
      ...p,
      author: a.nickname,
      tags: JSON.parse(p.tags),
      media: all(
        "SELECT id,url,type FROM media WHERE post_id=? ORDER BY id",
        p.id,
      ),
      average: r.average,
      ratingCount: r.count,
      commentCount: one(
        "SELECT count(*) n FROM comments WHERE post_id=? AND status='ACTIVE'",
        p.id,
      ).n,
      myScore: viewer
        ? one(
            "SELECT score FROM ratings WHERE post_id=? AND user_id=?",
            p.id,
            viewer,
          )?.score || 0
        : 0,
    };
  }
  const page = (req) => {
    const p = Number(req.query.page || 1),
      s = Number(req.query.pageSize || 12);
    if (
      !Number.isInteger(p) ||
      p < 1 ||
      !Number.isInteger(s) ||
      s < 1 ||
      s > 50
    )
      fail(400, "分页参数错误");
    return [p, s];
  };
  function listing(req, isAdmin = false, mine = false) {
    const [p, s] = page(req),
      where = [],
      params = [];
    if (!isAdmin) {
      where.push(
        mine
          ? "p.status!='DELETED'"
          : "p.status='PUBLISHED' AND u.status='ACTIVE'",
      );
    }
    if (mine) {
      where.push("p.user_id=?");
      params.push(req.user.id);
    }
    if (req.query.q) {
      where.push("(p.title LIKE ? OR p.body LIKE ? OR u.nickname LIKE ?)");
      params.push(...Array(3).fill("%" + req.query.q + "%"));
    }
    if (req.query.tag) {
      where.push("EXISTS(SELECT 1 FROM json_each(p.tags) WHERE value=?)");
      params.push(String(req.query.tag));
    }
    if (req.query.topic) {
      where.push("p.topic_id=?");
      params.push(String(req.query.topic));
    }
    if (req.query.from && req.query.to && req.query.from > req.query.to)
      fail(400, "开始日期不能晚于结束日期");
    for (const [key, op] of [
      ["from", ">="],
      ["to", "<="],
    ])
      if (req.query[key]) {
        const value = req.query[key];
        const parsed = new Date(value + "T00:00:00Z");
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== value
        )
          fail(400, "日期格式错误");
        where.push(`date(p.created_at,'+8 hours') ${op} ?`);
        params.push(req.query[key]);
      }
    if (isAdmin && req.query.status) {
      where.push("p.status=?");
      params.push(String(req.query.status));
    }
    const base =
      " FROM posts p JOIN users u ON u.id=p.user_id" +
      (where.length ? " WHERE " + where.join(" AND ") : "");
    return {
      items: all(
        "SELECT p.*" +
          base +
          " ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?",
        ...params,
        s,
        (p - 1) * s,
      ).map((x) => mapped(x, req.user?.id)),
      page: p,
      pageSize: s,
      total: one("SELECT count(*) n" + base, ...params).n,
    };
  }
  const attempts = new Map();
  function limit(req, res, next) {
    const k = req.ip,
      t = Date.now();
    let v = attempts.get(k);
    if (!v || t - v.at > 600000) {
      v = { at: t, n: 0 };
      attempts.set(k, v);
    }
    if (++v.n > 40)
      return res
        .status(429)
        .json({ code: 429, message: "操作过于频繁，请稍后重试", data: null });
    next();
  }
  app.get("/api/health", (req, res) => ok(res, { status: "UP", name: "片刻" }));
  app.post("/api/auth/register", limit, (req, res) => {
    credentials(req.body);
    const nickname = text(req.body.nickname || req.body.username, 20);
    if (one("SELECT id FROM users WHERE username=?", req.body.username))
      fail(409, "账号已存在");
    const id = Number(
      run(
        "INSERT INTO users(username,nickname,password,created_at) VALUES(?,?,?,?)",
        req.body.username,
        nickname,
        hash(req.body.password),
        now(),
      ).lastInsertRowid,
    );
    ok(res, session(one("SELECT * FROM users WHERE id=?", id)));
  });
  app.post("/api/auth/login", limit, (req, res) => {
    credentials(req.body);
    const u = one("SELECT * FROM users WHERE username=?", req.body.username);
    if (!u || !verify(req.body.password, u.password) || u.status !== "ACTIVE")
      fail(401, "账号、密码错误或账号不可用");
    ok(res, session(u));
  });
  app.post("/api/auth/logout", auth, (req, res) => {
    run(
      "DELETE FROM sessions WHERE token=?",
      digest(req.headers.authorization.replace(/^Bearer /, "")),
    );
    ok(res, null);
  });
  app.get("/api/me", auth, (req, res) => ok(res, safe(req.user)));
  app.put("/api/me/password", auth, (req, res) => {
    credentials({ username: req.user.username, password: req.body.password });
    if (!verify(req.body.oldPassword || "", req.user.password))
      fail(400, "原密码错误");
    run(
      "UPDATE users SET password=? WHERE id=?",
      hash(req.body.password),
      req.user.id,
    );
    run("DELETE FROM sessions WHERE user_id=?", req.user.id);
    ok(res, null);
  });
  app.get("/api/me/posts", auth, (req, res) =>
    ok(res, listing(req, false, true)),
  );
  app.get("/api/topics", (req, res) =>
    ok(
      res,
      all(
        "SELECT t.*,(SELECT count(*) FROM posts p JOIN users u ON u.id=p.user_id WHERE p.topic_id=t.id AND p.status='PUBLISHED' AND u.status='ACTIVE') postCount FROM topics t ORDER BY id",
      ),
    ),
  );
  app.get("/api/tags", (req, res) =>
    ok(
      res,
      all(
        "SELECT j.value name,count(*) count FROM posts p JOIN users u ON u.id=p.user_id,json_each(p.tags) j WHERE p.status='PUBLISHED' AND u.status='ACTIVE' GROUP BY j.value ORDER BY count DESC LIMIT 20",
      ),
    ),
  );
  app.get("/api/posts", (req, res) => ok(res, listing(req)));
  app.get("/api/posts/:id", (req, res) =>
    ok(res, mapped(visible(req.params.id))),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024, files: 1 },
  });
  app.post("/api/media", auth, upload.single("file"), (req, res) => {
    const f = req.file;
    if (!f) fail(400, "请选择文件");
    const b = f.buffer;
    let ext, type;
    if (
      b.length > 8 &&
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) {
      ext = "png";
      type = "image";
    } else if (b[0] === 255 && b[1] === 216 && b[2] === 255) {
      ext = "jpg";
      type = "image";
    } else if (b.length > 12 && b.toString("ascii", 4, 8) === "ftyp") {
      ext = "mp4";
      type = "video";
    } else fail(400, "仅支持 JPEG、PNG 图片和 MP4 视频");
    if (type === "image" && b.length > 10 * 1024 * 1024)
      fail(400, "图片不能超过 10MB");
    const name = randomBytes(16).toString("hex") + "." + ext;
    writeFileSync(path.join(uploads, name), b);
    const url = "/uploads/" + name;
    const id = Number(
      run(
        "INSERT INTO media(user_id,url,type) VALUES(?,?,?)",
        req.user.id,
        url,
        type,
      ).lastInsertRowid,
    );
    ok(res, { id, url, type });
  });
  app.get("/uploads/:name", (req, res) => {
    const m = one(
      "SELECT m.*,p.status post_status,u.status user_status FROM media m LEFT JOIN posts p ON p.id=m.post_id LEFT JOIN users u ON u.id=p.user_id WHERE m.url=?",
      "/uploads/" + req.params.name,
    );
    if (!m) fail(404, "文件不存在");
    if (m.post_id) {
      if (m.post_status !== "PUBLISHED" || m.user_status !== "ACTIVE")
        fail(404, "文件不可见");
    } else {
      const t = String(req.query.token || "");
      const s = one(
        "SELECT user_id FROM sessions WHERE token=? AND expires_at>?",
        digest(t),
        now(),
      );
      if (s?.user_id !== m.user_id) fail(403, "无权访问此文件");
    }
    res.sendFile(path.join(uploads, req.params.name));
  });
  function save(req, id) {
    const b = req.body,
      title = text(b.title, 60),
      body = b.body ? text(b.body, 2000) : "";
    if (!Array.isArray(b.tags) || b.tags.length > 5) fail(400, "最多 5 个标签");
    const tags = [...new Set(b.tags.map((t) => text(t, 16)))];
    const media = b.mediaIds || [];
    if (
      !Array.isArray(media) ||
      media.length > 9 ||
      media.some((x) => !Number.isInteger(x)) ||
      new Set(media).size !== media.length
    )
      fail(400, "媒体参数错误");
    if (!body && !media.length) fail(400, "请添加文字或媒体");
    const files = media.map((mid) => {
      const m = one("SELECT * FROM media WHERE id=?", mid);
      if (!m || m.user_id !== req.user.id || (m.post_id && m.post_id !== id))
        fail(403, "媒体归属错误");
      return m;
    });
    if (files.some((x) => x.type === "video") && files.length !== 1)
      fail(400, "视频不能与其他媒体混发");
    const topic = b.topicId ? Number(b.topicId) : null;
    if (topic && !one("SELECT id FROM topics WHERE id=?", topic))
      fail(400, "主题不存在");
    db.exec("BEGIN");
    try {
      if (id) {
        run(
          "UPDATE posts SET title=?,body=?,tags=?,topic_id=?,updated_at=? WHERE id=?",
          title,
          body,
          JSON.stringify(tags),
          topic,
          now(),
          id,
        );
        run("UPDATE media SET post_id=NULL WHERE post_id=?", id);
      } else
        id = Number(
          run(
            "INSERT INTO posts(user_id,title,body,tags,topic_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
            req.user.id,
            title,
            body,
            JSON.stringify(tags),
            topic,
            now(),
            now(),
          ).lastInsertRowid,
        );
      for (const m of files)
        run("UPDATE media SET post_id=? WHERE id=?", id, m.id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return id;
  }
  app.post("/api/posts", auth, (req, res) => {
    const id = save(req);
    event(req.user, "POST_CREATE");
    ok(res, mapped(visible(id), req.user.id));
  });
  app.put("/api/posts/:id", auth, (req, res) => {
    const p = visible(req.params.id);
    if (p.user_id !== req.user.id) fail(403, "只能编辑自己的内容");
    const id = save(req, p.id);
    ok(res, mapped(visible(id), req.user.id));
  });
  app.delete("/api/posts/:id", auth, (req, res) => {
    const p = one("SELECT * FROM posts WHERE id=?", req.params.id);
    if (!p) fail(404, "内容不存在");
    if (p.user_id !== req.user.id) fail(403, "只能删除自己的内容");
    run("UPDATE posts SET status='DELETED' WHERE id=?", p.id);
    ok(res, null);
  });
  app.put("/api/posts/:id/rating", auth, (req, res) => {
    const p = visible(req.params.id);
    if (p.user_id === req.user.id) fail(403, "不能给自己的内容评分");
    const s = req.body.score;
    if (!Number.isInteger(s) || s < 1 || s > 5)
      fail(400, "分数须为 1-5 的整数");
    run(
      "INSERT INTO ratings(post_id,user_id,score) VALUES(?,?,?) ON CONFLICT(post_id,user_id) DO UPDATE SET score=excluded.score",
      p.id,
      req.user.id,
      s,
    );
    event(req.user, "RATING_UPSERT");
    ok(res, mapped(p, req.user.id));
  });
  app.get("/api/posts/:id/comments", (req, res) => {
    visible(req.params.id);
    const [p, s] = page(req);
    ok(res, {
      items: all(
        "SELECT c.id,c.body,c.user_id,u.nickname author,c.created_at FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? AND c.status='ACTIVE' ORDER BY c.id DESC LIMIT ? OFFSET ?",
        req.params.id,
        s,
        (p - 1) * s,
      ),
      total: one(
        "SELECT count(*) n FROM comments WHERE post_id=? AND status='ACTIVE'",
        req.params.id,
      ).n,
      page: p,
      pageSize: s,
    });
  });
  app.post("/api/posts/:id/comments", auth, (req, res) => {
    const p = visible(req.params.id);
    const body = text(req.body.body, 500);
    run(
      "INSERT INTO comments(post_id,user_id,body,created_at) VALUES(?,?,?,?)",
      p.id,
      req.user.id,
      body,
      now(),
    );
    event(req.user, "COMMENT_CREATE");
    ok(res, null);
  });
  app.delete("/api/comments/:id", auth, (req, res) => {
    const c = one("SELECT * FROM comments WHERE id=?", req.params.id);
    if (!c) fail(404, "评论不存在");
    if (c.user_id !== req.user.id && req.user.role !== "ADMIN")
      fail(403, "无权删除评论");
    run("UPDATE comments SET status='DELETED' WHERE id=?", c.id);
    ok(res, null);
  });
  app.use("/api/admin", auth, admin);
  app.get("/api/admin/users", (req, res) => {
    const [p, s] = page(req);
    const q = "%" + (req.query.q || "") + "%";
    ok(res, {
      items: all(
        "SELECT * FROM users WHERE username LIKE ? OR nickname LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?",
        q,
        q,
        s,
        (p - 1) * s,
      ).map(safe),
      total: one(
        "SELECT count(*) n FROM users WHERE username LIKE ? OR nickname LIKE ?",
        q,
        q,
      ).n,
      page: p,
      pageSize: s,
    });
  });
  const audit = (u, type, id, action) =>
    run(
      "INSERT INTO audit(admin_id,target_type,target_id,action,created_at) VALUES(?,?,?,?,?)",
      u.id,
      type,
      id,
      action,
      now(),
    );
  app.patch("/api/admin/users/:id", (req, res) => {
    const u = one("SELECT * FROM users WHERE id=?", req.params.id);
    if (!u) fail(404, "用户不存在");
    if (u.role === "ADMIN") fail(403, "不能修改管理员");
    if (!["ACTIVE", "DISABLED", "DELETED"].includes(req.body.status))
      fail(400, "状态错误");
    run("UPDATE users SET status=? WHERE id=?", req.body.status, u.id);
    run("DELETE FROM sessions WHERE user_id=?", u.id);
    audit(req.user, "USER", u.id, req.body.status);
    ok(res, null);
  });
  app.get("/api/admin/posts", (req, res) => ok(res, listing(req, true)));
  app.patch("/api/admin/posts/:id", (req, res) => {
    if (!one("SELECT id FROM posts WHERE id=?", req.params.id))
      fail(404, "内容不存在");
    if (!["PUBLISHED", "HIDDEN", "DELETED"].includes(req.body.status))
      fail(400, "状态错误");
    run("UPDATE posts SET status=? WHERE id=?", req.body.status, req.params.id);
    audit(req.user, "POST", req.params.id, req.body.status);
    ok(res, null);
  });
  app.get("/api/admin/audit", (req, res) =>
    ok(
      res,
      all(
        "SELECT a.*,u.nickname admin FROM audit a JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 100",
      ),
    ),
  );
  app.get("/api/admin/stats", (req, res) => {
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() + 8 * 3600000 - i * 86400000)
        .toISOString()
        .slice(0, 10);
      daily.push({
        date,
        users: one(
          "SELECT count(*) n FROM users WHERE role='USER' AND date(created_at,'+8 hours')=?",
          date,
        ).n,
        posts: one(
          "SELECT count(*) n FROM posts WHERE date(created_at,'+8 hours')=?",
          date,
        ).n,
        active: one(
          "SELECT count(DISTINCT user_id) n FROM events WHERE date(created_at,'+8 hours')=?",
          date,
        ).n,
      });
    }
    ok(res, {
      asOf: now(),
      totalUsers: one("SELECT count(*) n FROM users WHERE role='USER'").n,
      totalPosts: one("SELECT count(*) n FROM posts").n,
      totalComments: one(
        "SELECT count(*) n FROM comments WHERE status='ACTIVE'",
      ).n,
      activeToday: daily.at(-1).active,
      daily,
      tags: all(
        "SELECT j.value name,count(*) count FROM posts p,json_each(p.tags) j WHERE p.status='PUBLISHED' GROUP BY j.value ORDER BY count DESC LIMIT 8",
      ),
    });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ code: 404, message: "接口不存在", data: null }),
  );
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
  app.use((e, req, res, next) => {
    const status = e instanceof multer.MulterError ? 400 : e.status || 500;
    if (status === 500) console.error(e);
    res.status(status).json({
      code: status,
      message: status === 500 ? "服务暂不可用" : e.message,
      data: null,
    });
  });
  if (seed && !one("SELECT id FROM users LIMIT 1")) {
    const password =
      process.env.DEMO_PASSWORD || randomBytes(9).toString("base64url");
    for (const [username, nickname, role] of [
      ["admin", "片刻管理员", "ADMIN"],
      ["demo", "林间来信", "USER"],
      ["river", "沿河散步", "USER"],
    ])
      run(
        "INSERT INTO users(username,nickname,password,role,created_at) VALUES(?,?,?,?,?)",
        username,
        nickname,
        hash(password),
        role,
        now(),
      );
    run(
      "INSERT INTO topics(title,description,color) VALUES(?,?,?)",
      "收集一束光",
      "窗边、树下、回家路上。记录光落下的地方。",
      "#d4edb7",
    );
    run(
      "INSERT INTO topics(title,description,color) VALUES(?,?,?)",
      "校园慢半拍",
      "把赶路的时间，分一点给路边的风景。",
      "#e9dcf8",
    );
    for (const [i, title, body, tags] of [
      [
        1,
        "风把秋天，翻到了这一页",
        "午后的图书馆很安静。合上书的时候，阳光刚好落在手边。",
        ["校园", "光影"],
      ],
      [
        2,
        "下课以后，去看一场日落",
        "没有特别的安排，绕着操场走了两圈。原来普通的一天，也可以有很好的结尾。",
        ["日落", "散步"],
      ],
      [
        3,
        "一些不用着急的时刻",
        "今天试着把耳机摘下来，听到了树叶、脚步，还有远处篮球落地的声音。",
        ["日常", "校园"],
      ],
    ]) {
      run(
        "INSERT INTO posts(user_id,title,body,tags,topic_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        i === 2 ? 3 : 2,
        title,
        body,
        JSON.stringify(tags),
        1,
        new Date(Date.now() - (i - 1) * 86400000).toISOString(),
        now(),
      );
    }
    console.log(
      `首次演示账号 admin / demo / river，共用初始密码：${password}（仅本机显示，请自行保存）`,
    );
  }
  return { app, db };
}
