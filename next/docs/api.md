# 片刻 API

前缀 `/api`。JSON成功响应 `{code:0,message:"成功",data:...}`；错误返回对应HTTP状态并使用 `{code:HTTP状态,message:"可读原因",data:null}`。认证为 `Authorization: Bearer <token>`。日期字段为UTC ISO8601，日期筛选按北京时间。ID为整数。

| 方法 | 路径 | 权限/输入 |
| --- | --- | --- |
| GET | /health | 公开 |
| POST | /auth/register | username(3-20字母数字下划线)、nickname(1-20字)、password(8-64位)；返回token,user |
| POST | /auth/login | username,password；返回token,user |
| POST | /auth/logout | 已登录；撤销当前会话 |
| GET | /me | 已登录；返回不含密码的本人资料 |
| PUT | /me/password | oldPassword,password；成功撤销所有会话 |
| GET | /me/posts | 已登录；自己的非删除内容分页 |
| GET | /topics | 主题列表，含公开内容数量 |
| GET | /tags | 最多20个公开内容标签及数量 |
| POST | /media | 已登录；multipart字段file；返回id,url,type |
| GET | /posts | page默认1，pageSize默认12最大50，q、tag、topic、from、to可选 |
| GET | /posts/:id | 公开内容详情；不可见返回404 |
| POST | /posts | 已登录；title(1-60字)、body(最多2000字)、tags(最多5个、每个1-16字)、topicId可空、mediaIds数组；正文与媒体至少一项 |
| PUT | /posts/:id | 作者；与发布相同完整字段，媒体重新绑定 |
| DELETE | /posts/:id | 作者；逻辑删除 |
| PUT | /posts/:id/rating | 已登录且非作者；score为1-5整数；返回更新后详情含平均分 |
| GET | /posts/:id/comments | 公开可见内容；分页 |
| POST | /posts/:id/comments | 已登录；body为1-500字 |
| DELETE | /comments/:id | 评论作者或管理员 |
| GET | /admin/users | 管理员；q按账号昵称检索，page/pageSize |
| PATCH | /admin/users/:id | 管理员；status为ACTIVE/DISABLED/DELETED |
| GET | /admin/posts | 管理员；公开列表的查询条件加status；含所有状态 |
| PATCH | /admin/posts/:id | 管理员；status为PUBLISHED/HIDDEN/DELETED |
| GET | /admin/stats | 管理员；totalUsers,totalPosts,totalComments,activeToday,daily,tags,asOf |
| GET | /admin/audit | 管理员；最近100条管理操作 |

分页返回 `{items,page,pageSize,total}`。内容返回title/body/tags/media、user_id、author、topic_id、status、created_at、updated_at及average/ratingCount/commentCount。创建、编辑与评分还会返回myScore。

文件 url 相对服务端根地址；未发布的上传文件须通过query token访问；发布后无需token。客户端不得把原始文件路径作为媒体ID。视频不能与其他媒体混发。

401需重新登录；403越权；404不可见/不存在；409账号重复；400校验失败；429登录注册频率过高；500服务故障。客户端不能把错误当0条数据。
