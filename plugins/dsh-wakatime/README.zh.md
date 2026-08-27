# DSH WakaTime

[English](README.md)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 WakaTime 集成。通过上游 `wakatime-cli` 同步会话活动，不改变工具行为，也不另行维护活动解析器。

本包是**跟踪核心**：通过 `.wakatime.cfg` 和下方的插件配置即可完成全部配置，不需要任何 UI。Web 仪表盘和设置页面位于独立的 [`@27aaron/dsh-wakatime-ui`](../dsh-wakatime-ui) 包；想要图形界面时安装它即可。两个变体读写同一个 WakaTime 数据目录，切换时所有设置都会保留。

| 包                          | 提供的能力                                       |
| --------------------------- | ------------------------------------------------ |
| `@27aaron/dsh-wakatime`     | 无界面跟踪；完全不含浏览器端代码。               |
| `@27aaron/dsh-wakatime-ui`  | 同样的跟踪能力，外加 Web 仪表盘和设置页面。      |

## 特性

- 使用 Harness 官方 `session/event` 通知调度同步；CLI 读取本地会话日志前，先等待 `ctx.sessions.flush(session)` 完成持久化。
- 先执行 `--sync-ai-activity`，再分别执行 `--sync-offline-activity 1000` 和 `--offline-count`；队列仍有积压时保留待同步状态并继续重试。提示词、Token、模型、文件和行数统计全部由 CLI 负责，插件不再自行生成文件心跳。
- 纯提示词会话也会触发同步，无需等待工具调用或其他编辑器的心跳。
- 合并各个 Session 的待同步请求，按全局同步间隔调度，并在暂时失败后重试。
- 按“显式路径、全局 CLI、托管下载”的优先级选择 `wakatime-cli`。
- 同步时按需检测 CLI；托管下载只由配置页按钮或显式 `autoInstall: true` 触发。
- 仪表盘 API 后台刷新只在页面或设置交互后启动，与 CLI 的活动同步相互独立。
- 读取 WakaTime 标准 HTTP(S) `proxy`、`no_ssl_verify` 与 `debug` 设置；过滤和项目识别继续由 CLI 负责。
- 在 Session 销毁和插件卸载时刷新数据，兼容一次性 headless 任务。

两个同步命令必须分开执行：[上游命令分发](https://github.com/wakatime/wakatime-cli/blob/v2.25.0/cmd/run.go#L153-L165) 在同时传入两个参数时会优先选择离线同步。仅执行离线同步不会解析 AI 会话日志。

## 环境要求

- DeepSeek Harness `>= 0.1.1-rc.2 < 0.2`。
- Node.js `^22.19.0 || >=24.0.0`，与当前 Harness 要求一致。
- 支持原生 DeepSeek Harness 解析的稳定版 `wakatime-cli >= v2.25.0`。
- 在 `~/.wakatime.cfg`、`$WAKATIME_HOME/.wakatime.cfg` 或 `WAKATIME_API_KEY` 中配置 API Key。

```ini
[settings]
api_key = waka_your_api_key_here
```

## 从 npm 安装

在每个需要上报活动的 Profile 中安装仅跟踪 Bundle：

```sh
dsh plugin --profile headless add @27aaron/dsh-wakatime
```

如需跟踪能力和 Web 仪表盘，请改为安装 `@27aaron/dsh-wakatime-ui`：

```sh
dsh plugin --profile web add @27aaron/dsh-wakatime-ui
```

每个 Profile 只选择一个变体。安装后请检查组合配置并重启对应 Profile。

## 从当前仓库安装

先构建插件，再把需要的变体作为 Profile Bundle 加入 DSH；检查组合结果后重启 Profile：

```sh
pnpm install
pnpm build

# 仅跟踪：
dsh plugin --profile web add ./plugins/dsh-wakatime

# 跟踪 + Web 仪表盘：
dsh plugin --profile web add ./plugins/dsh-wakatime-ui
```

每个需要统计的 Profile 都应独立安装：

```sh
dsh plugin --profile headless add ./plugins/dsh-wakatime
```

如需可移植的核心产物，运行 `pnpm --filter @27aaron/dsh-wakatime pack`，再通过 `dsh plugin --profile <name> add <file.tgz>` 安装。UI tarball 会把本核心保留为普通 registry 依赖，因此分发 `@27aaron/dsh-wakatime-ui` 前必须先发布匹配版本的核心包；未发布的本地检出请使用上方的目录安装命令。

**每个 Profile 只装一个变体。** 两个包都声明了 `dsh.bundle` patch，同时装入一个 Profile 会组合出两行 wakatime；先激活的一行负责跟踪，另一行会记录警告后让位，不会重复统计——但建议避免这种组合。UI 包会以传递依赖的形式自动安装本核心包，后续切换只需移除一个再添加另一个；设置保存在 WakaTime 数据目录，切换不丢。

## 配置

### Web 仪表盘

仪表盘和设置页面由 [`@27aaron/dsh-wakatime-ui`](../dsh-wakatime-ui) 提供，功能介绍见其 README。无论安装哪个变体，本核心都提供相同的 RPC 端点、为已安装的仪表盘持续供给缓存数据，并且只在第一次页面交互之后才启动后台刷新。两个变体都从 `.wakatime.cfg` 读取 API Key，并把页面管理的选项保存在 WakaTime 数据目录下，因此来回切换不会丢失任何设置。

### 插件配置

Bundle 会插入 id 为 `wakatime` 的行（UI 变体插入 `wakatime-ui` 并 re-export 同一份 schema）。可在 `$DSH_HOME/profiles/<name>/cordis.patch.yml`、`$DSH_HOME/cordis.patch.yml` 或更晚的 `--patch` 层覆盖：

```yaml
- id: wakatime
  config:
    heartbeatIntervalMs: 60000
    heartbeatTimeoutMs: 30000
    cliUpdateCheckIntervalMs: 14400000
    cliDownloadTimeoutMs: 120000
    autoInstall: false
    client: dsh
    debug: false
```

所有字段都是可选项，默认值直接声明在导出的 Schemastery schema 中。Harness 的后续配置层会整体替换目标行的 `config`；未写出的字段由 schema 补齐，而不是依赖 Bundle patch 深度合并。`ai coding` 分类由上游 DeepSeek 解析器指定，插件不提供 category 覆盖选项。

| 配置项                     |      默认值 | 说明                                           |
| -------------------------- | ----------: | ---------------------------------------------- |
| `heartbeatIntervalMs`      |     `60000` | 跨 Session 的全局原生同步最短间隔。            |
| `heartbeatTimeoutMs`       |     `30000` | 每个 CLI 进程或持久化检查点的超时，不是整轮同步的总时限。 |
| `cliUpdateCheckIntervalMs` |  `14400000` | 托管 CLI 的更新检查间隔。                      |
| `dashboardRefreshIntervalMs` | `300000` | 仪表盘后台刷新间隔；设置页按分钟展示。          |
| `insightsRefreshIntervalMs` | `1800000` | 洞察后台刷新间隔；设置页按分钟展示。            |
| `cliDownloadTimeoutMs`     |    `120000` | GitHub 请求或 CLI 下载的超时。                 |
| `cliPath`                  |      未设置 | CLI 绝对路径，支持 `~`；设置后禁用发现和托管。 |
| `autoInstall`              |     `false` | 是否允许 Host 在同步时自动下载或更新托管 CLI；默认关闭。 |
| `client`                   |       `dsh` | 用于 CLI `--plugin` 标签的安全标识。           |
| `debug`                    |     `false` | 独立于 WakaTime 设置启用调试日志。             |

网络设置继续使用标准 `.wakatime.cfg`：

```ini
[settings]
debug = true
proxy = https://user:pass@example.com:8080
# 仅在受控网络确有需要时使用。
no_ssl_verify = false
```

## CLI 管理与安全

CLI 解析顺序为：

1. 配置中的 `cliPath`。
2. `PATH` 中的 `wakatime-cli`。
3. `~/.wakatime/` 或 `$WAKATIME_HOME` 下的平台专用托管 CLI。

默认情况下页面只检测显式路径、PATH 和 WakaTime 目录，不会联网或写入文件。配置页提供“下载 WakaTime CLI”和“检查并更新”按钮：前者只在用户点击后安装托管版本，后者只处理托管版本，不会修改系统或包管理器安装的 CLI。托管下载只接受 HTTPS，并遵循 WakaTime 标准 HTTP(S) 代理设置；安装前会校验 ZIP 结构、体积、CRC-32、目标文件名和二进制 `--version` 输出，然后原子替换旧版本。需要后台自动管理时，才在 Host 配置中显式设置 `autoInstall: true`。

更新检查只跟随 GitHub 最新稳定版，不会自动安装预发布版本。同步要求已确认的稳定版 `wakatime-cli >= v2.25.0`；旧版、预发布版和未知版本（包括无版本号的本地构建）不会被当作已支持，请更新或选择受支持的 CLI。插件不会回退到自己的解析器。配置页会显示当前 CLI 的原生同步支持情况。

## 数据与隐私

插件调用本机 WakaTime CLI，传入同步参数和 `--plugin` 标签，并通过 `DSH_HOME` 指定 Harness 会话根目录。CLI 读取本地会话日志并生成心跳元数据，同时负责 API 认证、离线队列、项目识别与隐私过滤。请按部署策略配置 WakaTime 的 `hide_file_names`、`hide_project_names`、`exclude` 和 `include` 等标准选项。

在哪个 Profile 启用插件，只决定何时触发同步，不限制扫描范围。原生 AI 同步会按 CLI 配置扫描所有受支持的本地日志，包括其他 Harness Profile 和其他受支持的 AI 工具。

日志位于 `~/.wakatime/dsh-wakatime.log` 或 `$WAKATIME_HOME/dsh-wakatime.log`。插件不会把 API Key 放进进程参数或自身日志。

## 排障

```sh
dsh --profile web --dump-config
grep -iE 'warn|error' ~/.wakatime/dsh-wakatime.log
grep -iE 'warn|error' ~/.wakatime/wakatime.log
```

需要更多信息时，在 `.wakatime.cfg` 中设置 `debug = true`，或在插件行设置 `debug: true`。

## 已知边界

- 原生 DeepSeek 解析只读取 `$DSH_HOME/sessions` 下的本地 `session.jsonl` 和 `session.jsonl.zstd`（通常为 `~/.dsh/sessions`）。仅存在于内存或远程主机的会话需要先在本地持久化。参见[上游日志发现逻辑](https://github.com/wakatime/wakatime-cli/blob/v2.25.0/pkg/ai/deepseek.go#L176-L237)。
- 文件覆盖范围和行数口径跟随上游；插件不会推测任意 Shell 修改或未受支持的自定义工具行为。
- v2.25.0 上游尚未解析 Code Mode 的 `tool/code-dispatch` 事件，因此子调用缺少文件和行数明细；会话提示词及 Token 用量仍可同步。应在上游补齐解析，而不是在插件内增加第二套数据来源。参见[已支持的事件分支](https://github.com/wakatime/wakatime-cli/blob/v2.25.0/pkg/ai/deepseek.go#L380-L395)。
- 离线投递和去重仍由 CLI 负责；本机同步进程执行成功，不代表仪表盘已经收到全部心跳。

## 开发验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
