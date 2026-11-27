# Elsewhere 后端完成报告

更新日期为 2026 年 11 月 19 日。

## 当前项目及完成范围

前端为 React、TypeScript、Vite，已有账号页面、首页导航、足迹相册和照片编辑器。后端为 Spring Boot 3.5、Spring JDBC、Java 21，运行数据库已改为 MySQL 8.4。后端沿用已有的 BCrypt 密码、HttpOnly 会话 Cookie、Google/GitHub OAuth 和 PKCE 流程。

本次完成足迹查询、添加、编辑、删除、照片读取、浏览器旧记录导入，以及前端接口接入。省份和主题筛选继续在前端完成，筛选数据取自当前登录用户的后端相册。照片编辑器保留图片压缩、日期、城市、备注和主题选择，增加删除操作。

## 足迹接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/footprints` | 查询当前用户的相册 |
| GET | `/api/footprints/{id}` | 查询自己的足迹详情 |
| POST | `/api/footprints` | 新建足迹及照片 |
| PUT | `/api/footprints/{id}` | 更新照片、地点、日期、备注、主题 |
| DELETE | `/api/footprints/{id}` | 删除自己的足迹及存储照片 |
| GET | `/api/footprints/{id}/image` | 读取需要登录认证的上传照片 |
| POST | `/api/footprints/import` | 原浏览器记录事务导入，按原 ID 防止重复 |

身份取自现有会话 Cookie。所有记录查询和修改均带用户条件。无会话返回 401，访问他人足迹或照片返回 404，字段错误返回 400。上传照片与元数据在同一数据库事务保存，接口使用参数化 SQL。

新建和编辑沿用前端 PhotoDraft 格式，字段为 `image`、`province`、`city`、`date`、`note`、`themes`。`image.src` 接收编辑器压缩后的图片 data URL，保存后返回受保护的图片地址。省份限制为原有 34 个选项，主题限制为原有 7 个值。城市最多 120 字，备注最多 4000 字，日期可空并校验日历有效性。

浏览器可选择最大 20 MB 的 JPEG、PNG、WebP、AVIF 或 GIF，然后压缩到最长边 1120 像素。后端存储 JPEG、PNG、WebP 或 GIF，校验图片头和格式，压缩后单张最多 4 MB。原图在浏览器压缩后上传，存储对象是压缩后的照片。图片响应声明正确 MIME 类型，并禁用 MIME 猜测及缓存。

## 数据库设计

| 表 | 内容及关系 |
| --- | --- |
| users | 用户名、规范化用户名、BCrypt 密码摘要、创建时间 |
| auth_sessions | 会话令牌 SHA-256 摘要、用户外键、过期时间 |
| oauth_login_states | OAuth 提供方、一次性 state 摘要、PKCE verifier、过期时间 |
| oauth_identities | 提供方、应用 ID、外部用户 ID、本地用户外键。标识按字节精确匹配 |
| footprint_libraries | 每个账号的相册初始化标记，防止删除后重新生成内置条目 |
| footprints | 用户外键、地点、日期、备注、主题、内置图片路径或图片二进制、创建和更新时间 |
| footprint_imports | 用户及原浏览器 ID 的联合唯一记录，用于导入重试去重 |

照片二进制存储在 MySQL MEDIUMBLOB 中，适合当前课程项目的图片规模。业务响应提供照片 URL，列表响应不返回 Base64。照片与元数据同时提交和回滚，删除记录时同时删除存储的图片。

为延续已有相册，每个账号首次打开时建立原有 34 张内置省份照片条目。城市、日期、备注和主题初始为空，条目供用户编辑，不据此推断实际旅行经历。初始化通过账号行锁和唯一标记保证并发安全。

## 数据迁移

本次实际迁移来源为 `backend/data/elsewhere.mv.db`，迁入 2 个账号和 0 条 OAuth 绑定，保留原用户 ID、用户名、密码摘要和创建时间。备份位于忽略提交的 `backend/data/backups/`。会话在 MySQL 中重新登录生成。

仓库根目录 `data/elsewhere.mv.db` 是另一份旧库，具有不同的用户 ID 映射，仍保留在原位置。此次迁移采用当前后端的默认数据文件。若要合并另一份旧库，需要先确认冲突账号和 ID 的对应关系。

已迁移账号打开足迹时，会尝试导入浏览器 `elsewhere:footprints:v1:{用户ID}` 的原有修改和新增照片。导入按当前账号 ID 隔离，整批事务提交，重复执行不会重复新增或覆盖导入后的编辑。原 localStorage 数据保留。若旧照片来自开发环境本地文件夹，需要原本地文件夹服务可用，页面会先读取并压缩照片再导入。无法读取旧图时显示错误并保留原记录。

迁移工具为 `backend/tools/migrate-h2.ps1`，默认备份当前后端 H2 库，再以只读方式迁入空 MySQL 用户表。目标已有账号时会停止，事务失败时回滚。工具需要两种 JDBC 驱动，H2 仅作为测试和迁移依赖，运行 JAR 使用 MySQL。

## 启动和配置

数据库共享方案已更新，队友可直接安装 MySQL Server 8.4，默认连接 3306。本机 Docker 继续使用 13306，通过 `backend/.env` 的 `DB_URL` 指定。共享 SQL 导出和导入步骤见仓库根目录 README。

1. 启动 Docker Desktop，在 `backend/.env` 中配置 `DB_PASSWORD` 和 `MYSQL_ROOT_PASSWORD`。当前本机已生成此文件，Git 已忽略它。
2. 在 `backend/` 执行 `docker compose up -d --wait`，MySQL 映射到本机 13306，数据保存在 `elsewhere_elsewhere_mysql` 命名卷。
3. 在 `backend/` 执行 `mvn spring-boot:run`，或在 IDEA 运行 ElsewhereApplication。
4. 在仓库根目录执行 `npm run dev`。

`DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 可覆盖连接参数。默认用户为 elsewhere，连接时区为 UTC。OAuth 配置占位符读取本机忽略的 `backend/.env` 或进程环境变量，原本机凭据已移入该文件。

当前联调使用前端 `http://127.0.0.1:5175/` 和后端 18081。启动前端时设置 `BACKEND_URL=http://127.0.0.1:18081`，即可让 Vite 代理到该端口。默认前后端配置仍为 5173 和 8080。

OAuth 真实登录需要提供方控制台授权的回调地址匹配访问地址。原回调地址是 5173，本次 5175 预览验证使用账号密码登录。若持续使用 5175，需同步提供方回调白名单及 `GOOGLE_REDIRECT_URI`、`GITHUB_REDIRECT_URI`。本次 OAuth 流程通过模拟提供方的自动测试，未使用用户的 Google/GitHub 账号完成外部授权。

## 验证结果

| 验证 | 结果 |
| --- | --- |
| 前端生产构建 | `npm run build` 通过 |
| 前端自动测试 | 14 个文件、102 项测试通过 |
| 后端完整自动测试 | 9 项通过并成功打包 JAR |
| 真实 MySQL 测试 | FootprintFlowTest 的 3 项通过，使用独立 elsewhere_test 数据库，事务回滚测试记录 |
| 浏览器联调 | 5175 页面完成登录、加载相册、修改城市/日期/备注/主题、保存、返回首页后重新读取和主题筛选 |
| 覆盖场景 | 照片保存与读取、编辑、删除、无会话拒绝、他人账号读写拒绝、错误日期和假图片拒绝、旧数据导入去重、OAuth ID 大小写区分 |

浏览器联调用临时账号完成，验证后已清理该账号及其足迹。保留 MySQL 中迁入的两个账号。页面截图保存在 `C:/Users/10772/Documents/Codex/elsewhere-backend-verification.jpg`。

## 当前边界

Guides 和 Community 当前只有导航按钮，尚无对应业务页面。私信和 AI 标注尚无业务页面。本次后端覆盖已有账号和足迹业务，主题由用户选择。远程对象存储、原图归档和 AI 自动主题识别属于后续扩展。
