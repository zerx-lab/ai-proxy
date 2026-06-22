# AI Proxy — Claude Code 订阅反向代理网关

将一个或多个 Claude (Pro/Max) 订阅账号,通过 Anthropic 兼容的 `/v1/messages` 端点,
以可审计、可观测、带配额分发(SK)的方式对外提供服务。后端基于 Encore.ts,
前端基于 TanStack Start。

## 能力

- **管理员**:第一个注册的用户自动成为管理员。
- **SK(API Key)分发**:管理员/用户创建多个 SK,客户端用 SK 调用网关;每个 SK 的请求被审计。
- **Claude OAuth 账号池**:两种授权模式,token 过期自动刷新,多账号轮询(最近最少使用)。
  1. 手动浏览器授权:后台生成 PKCE 授权 URL → 用户登录授权 → 粘贴回调 code 完成。
  2. sessionKey 自动授权:粘贴 claude.ai 的 `sessionKey` cookie,后台自动完成授权。
  - 也支持直接添加 Anthropic API Key 账号。
- **反向代理**:`POST /v1/messages` 透传到 `api.anthropic.com`,注入 Claude Code 伪装头与
  system 提示块,SSE 流式原样透传,解析 token 用量写入审计日志。
- **可观测性**:落 Postgres 审计表 + 复用 Encore 内置 tracing(本地 dev dashboard)。

## 架构

```
db/        共享 Postgres + drizzle schema(users / api_keys / accounts / oauth_sessions / audit_logs)
auth/      注册/登录、JWT 鉴权 handler + gateway、/auth/me
keys/      SK 的增删改查 + 反代用的 SK 校验
accounts/  Claude OAuth 两种模式、token 刷新、账号池选择
proxy/     /v1/messages 反代核心、上游头改写、SSE 透传、审计、/audit 查询
frontend/  TanStack Start + Radix UI + Tailwind + Vite(独立 package)
deploy/    自托管:docker-compose、infra-config、一键脚本、迁移
```

## 本地开发

```bash
# 1. 设置本地 JWT 密钥(已含 .secrets.local.cue 示例)
# 2. 启动后端(需要 Docker 提供本地 Postgres)
encore run

# 健康检查
curl http://localhost:4000/healthz

# 前端
cd frontend && npm install --legacy-peer-deps && npm run dev   # http://localhost:3000
```

### 数据库模型迭代(开发模式)

修改 `db/schema.ts` 后,生成迁移即可(Encore 在启动时自动应用):

```bash
npm run db:generate    # drizzle-kit generate -> db/migrations/*.sql
```

## 测试

```bash
npx vitest run              # 后端单元测试(OAuth PKCE、上游头、用量解析)
cd frontend && npm run typecheck && npm run build
```

## 自托管(一键迁移 + 运行)

需要 `docker` 与 `encore` CLI。脚本会:生成密钥 → 生成迁移 → 构建 Encore 镜像 →
起 Postgres + 迁移(一次性)+ 后端服务。

```bash
./deploy/selfhost.sh          # 构建并启动整套(后端默认 8080 端口)
./deploy/selfhost.sh logs     # 跟随后端日志
./deploy/selfhost.sh down     # 停止

# 首次启动后访问 /auth/signup,第一个账号即为管理员。
curl http://localhost:8080/healthz
```

迁移与应用解耦:`deploy/migrate.mjs`(drizzle 迁移器)在一次性 `migrate` 容器中执行,
完成后 `app` 容器才启动,避免自托管镜像不自动迁移的问题。

## 客户端接入

将 Claude Code / 任意 Anthropic 客户端指向网关,并使用网关签发的 SK:

```bash
export ANTHROPIC_BASE_URL=http://your-host:8080
export ANTHROPIC_API_KEY=sk-...        # 网关签发的 SK
```

## 故障排查:403 "Request not allowed"

OAuth 授权(token 交换/刷新)或反代上游返回:

```json
{ "error": { "type": "forbidden", "message": "Request not allowed" } }
```

这是 **Anthropic 对服务器出口 IP 的地域/风控封锁**,非代码问题——`api.anthropic.com`、
`console.anthropic.com`、`claude.ai` 对被封 IP 的所有请求(含无凭据的 `/v1/messages` 与
根路径)统一返回该 403。常见于非受支持地区或被标记的 VPS IP。

修复:让网关的出站流量经由受支持地区的 HTTP(S) 代理。设置环境变量 `UPSTREAM_PROXY`,
所有对上游(Anthropic / claude.ai)的请求会自动经此代理:

```bash
# 本地 encore run
export UPSTREAM_PROXY=http://user:pass@your-overseas-proxy:8080
# 自托管 compose:写入 deploy/.env
echo 'UPSTREAM_PROXY=http://user:pass@your-overseas-proxy:8080' >> deploy/.env
```

未设置时不走代理(行为不变)。

## 免责声明

本项目仅供技术学习与研究。使用订阅账号通过第三方网关转发可能违反 Anthropic 服务条款,
由此产生的账号风险与一切后果由使用者自行承担。
