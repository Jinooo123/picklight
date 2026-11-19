# 服务端 API

Java 17 + Spring Boot 3.5 + MySQL 8。骨架由 T-005 建立，已验证可启动。

## 怎么跑起来

```bash
cd services/api

# 需要 JDK 17+ 与 Maven 3.9+
mvn spring-boot:run
```

启动后访问 <http://localhost:8080/api/v1/health>，返回：

```json
{"status":"UP","version":"0.1.0","time":"2026-11-20T02:24:25+08:00"}
```

用 IDEA 的话直接打开 `services/api` 目录，等依赖下载完，运行 `PicklightApplication` 即可。

## 数据库与密钥

`src/main/resources/application.yml` 只放通用配置。数据库账号、JWT 密钥这类本地配置：

1. 复制 `application-local.yml.example` 为 `application-local.yml`
2. 填自己的 MySQL 密码
3. 启动时加 `--spring.profiles.active=local`

`application-local.yml` 已被 `.gitignore` 忽略，不要提交。

## 包结构约定

```text
com.picklight
├── PicklightApplication.java   启动类
├── controller/                 只做参数校验与鉴权，不写业务
├── service/                    业务逻辑与事务边界
├── repository/                 数据访问（MyBatis-Plus Mapper）
├── domain/                     实体与枚举
└── common/                     统一响应、错误码、全局异常（T-401，梁文博）
```

接口统一前缀 `/api/v1`，返回结构 `{code, message, data}`，分页统一 `{items, page, pageSize, total}`——以 `docs/08-api-contract.md` 为准。

## 现在能做什么 / 还不能做什么

- 能：`mvn package` 通过、`mvn spring-boot:run` 启动、健康检查返回 200、有 1 个 MockMvc 测试
- 不能：连数据库、登录鉴权、任何业务接口

## 接手位置

| 任务 | 做什么 |
| --- | --- |
| T-401 统一响应与异常 | 新建 `common/Result`、`ErrorCode`、`BizException`、`GlobalExceptionHandler` |
| T-402 用户表 | `domain/user` + `repository` + `db/migration` |
| T-403/404 注册登录 | `controller/AuthController` |
| T-501/504 动态 | `controller/PostController`、`service/PostService` |

新增数据库依赖时在 `pom.xml` 里加 `mybatis-plus-spring-boot3-starter` 与 `mysql-connector-j`，并在 PR 里说明。
