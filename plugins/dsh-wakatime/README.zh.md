# DSH WakaTime

[English](README.md)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 WakaTime 集成。插件只观察成功的 Agent 文件操作，不改变工具行为，也不阻塞工具执行流水线。

本包是**跟踪核心**：通过 `.wakatime.cfg` 和下方的插件配置即可完成全部配置，不需要任何 UI。Web 仪表盘和设置页面位于独立的 [`@27aaron/dsh-wakatime-ui`](../dsh-wakatime-ui) 包；想要图形界面时安装它即可。两个变体读写同一个 WakaTime 数据目录，切换时所有设置都会保留。

| 包                          | 提供的能力                                       |
| --------------------------- | ------------------------------------------------ |
| `@27aaron/dsh-wakatime`     | 无界面跟踪；完全不含浏览器端代码。               |
| `@27aaron/dsh-wakatime-ui`  | 同样的跟踪能力，外加 Web 仪表盘和设置页面。      |

## 特性

- 使用 Harness 官方 `tools/result` Cordis 事件，同时覆盖原生工具与 Code Mode 子调用。
- 跟踪 `read`、`read_image`、`edit`、`write` 和 `str_replace_editor`；修改类操作按写入上报、读取按净行数为零的 AI 活动上报，与 wakatime-cli 自身的口径一致。
- 与 wakatime-cli 原生的 DeepSeek Harness 会话解析器（`v2.25.0+`）协作：插件每批发送心跳都会触发 CLI 解析 Harness 会话，从而补上插件看不到的提示词、AI Token 用量与模型归属；CLI 会在五秒窗口内对插件心跳与解析结果去重，不会重复计时。
- 行数口径与 wakatime-cli 的 DeepSeek Harness 解析器完全一致：edit 按带符号净行数差、write 按写入内容全量行数；优先使用最终校验后的工具参数，Harness 暴露 canonical diff 时使用等价来源。
- 通过 WakaTime `--extra-heartbeats` 协议批量发送，并保留每个文件操作的原始时间。
- 使用带独占锁的跨进程、按项目限流；暂时失败时保留并重试数据。
- 按“显式路径、全局 CLI、托管下载”的优先级选择 `wakatime-cli`。
- 首次捕获文件活动后才按需检测 CLI，因此 Harness 启动不会等待网络；托管下载只由配置页按钮或显式 `autoInstall: true` 触发。
- 自身不会发起后台 WakaTime API 请求；仪表盘数据只在页面真正发起使用或设置交互后才开始拉取。
- 读取 WakaTime 标准 HTTP(S) `proxy`、`no_ssl_verify` 与 `debug` 设置；过滤和项目识别继续由 CLI 负责。
- 在 Session 销毁和插件卸载时刷新数据，兼容一次性 headless 任务。

## 环境要求

- DeepSeek Harness `>= 0.1.1-rc.2 < 0.2`。
- Node.js `^22.19.0 || >=24.0.0`，与当前 Harness 要求一致。
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
    maxPendingFiles: 5000
```

所有字段都是可选项，默认值直接声明在导出的 Schemastery schema 中。Harness 的后续配置层会整体替换目标行的 `config`；未写出的字段由 schema 补齐，而不是依赖 Bundle patch 深度合并。心跳始终使用 WakaTime 固定的 `ai coding` 分类，与 wakatime-cli 原生 DeepSeek Harness 解析器保持一致，因此没有 category 配置项。

| 配置项                     |      默认值 | 说明                                           |
| -------------------------- | ----------: | ---------------------------------------------- |
| `heartbeatIntervalMs`      |     `60000` | 同一项目两批心跳之间的最短间隔。               |
| `heartbeatTimeoutMs`       |     `30000` | 单个心跳进程的最长运行时间。                   |
| `cliUpdateCheckIntervalMs` |  `14400000` | 托管 CLI 的更新检查间隔。                      |
| `dashboardRefreshIntervalMs` | `300000` | 仪表盘后台刷新间隔；设置页按分钟展示。          |
| `insightsRefreshIntervalMs` | `1800000` | 洞察后台刷新间隔；设置页按分钟展示。            |
| `cliDownloadTimeoutMs`     |    `120000` | GitHub 请求或 CLI 下载的超时。                 |
| `cliPath`                  |      未设置 | CLI 绝对路径，支持 `~`；设置后禁用发现和托管。 |
| `autoInstall`              |     `false` | 是否允许 Host 在心跳时自动下载或更新托管 CLI；默认关闭。 |
| `client`                   |       `dsh` | 加入 WakaTime plugin tag 的安全标识。          |
| `debug`                    |     `false` | 独立于 WakaTime 设置启用调试日志。             |
| `maxPendingFiles`          |      `5000` | 限制每个项目待发送文件占用的内存。             |

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

更新检查只跟随 GitHub 最新稳定版，不会自动安装预发布版本。原生 Harness 会话解析需要 `wakatime-cli >= v2.25.0`；配置页会显示当前 CLI 是否已支持，未支持时提示更新。

## 数据与隐私

插件会调用本机 WakaTime CLI，并传入文件路径、项目目录、时间、分类、写入状态和 AI 行数变化。API 认证、离线队列、项目识别与隐私过滤由 WakaTime CLI 负责。请按部署策略配置 WakaTime 的 `hide_file_names`、`hide_project_names`、`exclude` 和 `include` 等标准选项。

日志位于 `~/.wakatime/dsh-wakatime.log` 或 `$WAKATIME_HOME/dsh-wakatime.log`。插件不会把 API Key 放进进程参数或自身日志。

## 排障

```sh
dsh --profile web --dump-config
grep -iE 'warn|error' ~/.wakatime/dsh-wakatime.log
grep -iE 'warn|error' ~/.wakatime/wakatime.log
```

需要更多信息时，在 `.wakatime.cfg` 中设置 `debug = true`，或在插件行设置 `debug: true`。

## 已知边界

- Shell 命令可能修改任意文件，因此不会猜测 `bash` 或 PowerShell 的文件影响。
- 自定义文件工具只有在明确支持其参数与结果契约后才会统计。
- 远程文件系统向模型暴露的路径可能不存在于 Host；插件仍会结合 Session 项目目录上报该路径。
- WakaTime `ai_line_changes` 遵循 CLI 解析器的固定口径：edit 按带符号的净行数差上报，write/create 按写入内容的全量行数上报。
- 纯提示词回合没有文件实体，插件自身不会为其伪造心跳。`wakatime-cli >= v2.25.0` 已原生解析 Harness 会话（每次心跳发送时解析提示词、助手输出、AI Token 与模型归属），并对与插件重合的文件心跳在五秒窗口内去重；纯提示词活动因此会在下一次任意心跳发送时（本插件的下一次工具活动，或其他编辑器的心跳）被补同步。

## 开发验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
