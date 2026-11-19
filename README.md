# Elsewhere

## MySQL 数据库共享（小组使用）

组员安装 **MySQL Server 8.4**，默认端口 **3306**。项目保留 Spring Boot + MySQL 架构。

### 首次拉取和导入

1. 安装 Java 21 或更新版本、Maven、Node.js 和 MySQL Server 8.4，然后 `git pull`。
2. 执行 `mysql -u root -p`，在 MySQL 提示符运行下面的 SQL，将密码占位值替换为自己的本机密码。

```sql
CREATE DATABASE IF NOT EXISTS elsewhere CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'elsewhere'@'localhost' IDENTIFIED BY '替换为自己的本机密码';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, REFERENCES, INDEX ON elsewhere.* TO 'elsewhere'@'localhost';
EXIT;
```

已有用户的密码由本机管理员管理，`CREATE USER IF NOT EXISTS` 会保留原密码。

3. 从项目根目录复制配置示例。已有 `backend/.env` 时直接编辑该文件，保留自己的其他配置。

```powershell
Copy-Item backend/.env.example backend/.env
```

在 `backend/.env` 填写自己的连接参数。

```properties
DB_URL=jdbc:mysql://127.0.0.1:3306/elsewhere?characterEncoding=UTF-8&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true
DB_USERNAME=elsewhere
DB_PASSWORD=填写自己的本机密码
```

4. 从项目根目录运行导入工具。首次会由 Maven 准备项目 JDBC 依赖。

```powershell
./backend/tools/share-db.ps1 -Action Import
```

这会导入 `database/shared.sql` 中七张表的完整结构。随后启动后端和前端，在页面注册自己的账号。默认后端 8080，前端 5173。

```powershell
cd backend
mvn spring-boot:run
```

另开终端，从项目根目录运行 `npm ci` 和 `npm run dev`。注册后，可以将共享开发初始数据关联到本机账号。

```powershell
./backend/tools/share-db.ps1 -Action Import -OwnerUsername your_username
```

把 `your_username` 换成本机已注册的用户名。工具按用户名查找本机用户 ID，跳过已有同 ID 记录。首次打开足迹也会自动生成原有 34 张内置照片，已经生成时导入会保留它们及本机编辑。

### 导出并通过 GitHub 共享

`database/shared.sql` 包含七张表的定义和开发初始数据。初始数据来自 `database/dev-seeds.json`，当前为 34 张项目内置省份照片，城市、日期、备注和主题为空。需要共享其他开发文案时，先编辑 JSON 并确认内容可公开，再执行导出。

```powershell
./backend/tools/share-db.ps1 -Action Export
git diff -- database/shared.sql database/dev-seeds.json
git add database/shared.sql database/dev-seeds.json
git commit -m "chore: update shared development database SQL"
git push
```

工具只从当前 MySQL 读取表结构，真实表记录的导出数量固定为 0。真实账号、密码摘要、会话令牌、OAuth 绑定/state/PKCE、私人照片二进制及私人备注均留在本机。共享图片只引用仓库 `public/images/carousel/` 中的公开资源。表结构变更时同步维护 Spring Boot 的 `backend/src/main/resources/schema.sql`。

队友拉取后运行下面的命令。

```powershell
git pull
./backend/tools/share-db.ps1 -Action Import -OwnerUsername your_username
```

导入会建立缺失表并增量添加初始数据，重复执行不会重复新增或覆盖本机记录。SQL 使用 `CREATE TABLE IF NOT EXISTS`，已有表的字段变更需要单独审核的增量迁移。已有足迹的内容更新由组员在页面确认修改。

也可使用 MySQL Command Line Client 导入，将 `SOURCE` 路径改为项目的绝对路径。

```sql
USE elsewhere;
SET @shared_owner_username = 'your_username';
SOURCE C:/path/to/Elsewhere/database/shared.sql;
```

首次只建表时把 `@shared_owner_username` 设为 `NULL`。导入初始数据前须注册对应账号。优先使用项目工具，它会检查账号并报告新增记录数。

### 可选 Docker Compose

本机已有 Docker 的组员可在 `backend/` 运行 `docker compose up -d --wait`。原 Compose 的 MySQL 8.4、**13306** 端口和 `elsewhere_elsewhere_mysql` 数据卷继续使用。Docker 用户在 `backend/.env` 中设置 `MYSQL_ROOT_PASSWORD`、`DB_PASSWORD`，并把 `DB_URL` 的端口设为 13306。本机现有配置已保留该地址。导出、导入命令与直接安装 MySQL 的组员相同。

### 敏感数据与 Git

数据库密码及 OAuth 凭据填写在被忽略的 `backend/.env` 中，系统环境变量也可覆盖 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 等参数。Spring Boot 从项目根目录或 `backend/` 启动时都会读取该文件。`backend/.env.example` 仅包含占位值。

Git 已忽略 `.env`、H2 `.mv.db`/`.trace.db`、`backend/data/` 和 `database/private/`。旧 `data/elsewhere.mv.db` 已取消 Git 跟踪，本机文件保留。私人完整备份放在 `database/private/`。提交前检查 `git diff --cached`。

历史提交中已出现的 OAuth Secret 和数据库文件仍可能存在于 Git 历史。取消跟踪影响后续提交，已分享的旧 Secret 应在提供方控制台轮换，历史清理由小组另行协调。

A travel authentication demo with signup/login, a timed destination carousel, and a liquid airplane-runway transition. A small Spring Boot service now handles real accounts and sessions.

## Run locally

```bash
npm install
npm run dev
```

Start the backend first (see below), then open the URL printed by Vite. The login page is always shown first when the app opens.

## Backend (IntelliJ IDEA)

Open `backend/pom.xml` as a Maven project in IDEA. Use Java 21 or newer. Run `ElsewhereApplication`, then run the Vite frontend. Vite forwards `/api` to `http://localhost:8080`.

The backend defaults to MySQL Server 8.4 at `127.0.0.1:3306/elsewhere`. Docker users set `DB_URL` to port 13306 in their local `backend/.env`. See the team database setup above. Passwords are stored as BCrypt hashes, with an HttpOnly session cookie after registration or login. Sessions last seven days and their SHA-256 token hashes remain in the local database.

For a classroom demo, set `ELSEWHERE_DEMO_USERS=true` and `ELSEWHERE_DEMO_PASSWORD` to a password of at least eight characters before starting the backend. This creates four users once: `traveler`, `atlas`, `rivers`, and `skyline`. Demo users are disabled by default.

Run `mvn test` from `backend/` to verify the API. `POST /api/auth/register` expects `{ "username": "traveler", "password": "at least 8 characters", "agreementAccepted": true }`. `POST /api/auth/login` expects username and password. `GET /api/auth/me` checks the session; `POST /api/auth/logout` ends it. The frontend calls these APIs and starts its existing transition only after successful authentication.

## GitHub and Google login

The GitHub and Google buttons use the backend OAuth authorization-code flow. Configure `CLIENT_ID_GITHUB`, `CLIENT_SECRET_GITHUB`, `CLIENT_ID_GOOGLE`, and `CLIENT_SECRET_GOOGLE` in the ignored `backend/.env` or backend process environment. The current local credentials have been retained in that file. Restart the backend after changing them.

Register these exact callback URLs in a GitHub OAuth App and a Google OAuth **Web application** client:

| Provider | Local callback URL | Optional override |
| --- | --- | --- |
| GitHub | `http://127.0.0.1:5173/api/auth/oauth/github/callback` | `GITHUB_REDIRECT_URI` |
| Google | `http://127.0.0.1:5173/api/auth/oauth/google/callback` | `GOOGLE_REDIRECT_URI` |

Open the app at `http://127.0.0.1:5173/` when using those defaults. `localhost` and `127.0.0.1` have different browser cookies: if you choose `localhost`, set both redirect URI overrides to the matching `localhost` URL and register those URLs with the providers. Production callbacks must use the site's HTTPS origin, with `/api/` routed to the backend. GitHub's callback registration and Google's authorized redirect URI must match the URLs used by the backend.

The frontend calls `POST /api/auth/oauth/{github|google}/start`, receives a provider authorization URL, then navigates there. The callback at `GET /api/auth/oauth/{github|google}/callback` verifies a one-use browser-bound `state` and PKCE code verifier, exchanges the code on the backend, retrieves the provider's stable user ID, and issues the existing HttpOnly session cookie. The provider access token and client secret are never sent to the frontend or stored in MySQL. The `oauth_identities` table maps a GitHub user ID or Google `sub` to a local user. It does not automatically merge with an existing password account; that would require a separate account-linking flow with ownership checks.

## Quality checks

Footprints now use authenticated MySQL-backed APIs for listing, adding, editing, deleting, and photo retrieval. Existing browser records are imported on opening the journal with source-ID deduplication. See [the backend completion report](docs/backend-completion.md) for the schema, API contract, H2 migration, startup details, and verification results. To preview on another backend port, set `BACKEND_URL` before running Vite.

```bash
npm test -- --run
npm run typecheck
npm run build
```

## Footprints

After logging in, choose **Footprints** in the primary navigation. Every account starts with one photo for each of the 34 destinations in `travelSlides`. Edits, additions, deletions, and uploaded photographs are saved by the authenticated MySQL-backed APIs. Photo and province are required. City, date, note and theme are optional. Filters match the labels saved on each photo.

Use the wheel, drag the photos, or press the arrow keys to browse an endless loop of photos matching the current filters. Selecting a photo scrolls the reel to bring it to the right and opens its details.

The gallery uses derived WebP thumbnails stored in `public/images/footprint-thumbs`. If the login carousel assets change, run `node scripts/generate-footprint-thumbnails.mjs` from this directory with FFmpeg installed and verify the one-to-one asset pairing. This command does not replace the login carousel files.

In local development, set `FOOTPRINTS_LOCAL_DIRECTORY` and `FOOTPRINTS_LOCAL_USERNAME` in `.env.local` to use a private folder of province-named JPGs for that account. The dev server checks the active session before serving the directory listing or an image. The files stay outside the production bundle.

Generate private thumbnails with `node scripts/generate-footprint-thumbnails.mjs <photo-folder> <thumbnail-folder>` and set `FOOTPRINTS_LOCAL_THUMBNAILS` to the destination in `.env.local`. Use a destination outside the project and rerun the command when its source photos change.

`FootprintsPage` uses the server repository and account-scoped APIs described in the backend report. `Footprint.suggestedThemes` reserves a theme and a confidence ratio (0–1) for future suggestions. Filtering uses the user's saved `themes`.

## Project scope

- React + TypeScript + Vite
- A small Spring Boot login/register backend with MySQL
- Signup and login mode changes stay entirely in the left panel
- The destination carousel uses a 2.5-second color reveal, 3-second hold, and 1.2-second horizontal slide
- Successful server authentication triggers the liquid runway and airplane transition into a placeholder home view
- Reduced-motion preferences are respected

Travel image entries and location labels are defined in [`src/features/carousel/carouselData.ts`](src/features/carousel/carouselData.ts). Replace the imported local images there to update the carousel.
