-- 拾光圈 T-004 初始表结构，适用于 MySQL 8.0.16+ 的空数据库。
-- 设计差异与待确认事项
-- 1. 对照 docs/02-architecture.md、docs/01-requirements.md 和 T-003 PR #103
--    的本地评审稿（bd3e936）。保留架构初稿的九张表。
-- 2. media 增加 uploader_id，post_id 允许为空，以支持先上传、后发布。
--    待确认媒体标识的最终类型及 T-011 实测上限。归属、限额和混发规则由服务端校验。
-- 3. activity_events 按 T-902 增加 event_id、actor_role、target_type、
--    target_id、recorded_at。事件时间由写入方按 UTC 传入，统计按北京时间归日。
--    业务时间列也由写入方显式赋值。其统一时区与查询边界待确认；
--    posts.created_at 拟记录首次成功发布时间，编辑或恢复不重置。
-- 4. users.status 暂按评审稿 ACTIVE / DISABLED / DELETED；最终账号标识、
--    状态转换和会话失效策略待确认。评论状态暂用 PUBLISHED / DELETED，
--    具体枚举及正文上限待确认。纯文字动态的 media_type 暂用 NULL。
-- 5. 用户、动态和评论按状态逻辑删除。管理端可见范围及恢复规则待确认。
--    外键限制物理删除。事件和管理操作的 target_type / target_id
--    可指向不同表，由服务端校验目标，历史行保留原目标标识。
-- 6. 用户名、标签采用表默认排序规则。最大长度、大小写和重音等价规则待确认。

-- 用户账号，保存密码哈希、角色与逻辑状态。
CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    username VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'USER',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username),
    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'DISABLED', 'DELETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户账号';

-- 动态正文及状态，正文可以为空，媒体由关联表提供。
CREATE TABLE posts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    author_id BIGINT NOT NULL,
    body VARCHAR(2000) NULL,
    media_type VARCHAR(16) NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_posts_author_id (author_id),
    KEY idx_posts_created_at (created_at),
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_posts_status CHECK (status IN ('PUBLISHED', 'HIDDEN', 'DELETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='动态';

-- 媒体先记录上传者，发布时关联动态；存储键由服务端生成。
CREATE TABLE media (
    id BIGINT NOT NULL AUTO_INCREMENT,
    post_id BIGINT NULL,
    uploader_id BIGINT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    mime_type VARCHAR(127) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_media_storage_key (storage_key),
    KEY idx_media_post_order (post_id, sort_order),
    KEY idx_media_uploader_id (uploader_id),
    CONSTRAINT fk_media_post FOREIGN KEY (post_id) REFERENCES posts (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_media_uploader FOREIGN KEY (uploader_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上传媒体';

-- 标签按名称去重。
CREATE TABLE tags (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(191) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_tags_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签';

-- 动态与标签的多对多关系，复合主键防止重复关联。
CREATE TABLE post_tags (
    post_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    KEY idx_post_tags_tag_id (tag_id),
    CONSTRAINT fk_post_tags_post FOREIGN KEY (post_id) REFERENCES posts (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_post_tags_tag FOREIGN KEY (tag_id) REFERENCES tags (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='动态与标签关联';

-- 同一用户对同一动态只有一条评分，重复评分更新原记录。
CREATE TABLE ratings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    score TINYINT UNSIGNED NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ratings_post_user (post_id, user_id),
    KEY idx_ratings_user_id (user_id),
    CONSTRAINT fk_ratings_post FOREIGN KEY (post_id) REFERENCES posts (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_ratings_score CHECK (score BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='动态评分';

-- 评论保留作者和删除状态，支持按动态读取可见评论。
CREATE TABLE comments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_comments_post_status_created (post_id, status, created_at),
    KEY idx_comments_user_id (user_id),
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_comments_status CHECK (status IN ('PUBLISHED', 'DELETED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='动态评论';

-- 活跃事件按事件编号去重，统计时按用户去重。
CREATE TABLE activity_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    event_id VARCHAR(36) NOT NULL,
    user_id BIGINT NOT NULL,
    actor_role VARCHAR(16) NOT NULL,
    action VARCHAR(32) NOT NULL,
    target_type VARCHAR(16) NOT NULL,
    target_id BIGINT NOT NULL,
    occurred_at DATETIME(6) NOT NULL COMMENT '业务成功时刻，UTC',
    recorded_at DATETIME(6) NOT NULL COMMENT '写入时刻，UTC',
    PRIMARY KEY (id),
    UNIQUE KEY uk_activity_events_event_id (event_id),
    KEY idx_activity_events_statistics (occurred_at, actor_role, user_id),
    KEY idx_activity_events_user_id (user_id),
    CONSTRAINT fk_activity_events_user FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_activity_events_actor_role CHECK (actor_role IN ('USER', 'ADMIN')),
    CONSTRAINT ck_activity_events_action_target CHECK (
        (action = 'LOGIN' AND target_type = 'USER')
        OR (action IN ('POST_CREATE', 'RATING_UPSERT') AND target_type = 'POST')
        OR (action = 'COMMENT_CREATE' AND target_type = 'COMMENT')
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='活跃事件';

-- 保留管理员、操作目标、动作及时间，供管理操作追溯。
CREATE TABLE admin_actions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    admin_id BIGINT NOT NULL,
    target_type VARCHAR(16) NOT NULL,
    target_id BIGINT NOT NULL,
    action VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_admin_actions_admin_created (admin_id, created_at),
    CONSTRAINT fk_admin_actions_admin FOREIGN KEY (admin_id) REFERENCES users (id)
        ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理操作记录';
