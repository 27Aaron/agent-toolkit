# DSH WakaTime

[English](README.md)

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 WakaTime 集成。插件只观察成功的 Agent 文件操作，不改变工具行为，也不阻塞工具执行流水线。

## 特性

- 使用 Harness 官方 `tools/result` Cordis 事件，同时覆盖原生工具与 Code Mode 子调用。
- 跟踪 `read`、`read_image`、`edit`、`write` 和 `str_replace_editor`。
- 优先读取最终校验后的工具参数与 canonical result，准确计算 WakaTime 所需的 AI 净行数变化。
- 通过 WakaTime `--extra-heartbeats` 协议批量发送，并保留每个文件操作的原始时间。
- 使用带独占锁的跨进程、按项目限流；暂时失败时保留并重试数据。
- 按“显式路径、全局 CLI、托管下载”的优先级选择 `wakatime-cli`。
- 首次捕获文件活动后才按需解析或安装 CLI，因此 Harness 启动不会等待网络。
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

## 从当前仓库安装

先构建插件，再将本地目录作为 Profile Bundle 加入 DSH；检查组合结果后重启 Profile：

```sh
pnpm install
pnpm build
dsh plugin --profile web add ./plugins/dsh-wakatime
dsh --profile web --dump-config
dsh web
```

每个需要统计的 Profile 都应独立安装：

```sh
dsh plugin --profile headless add ./plugins/dsh-wakatime
```

如需可移植产物，运行 `pnpm --filter @27aaron/dsh-wakatime pack`，再通过 `dsh plugin --profile <name> add <file.tgz>` 安装生成的 tarball。

## 配置

### 设置页面

将插件安装到 web Profile 后重启 DSH，然后打开 **设置 → 插件 → WakaTime**。页面按官方 Dashboard 结构展示：活动概览、AI Coding、模型、编辑器、语言、操作系统、设备机器、AI／人工趋势；项目页集中展示项目、分类、今天的活动分布以及包含 AI 明细的项目卡片，AI 和洞察页提供提示词、Token、模型、工作日以及每日 AI 占比等明细。

API Key 会以受限的本机文件权限写入 WakaTime 标准 `.wakatime.cfg`；页面管理的插件选项保存在 WakaTime 数据目录下。页面只会收到“是否已配置 API Key”的布尔值，不会把已有密钥读回浏览器。数据请求由 Host 进程发起，并短暂缓存以避免重复请求。仪表盘等短周期数据来自 summaries，选定结束日期还会通过 WakaTime durations 接口获取更细的“今天”分布；洞察页默认使用过去 1 年，并通过只读的 `stats`、`days`、`ai_days` 和 `weekdays` 接口生成长期热力图，不会调用团队、账单或其他付费专属 API。

Bundle 会插入 id 为 `wakatime` 的行。可在 `$DSH_HOME/profiles/<name>/cordis.patch.yml`、`$DSH_HOME/cordis.patch.yml` 或更晚的 `--patch` 层覆盖：

```yaml
- id: wakatime
  config:
    heartbeatIntervalMs: 60000
    heartbeatTimeoutMs: 30000
    cliUpdateCheckIntervalMs: 14400000
    cliDownloadTimeoutMs: 120000
    autoInstall: true
    trackReads: true
    category: "ai coding"
    client: dsh
    debug: false
    maxPendingFiles: 5000
```

所有字段都是可选项，默认值直接声明在导出的 Schemastery schema 中。Harness 的后续配置层会整体替换目标行的 `config`；未写出的字段由 schema 补齐，而不是依赖 Bundle patch 深度合并。

| 配置项                     |      默认值 | 说明                                           |
| -------------------------- | ----------: | ---------------------------------------------- |
| `heartbeatIntervalMs`      |     `60000` | 同一项目两批心跳之间的最短间隔。               |
| `heartbeatTimeoutMs`       |     `30000` | 单个心跳进程的最长运行时间。                   |
| `cliUpdateCheckIntervalMs` |  `14400000` | 托管 CLI 的更新检查间隔。                      |
| `cliDownloadTimeoutMs`     |    `120000` | GitHub 请求或 CLI 下载的超时。                 |
| `cliPath`                  |      未设置 | CLI 绝对路径，支持 `~`；设置后禁用发现和托管。 |
| `autoInstall`              |      `true` | 找不到显式或全局 CLI 时自动下载并更新。        |
| `trackReads`               |      `true` | 将成功读取记录为净行数为零的 AI 活动。         |
| `category`                 | `ai coding` | WakaTime 心跳分类。                            |
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

托管下载只接受 HTTPS，并遵循 WakaTime 标准 HTTP(S) 代理设置；安装前会校验 ZIP 结构、体积、CRC-32、目标文件名和二进制 `--version` 输出，然后原子替换旧版本。禁止下载可执行文件的环境应设置 `autoInstall: false`。

## 数据与隐私

插件会调用本机 WakaTime CLI，并传入文件路径、项目目录、时间、分类、写入状态和带符号的 AI 净行数变化。API 认证、离线队列、项目识别与隐私过滤由 WakaTime CLI 负责。请按部署策略配置 WakaTime 的 `hide_file_names`、`hide_project_names`、`exclude` 和 `include` 等标准选项。

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
- WakaTime `ai_line_changes` 是带符号的净行数变化，不是被触碰或替换的总行数。
- 纯提示词活动没有文件实体，因此不会伪造文件心跳。官方 Claude Code 与 Codex 插件可以让 WakaTime CLI 解析各自原生日志；WakaTime CLI 目前没有 Harness Session 格式解析器。

## 开发验证

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
