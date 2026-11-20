# API 契约

版本：统计子契约 V1（2026-11-20），负责人：许峻舆，任务：T-902（Issue #86）。

本文先交付可独立定义的统计与事件部分，供 T-003 合并评审。账号、动态、媒体等完整契约仍由 T-003 负责人补齐；下列统计接口是 T-606 的实现约定，目前尚未上线。

## 1. 通用约定

- 路径前缀 `/api/v1`，JSON 字段使用 camelCase。
- 成功为 HTTP 200，响应 `{ "code": 0, "message": "成功", "data": ... }`，与现有 `common/Result` 一致。
- 两个统计接口只允许有效管理员访问：未登录 HTTP 401 / code 40100，普通用户 HTTP 403 / code 40300；参数错误 HTTP 400 / code 40000。错误 data 为 null。
- 时间由服务端产生，按 `Asia/Shanghai`（UTC+08:00）统计。时间戳使用带偏移的 ISO 8601，日期使用 `YYYY-MM-DD`。
- 所有数量为非负整数，无数据返回 0；成功时不以 null 或缺字段表示 0。查询失败必须返回错误，不能伪装成空数据。

## 2. 统计口径（T-902）

### 2.1 时间范围

每次请求固定一个服务端快照时间 `asOf`。自然日为北京时间 00:00（含）至次日 00:00（不含）。查询当天时上界为 `asOf`（不含），只统计此前已提交数据。

默认近 7 日指今天及前 6 个自然日，不是滚动 168 小时。例如 `asOf=2026-11-20T15:00:00+08:00`，范围为 `[2026-11-14T00:00:00+08:00, asOf)`，今日数据尚未结束。响应必须附时区、范围和统计时间。

### 2.2 指标定义

| 字段 | 含义 | 精确计算口径 |
| --- | --- | --- |
| totalUsers | 累计注册用户数 | users 中 created_at < asOf 的普通用户数，含后来禁用、逻辑删除的用户；排除管理员 |
| totalPosts | 累计发布动态数 | posts 中 created_at < asOf 的已成功发布记录数，含后来 HIDDEN/DELETED 的记录；不包含草稿和发布失败 |
| newUsers | 区间新增用户 | 上述普通用户中 created_at 落在区间内的数量；禁用、恢复和删除不改变注册日期 |
| newPosts | 区间新增动态 | 上述成功发布记录中 created_at 落在区间内的数量；编辑、下架、恢复和删除不算新增 |
| activeUsers | 日活跃用户（DAU） | 自然日内至少有一条有效 LOGIN/POST_CREATE/COMMENT_CREATE/RATING_UPSERT 事件的普通用户，按 user_id 去重 |
| activeUsers7d | 近 7 日活跃用户 | 整个近 7 日区间按 user_id 去重；不能把 7 个 DAU 相加 |

累计指标用于观察历史使用量，不代表当前可见量。管理员操作不计入活跃，注册本身不算活跃；注册后若实际完成一次登录，可记录 LOGIN。游客浏览、刷新 token、读取列表、失败请求、编辑删除、后台管理均不产生活跃事件。

事件记录保留发生时的角色快照，只统计 `actor_role=USER`。普通用户后来禁用、删除或调整角色，不追溯抹除历史活跃。库表使用逻辑删除，查询累计和历史新增时须显式包含逻辑删除记录，不能直接使用默认排除删除记录的 Mapper 查询。

### 2.3 管理概览

`GET /api/v1/admin/stats/overview`，无参数。所有字段使用同一快照计算。

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "timezone": "Asia/Shanghai",
    "asOf": "2026-11-20T15:00:00+08:00",
    "startDate": "2026-11-14",
    "endDate": "2026-11-20",
    "totalUsers": 12,
    "totalPosts": 20,
    "newUsers7d": 3,
    "newPosts7d": 5,
    "activeUsers7d": 4,
    "activeUsersToday": 2
  }
}
```

`newUsers7d`、`newPosts7d` 分别为区间 newUsers、newPosts。`activeUsersToday` 为今天的 DAU。空库保留上述全部字段，数量全部为 0。

### 2.4 每日趋势

`GET /api/v1/admin/stats/daily?startDate=2026-11-14&endDate=2026-11-20`

- 两个参数均省略时默认近 7 日；指定时必须同时提供。
- 接受严格有效的 `YYYY-MM-DD` 日期，startDate ≤ endDate ≤ 今天，含首尾最多 31 天；违反任一条件返回 HTTP 400。
- 返回每天一项，按 date 升序，无数据的日子补 0。无需分页。范围覆盖当天时，以 asOf 为上界。

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "timezone": "Asia/Shanghai",
    "asOf": "2026-11-20T15:00:00+08:00",
    "startDate": "2026-11-19",
    "endDate": "2026-11-20",
    "items": [
      { "date": "2026-11-19", "newUsers": 0, "newPosts": 0, "activeUsers": 0 },
      { "date": "2026-11-20", "newUsers": 1, "newPosts": 2, "activeUsers": 2 }
    ]
  }
}
```

示例对应查询 11/19 至 11/20，不表示默认 7 日响应。overview 与 daily 为独立请求，asOf 可能不同；前端不得要求正在变化的当天数量严格一致。

## 3. 活跃事件定义（T-604 的输入）

事件只能由后端在身份验证和业务成功后生成，客户端不提供 user_id、角色或发生时间。事件表为内部数据，不开放公共写入接口。

| action | 记录时机 | target_type / target_id |
| --- | --- | --- |
| LOGIN | 凭据验证、账号状态检查通过且成功签发登录令牌；不含刷新令牌 | USER / 登录用户 id |
| POST_CREATE | 首次发布事务提交成功，每条动态一次 | POST / 新动态 id |
| COMMENT_CREATE | 评论事务提交成功，每条新评论一次 | COMMENT / 新评论 id |
| RATING_UPSERT | 新增或更新评分事务提交成功；同分成功提交也算一次操作 | POST / 被评分动态 id |

### 3.1 字段与约束

以下为逻辑字段，物理列命名用 snake_case，由 T-004/T-604 落地迁移；不在本任务提前创建库表。

| 字段 | 类型建议 | 约束与用途 |
| --- | --- | --- |
| id | BIGINT | 主键 |
| eventId | VARCHAR(36) | 后端生成 UUID，唯一；同一事件投递重试沿用原值 |
| userId | BIGINT | 非空，来自认证身份 |
| actorRole | VARCHAR(16) | 非空，发生时角色快照 USER/ADMIN；活跃事件只记录 USER |
| action | VARCHAR(32) | 非空，只允许上表四种值 |
| targetType | VARCHAR(16) | 非空，USER/POST/COMMENT |
| targetId | BIGINT | 非空，来自成功业务结果 |
| occurredAt | DATETIME(6) | 非空，业务成功时刻；统一保存 UTC，按北京时间转日 |
| recordedAt | DATETIME(6) | 非空，入库时刻；排查延迟，不用于统计归日 |

建议索引 `(occurred_at, actor_role, user_id)` 和唯一索引 `event_id`。不要给 `(user_id, 日期)` 加唯一约束：同一天可有多种操作，DAU 在查询时去重。不同成功请求生成不同 eventId，同一事件的重试不得重复插入。评分唯一键 `(post_id,user_id)` 与事件去重是两件事。

### 3.2 事务、故障与一致性

发布、评论、评分在事务提交后写事件，回滚不留事件。采用提交后监听或独立事务并捕获写入异常，记录 eventId、action 和异常日志，不影响已成功的主业务；登录记录失败也不阻断登录。不得记录密码、token 或评论正文。

首版按成功落库事件统计，事件写入失败可能导致活跃少计，延迟写入会使历史数据补增；页面显示 asOf，不宣称强一致或实时精确审计。新增用户和动态直接按业务表计数，不依赖事件，因此埋点失败不影响新增量。若以后要求可靠投递，再单独设计 outbox，不在本任务引入队列。

## 4. 后台看板显示约定（T-705）

- 四张主卡：累计注册用户 totalUsers、累计发布动态 totalPosts、近 7 日新增用户 newUsers7d、今日活跃用户 activeUsersToday。不得使用含义不清的「近 7 日新增」。
- 趋势显示每日新增用户 newUsers、新增动态 newPosts、活跃用户 activeUsers；如增加 7 日活跃卡，使用 activeUsers7d，不能累加 DAU。
- 常驻说明：北京时间自然日统计，近 7 日含今天；活跃为成功登录、发布、评论或评分的普通用户去重数；累计含后来禁用/删除用户及下架/删除动态，排除管理员；今日尚未结束，活跃事件可能延迟或漏记。
- 接口接入后显示服务端 asOf。等待加载显示加载态，失败显示重试，空数据才显示 0；当前骨架继续显示「—」。

## 5. 后续实现验收样例（T-608）

下列为测试设计，当前不代表接口测试已执行。

| 场景 | 预期 |
| --- | --- |
| 空库，默认查询 | overview 所有数量为 0；daily 连续 7 项，各指标为 0 |
| U1 同日登录两次、发布、评论、评分；U2 仅评分；管理员登录 | 当日 DAU=2；U1 的多次事件仍可保留 |
| U1 连续两天活跃，U2 仅第二天活跃 | 两天 DAU 为 1、2；区间去重活跃=2，不是 3 |
| 11/19 23:59:59+08:00 与 11/20 00:00:00+08:00 的事件 | 分别计入 11/19 和 11/20；以 occurredAt 而非 recordedAt 归日 |
| 注册 U1，随后禁用、逻辑删除；发布 P1 后编辑、下架、删除 | 累计用户与累计动态各加 1，新增只计首次创建日；历史数据不因治理减少 |
| 登录失败、发布回滚、越权评论、评分不在 1-5 | 不产生活跃事件，不增加新增量 |
| 同一 eventId 重投；同一评分两次成功修改 | 重投只保留一条；两次评分可有两条不同事件，DAU 仍为 1 |
| 埋点写入异常 | 主业务成功且有日志；新增按业务表计数，活跃按实际事件计数 |
| 日期非法、只传一个日期、倒置、未来日期、超过 31 天 | HTTP 400；合法 31 天可查，缺失日期补 0 |
| 未登录、普通用户访问统计 | 分别 HTTP 401/403，不能泄露统计数据 |

## 6. 交接

- T-003（梁文博）：合并评审本文的统计子契约，补全其余 API；确认字段后同步两端。
- T-004：确认逻辑删除保留历史记录、发布时间语义、UTC 时间存储及事件字段和索引。
- T-604/T-606/T-608（许峻舆）：按本文实施事件、查询与上述测试。
- T-705（黄佳佳）：使用第 4 节文案与字段，后台骨架已同步口径说明。

本任务交付的是统计定义与接口约定，未实现评分、评论、统计查询或数据库迁移。

## 7. T-003 全局约定

本节至第 14 节为联合评审稿。第 1–6 节为许峻舆交付的 T-902 统计子契约。接口标题均省略 `/api/v1` 前缀。业务请求体默认使用 JSON，上传使用 multipart/form-data。路径中的 id 为正整数。登录后发送 `Authorization: Bearer <token>`，由服务端校验身份、角色、账号状态和资源归属。管理员接口统一要求有效 ADMIN 身份。所有示例中的账号、令牌和媒体链接仅供说明。

### 7.1 响应和错误

- HTTP 200 成功体统一为 `{"code":0,"message":"成功","data":...}`，无业务数据时 `data:null`。
- 失败同样使用 `code/message/data`。普通业务错误的 data 为 null。按 T-401，字段校验错误（HTTP 400 / 40001）的 data 为字段名到第一条可读错误的映射。参数类型不匹配（400 / 40000）的 data 可为参数名字符串。错误详情放在 data 内。统计错误仍按第 1 节返回 null。
- HTTP 400 表示输入或请求格式错误，401 表示未登录、会话失效或凭据错误，403 表示权限不足或账号禁用，404 表示资源不存在或公开不可见，409 表示状态或唯一性冲突，500 表示未预期的服务端异常。通用业务码依次为 40000、40100、40300、40400、40900、50000。页面使用业务 code 判断分支，使用 message 显示提示。

### 7.2 分页和查询

- 分页查询统一使用正整数 page、pageSize。提案为从第 1 页起，默认第 1 页、每页 20 条，取值上限待组内确认。参数非法返回 HTTP 400。返回 `data.items/page/pageSize/total`，total 为筛选后的总数。空结果或越界页返回空 items 数组，保留页码和总数。统计 daily 沿用按日期区间返回，无需分页。
- JSON 字段使用 camelCase，业务时间戳用带偏移的 ISO 8601。日期参数使用 YYYY-MM-DD，首尾都包含。拟按北京时间自然日解释，只传一端时使用开放区间。标签筛选示例为 `?tags=校园&tags=摄影`。日期单端语义、时区和查询编码待组内确认。
- 示例中的字段名、类型和承载方式为评审提案，详见第 14 节。接口示例描述预期行为，供两端联调和各实现任务验收。

## 8. 账号

### 8.1 `POST /auth/register`

**请求**　游客。JSON 必填 username（字符串，当前按唯一用户名示例）、password（字符串，8–25 位）。首周演示要求注册成功自动登录，成功体与登录一致。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"token":"example-token","user":{"id":42,"username":"xiaoming","role":"USER","status":"ACTIVE"}}}
```

**错误响应示例**

- HTTP 409 `{"code":40901,"message":"用户名已被占用","data":null}`
- HTTP 400 `{"code":40001,"message":"参数校验失败","data":{"password":"密码长度须为 8–25 位"}}`

### 8.2 `POST /auth/login`

**请求**　游客。JSON 必填 username、password（字符串）；管理端共用此接口，管理接口仍由服务端检查 ADMIN 权限。凭据错误统一提示。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"token":"example-token","user":{"id":42,"username":"xiaoming","role":"USER","status":"ACTIVE"}}}
```

**错误响应示例**

- HTTP 401 `{"code":40101,"message":"用户名或密码错误","data":null}`
- HTTP 403 `{"code":40301,"message":"账号已被禁用","data":null}`

### 8.3 `GET /me`

**请求**　登录用户。无路径参数、查询参数和请求体；身份取自 Bearer token。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":42,"username":"xiaoming","role":"USER","status":"ACTIVE"}}
```

**错误响应示例**

- HTTP 401 `{"code":40100,"message":"未登录或登录已过期","data":null}`
- HTTP 403 `{"code":40301,"message":"账号已被禁用","data":null}`

### 8.4 `PUT /me/password`

**请求**　登录用户。JSON 必填 oldPassword、newPassword（字符串，新密码 8–25 位且不能与旧密码相同）。成功后旧 token 不得继续用于受保护操作，客户端重新登录。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":null}
```

**错误响应示例**

- HTTP 400 `{"code":40002,"message":"旧密码不正确","data":null}`
- HTTP 400 `{"code":40001,"message":"参数校验失败","data":{"newPassword":"新密码不能与旧密码相同"}}`

退出登录属于 FR-01。待组内确认客户端清除登录态是否足够，以及是否需要服务端撤销 token。退出路径和响应随决策冻结。

## 9. 动态

### 9.1 `GET /posts`

**请求**　查询 page、pageSize，可选 startDate、endDate（YYYY-MM-DD，含首尾）、tags（标签名称，示例以重复查询参数传递）。日期与标签取交集，多标签全部匹配；仅返回 PUBLISHED，按 createdAt 倒序。无请求体。游客权限待组内确认。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"items":[{"id":101,"authorId":42,"body":"校园随手拍","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:00:00+08:00"}],"page":1,"pageSize":20,"total":1}}
```

**错误响应示例**

- HTTP 400 `{"code":40000,"message":"日期区间无效","data":null}`
- HTTP 500 `{"code":50000,"message":"服务内部错误","data":null}`

### 9.2 `GET /posts/{id}`

**请求**　路径 id（正整数，动态 ID）。无查询参数及请求体。公开详情仅返回 PUBLISHED；游客权限待组内确认。评分、评论计数无数据时为 0。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":101,"authorId":42,"body":"校园随手拍","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:00:00+08:00","averageScore":0,"ratingCount":0,"commentCount":0}}
```

**错误响应示例**

- HTTP 400 `{"code":40000,"message":"动态 ID 无效","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 9.3 `POST /posts`

**请求**　登录用户。JSON 可含 body（字符串，最长 2000 字）、tags（字符串数组，去重后 0–5 个）、mediaIds（媒体标识数组）。正文与媒体至少一项非空；多图或单视频，不混发。仅引用本人上传的媒体，失败时整体回滚。例如 `{"body":"校园随手拍","tags":["校园"],"mediaIds":[81]}`。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":101,"authorId":42,"body":"校园随手拍","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:00:00+08:00","averageScore":0,"ratingCount":0,"commentCount":0}}
```

**错误响应示例**

- HTTP 400 `{"code":40000,"message":"正文和媒体不能同时为空","data":null}`
- HTTP 403 `{"code":40300,"message":"不能引用他人上传的媒体","data":null}`

### 9.4 `PUT /posts/{id}`

**请求**　作者。路径 id（正整数）；JSON 提交编辑后的完整 body、tags、mediaIds，类型和约束同发布，清空可用空字符串或空数组，整体仍需有正文或媒体。成功后列表与详情一致。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":101,"authorId":42,"body":"更新后的正文","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:30:00+08:00","averageScore":0,"ratingCount":0,"commentCount":0}}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 9.5 `DELETE /posts/{id}`

**请求**　作者。路径 id（正整数），无查询参数及请求体。按当前逻辑删除方案处理，公开列表和详情不再可见。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":null}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 9.6 `GET /me/posts`

**请求**　登录用户。查询 page、pageSize，可选 status（PUBLISHED、HIDDEN、DELETED）。身份取自 token，仅返回本人记录，按当前设计可查看各状态。无请求体。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"items":[{"id":101,"authorId":42,"body":"校园随手拍","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:00:00+08:00"}],"page":1,"pageSize":20,"total":1}}
```

**错误响应示例**

- HTTP 401 `{"code":40100,"message":"未登录或登录已过期","data":null}`
- HTTP 400 `{"code":40000,"message":"动态状态无效","data":null}`

### 9.7 `GET /tags`

**请求**　登录用户。无路径参数、查询参数和请求体。返回可供筛选的标签名称；无标签时为空数组。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":["校园"]}
```

**错误响应示例**

- HTTP 401 `{"code":40100,"message":"未登录或登录已过期","data":null}`
- HTTP 500 `{"code":50000,"message":"服务内部错误","data":null}`

## 10. 媒体

### 10.1 `POST /media/uploads`

**请求**　登录用户。multipart/form-data 必填 file（二进制，单次一个文件）。T-502 任务列出 jpg/png/webp/mp4 白名单；最终格式和限制以 T-011 实测及评审为准。超限或不支持文件拒绝落盘；服务端生成标识和可访问 URL。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}}
```

**错误响应示例**

- HTTP 400 `{"code":40010,"message":"文件超出大小限制","data":null}`
- HTTP 400 `{"code":40011,"message":"不支持的文件类型","data":null}`

## 11. 评分评论

### 11.1 `PUT /posts/{id}/rating`

**请求**　登录用户。路径 id（正整数，动态 ID）；JSON 必填 score（1–5 的整数）。只能给他人的动态评分；同用户同动态重复提交覆盖原分值，返回最新平均分与人数。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"averageScore":4,"ratingCount":1}}
```

**错误响应示例**

- HTTP 400 `{"code":40003,"message":"评分须在 1-5 之间","data":null}`
- HTTP 403 `{"code":40302,"message":"不能给自己的动态评分","data":null}`

### 11.2 `GET /posts/{id}/comments`

**请求**　路径 id（正整数，动态 ID）；查询 page、pageSize；无请求体。仅返回公开可见动态下未删除的评论。游客读取权限与动态详情一致，待组内确认。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"items":[{"id":301,"postId":101,"authorId":43,"body":"拍得不错","createdAt":"2026-11-20T10:00:00+08:00"}],"page":1,"pageSize":20,"total":1}}
```

**错误响应示例**

- HTTP 400 `{"code":40000,"message":"分页参数无效","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 11.3 `POST /posts/{id}/comments`

**请求**　登录用户。路径 id（正整数，动态 ID）；JSON 必填 body（非空字符串，长度上限待组内确认）。仅可对可见动态发表评论。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":301,"postId":101,"authorId":43,"body":"拍得不错","createdAt":"2026-11-20T10:00:00+08:00"}}
```

**错误响应示例**

- HTTP 401 `{"code":40100,"message":"未登录或登录已过期","data":null}`
- HTTP 400 `{"code":40001,"message":"参数校验失败","data":{"body":"评论不能为空"}}`

### 11.4 `DELETE /comments/{id}`

**请求**　评论作者。路径 id（正整数，评论 ID）；无查询参数及请求体。管理员处理评论使用管理接口。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":null}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

若启用 FR-10，发布和编辑正文以及发表评论时，服务端命中敏感词应拒绝写入并返回明确提示。是否启用及业务错误码待组内确认。

## 12. 管理

### 12.1 `GET /admin/users`

**请求**　管理员。查询 page、pageSize，可选 username（字符串）、status（账号状态）、role（USER 或 ADMIN）。筛选条件可组合。无请求体。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"items":[{"id":42,"username":"xiaoming","role":"USER","status":"ACTIVE"}],"page":1,"pageSize":20,"total":1}}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 400 `{"code":40000,"message":"角色筛选值无效","data":null}`

### 12.2 `PATCH /admin/users/{id}/status`

**请求**　管理员。路径 id（正整数，用户 ID）；JSON 必填 status，示例值 ACTIVE（恢复）、DISABLED（禁用）、DELETED（逻辑删除）。操作记录操作者、对象、动作与时间。禁用后拒绝旧 token，恢复后允许重新登录。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":42,"username":"xiaoming","role":"USER","status":"DISABLED"}}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 12.3 `GET /admin/posts`

**请求**　管理员。查询 page、pageSize，可选 authorId（正整数）、startDate、endDate（YYYY-MM-DD，含首尾）、tags（同动态列表）、status（PUBLISHED、HIDDEN、DELETED）。条件可组合。无请求体。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"items":[{"id":101,"authorId":42,"body":"校园随手拍","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:00:00+08:00"}],"page":1,"pageSize":20,"total":1}}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 400 `{"code":40000,"message":"日期区间无效","data":null}`

### 12.4 `GET /admin/posts/{id}`

**请求**　管理员。路径 id（正整数，动态 ID）；可选 commentPage、commentPageSize（评论分页，规则同 page、pageSize）。无请求体。详情供后台查看正文、媒体及评论，可查看下架或逻辑删除的动态；管理详情路径和评论承载方式待组内确认。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":101,"authorId":42,"body":"校园随手拍","tags":["校园"],"media":[{"id":81,"url":"https://media.example.com/81.jpg","mediaType":"IMAGE"}],"status":"PUBLISHED","createdAt":"2026-11-20T10:00:00+08:00","updatedAt":"2026-11-20T10:00:00+08:00","averageScore":0,"ratingCount":0,"commentCount":1,"comments":{"items":[{"id":301,"postId":101,"authorId":43,"body":"拍得不错","createdAt":"2026-11-20T10:00:00+08:00"}],"page":1,"pageSize":20,"total":1}}}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 12.5 `PATCH /admin/posts/{id}/status`

**请求**　管理员。路径 id（正整数，动态 ID）；JSON 必填 status（HIDDEN 下架、PUBLISHED 恢复、DELETED 逻辑删除）。状态变更写管理操作记录；下架或逻辑删除后公开接口不可见。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":{"id":101,"status":"HIDDEN"}}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

### 12.6 `DELETE /admin/comments/{id}`

**请求**　管理员。路径 id（正整数，评论 ID）；无查询参数及请求体。管理员可删除违规评论并记录操作。

**成功响应（HTTP 200）**

```json
{"code":0,"message":"成功","data":null}
```

**错误响应示例**

- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 404 `{"code":40400,"message":"资源不存在","data":null}`

## 13. 统计接口补充示例

### 13.1 `GET /admin/stats/overview`

请求无参数和请求体。成功响应见第 2.3 节。

**错误响应示例**

- HTTP 401 `{"code":40100,"message":"未登录或登录已过期","data":null}`
- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`

### 13.2 `GET /admin/stats/daily`

请求无请求体。第 2.4 节的成功响应对应 `?startDate=2026-11-19&endDate=2026-11-20`，两项均省略时返回默认近 7 日。

**错误响应示例**

- HTTP 401 `{"code":40100,"message":"未登录或登录已过期","data":null}`
- HTTP 403 `{"code":40300,"message":"无权限执行此操作","data":null}`
- HTTP 400 `{"code":40000,"message":"startDate 和 endDate 必须同时提供","data":null}`

## 14. 待组内确认与签字

| 待组内确认 | 评审事项 |
| --- | --- |
| 账号与登录态 | 账号标识最终形式、注册后的登录响应字段、token 有效期、退出是否需服务端撤销、改密与禁用后的会话失效方案、账号状态枚举及允许的状态转换。 |
| 浏览与删除 | 是否开放游客读动态、详情和评论。若只允许登录用户浏览，未登录返回 401。删除按需求的默认逻辑删除方案拟定，管理端可见范围和最终验收策略待确认。 |
| 媒体 | 根据 T-011 实测确定图片张数、单文件体积、视频时长和格式，确认媒体 ID 类型及上传字段。 |
| 查询与管理详情 | 页码起点、默认值、每页上限、标签参数编码、业务日期时区和单端范围语义，管理详情路径与评论分页承载方式。 |
| 请求与响应字段 | 冻结评审稿中的字段和响应示例，确认评论长度、是否启用 FR-10 及对应错误码。 |

前后端三方评审后填写确认人、日期和结论，并将确认后的契约同步小程序与管理 Web。

| 确认方 | 确认人 | 日期 | 结论 |
| --- | --- | --- | --- |
| 服务端 |  |  | 待确认 |
| 微信小程序 |  |  | 待确认 |
| 管理 Web |  |  | 待确认 |
