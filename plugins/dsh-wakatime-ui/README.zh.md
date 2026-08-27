# DSH WakaTime UI

[English](README.md)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)、构建在 [`@27aaron/dsh-wakatime`](../dsh-wakatime) 之上的 Web 仪表盘与设置页面。想要跟踪**加**图形界面时，安装本包即可；它会以传递依赖的方式安装核心包并 re-export 其插件，Host 行为与核心包完全一致。完整配置说明见核心包 README。

## 特性

- 在 **设置 → 插件 → WakaTime** 中按官方 Dashboard 结构展示：活动概览、AI Coding、模型、编辑器、语言、操作系统、设备机器以及 AI／人工趋势。
- 项目页集中展示项目、分类、今天的活动分布以及包含 AI 明细的项目卡片；AI 和洞察页提供提示词、Token、模型、工作日以及每日 AI 占比等明细。
- 洞察页默认使用过去 1 年，并通过只读的 `stats`、`days`、`ai_days` 和 `weekdays` 接口生成长期热力图，不会调用团队、账单或其他付费专属 API。
- API Key 会以受限的本机文件权限写入 WakaTime 标准 `.wakatime.cfg`；页面管理的插件选项保存在与核心包共享的 WakaTime 数据目录下。
- 页面只会收到“是否已配置 API Key”的布尔值，不会把已有密钥读回浏览器。
- 数据请求由 Host 进程发起，并短暂缓存以避免重复请求。仪表盘等短周期数据来自 summaries，选定结束日期还会通过 WakaTime durations 接口获取更细的“今天”分布；该端点不可用时回退到 summary 数据。
- Host 端后台刷新只在第一次页面交互之后启动；此前不会轮询 WakaTime。

## 环境要求

与核心包一致：DeepSeek Harness `>= 0.1.1-rc.2 < 0.2`、Node.js `^22.19.0 || >=24.0.0`，并按其说明配置 WakaTime API Key。仅对 web Profile 有意义；headless Profile 不会加载浏览器端代码。

## 从 npm 安装

安装本 Bundle，不要同时安装仅跟踪的核心 Bundle：

```sh
dsh plugin --profile web add @27aaron/dsh-wakatime-ui
dsh --profile web --dump-config
dsh web
```

匹配版本的 `@27aaron/dsh-wakatime` 核心包会作为传递依赖自动安装，请勿再把核心 Bundle 加入同一个 Profile。

## 从当前仓库安装

```sh
pnpm install
pnpm build
dsh plugin --profile web add ./plugins/dsh-wakatime-ui
dsh --profile web --dump-config
dsh web
```

如需通过 registry 分发 tarball，请先发布匹配版本的 `@27aaron/dsh-wakatime`，再运行 `pnpm --filter @27aaron/dsh-wakatime-ui pack`，并通过 `dsh plugin --profile <name> add <file.tgz>` 安装。UI tarball 会把核心包保留为普通依赖而不会嵌入；在配置的 registry 尚未提供该核心版本时，请使用上方的本地目录安装命令。

**每个 Profile 只装一个变体。** 同时安装两个包会组合出两行：先激活的一行负责跟踪，另一行静默让位——但建议避免这种组合。两个变体共享同一份持久化配置路径，切换不会丢失设置。

## 配置

Bundle 插入 id 为 `wakatime-ui` 的行，并 re-export `@27aaron/dsh-wakatime` 的同一份 Schemastery schema，完整字段表见[核心包 README](../dsh-wakatime#配置)。可在 `$DSH_HOME/profiles/<name>/cordis.patch.yml`、`$DSH_HOME/cordis.patch.yml` 或更晚的 `--patch` 层覆盖：

```yaml
- id: wakatime-ui
  config:
    heartbeatIntervalMs: 60000
    heartbeatTimeoutMs: 30000
    cliUpdateCheckIntervalMs: 14400000
    cliDownloadTimeoutMs: 120000
    autoInstall: false
    trackReads: true
    category: "ai coding"
    client: dsh
    debug: false
    maxPendingFiles: 5000
```

后续配置层会整体替换目标行的 `config`；未写出的字段由 schema 补齐，而不是依赖 Bundle patch 深度合并。

网络设置（`proxy`、`no_ssl_verify`、`debug`）继续来自标准 `.wakatime.cfg`。

## 开发验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

浏览器端构建通过 `@27aaron/dsh-wakatime/ui-contract` 引用 RPC 契约；由于浏览器的模块表无法解析跨包 require，客户端构建会把该子路径内联进产物（`deps.alwaysBundle`）。
