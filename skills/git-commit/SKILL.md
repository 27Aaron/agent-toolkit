---
name: git-commit
description: 生成或审查 Git 提交消息、处理 commitlint 错误，并在用户要求时创建或 amend 提交。优先遵循仓库规则并参考历史提交，无稳定格式约定时使用 Conventional Commits。
metadata:
  author: Aaron
  version: "1.0.3"
---

# Git 提交

优先遵循用户明确要求和仓库专用指令、commitlint 配置。未明确规定的格式和语言，在可访问仓库时参考近期历史提交中的稳定约定；历史仅用于风格参考，不作为本次改动的证据。无法确认稳定格式约定时，默认使用 [Conventional Commits v1.0.0](https://www.conventionalcommits.org/zh-hans/v1.0.0/)。

## 操作边界

- 用户仅要求起草、生成、修改或建议提交消息时，默认只返回一条完整消息，不添加解释、引号、Markdown 或代码块；用户明确要求多个候选或解释时除外。
- 审查提交消息时，按用户要求给出结论、原因或修订后的消息。
- 只有用户明确要求暂存或提交时才修改暂存区；只有明确要求创建提交或将改动保存到 Git 时才运行 `git commit`。请求含糊时不修改仓库。
- 只有用户明确要求修改已记录的提交时才 amend。

## 生成消息

以下模板和 type 规则仅适用于采用 Conventional Commits 的任务。

```text
<type>[可选 scope][!]: <描述>

[可选正文]

[可选脚注]
```

类型和版本语义：

| Type   | 适用场景 | 语义化版本 |
| ------ | -------- | ---------- |
| `fix`  | 修复 bug | `PATCH`    |
| `feat` | 新增功能 | `MINOR`    |

- 破坏性变更：在 `<type>[可选 scope]!:` 中使用 `!`，和/或添加 `BREAKING CHANGE:` 脚注；可用于任意 type，对应语义化版本中的 `MAJOR`。只使用 `!` 时，在标题中说明破坏内容。

其他常用 type 沿用 `@commitlint/config-conventional`（基于 Angular）的约定：

| Type       | 适用场景                                       |
| ---------- | ---------------------------------------------- |
| `build`    | 修改构建系统、构建依赖或工具链                 |
| `chore`    | 无法归入其他类型的维护性改动                   |
| `ci`       | 修改持续集成配置或工作流                       |
| `docs`     | 修改 README、API 文档等文档                    |
| `style`    | 调整缩进、空格或空行等代码样式，不改变逻辑     |
| `refactor` | 修改代码结构、变量名或函数名等，不改变功能逻辑 |
| `perf`     | 优化性能或减少资源占用                         |
| `test`     | 添加、删除或修改测试                           |

依赖更新按实际目的和仓库约定选择 type，不一律归为 `build` 或 `chore`。除 `BREAKING CHANGE: <description>` 外，其他脚注遵循 `git trailer` 约定。

- 用户提供消息、diff、改动摘要或 commitlint 错误时，以其为主要依据；只有缺少必要上下文或仓库规则时才检查仓库。
- 先确定目标快照。目标为 staged 改动时，只依据 staged 文件和 `staged diff`；未暂存 diff 和分支名不能证明功能、动机、影响或未展示的文件。
- 信息不足时使用最保守且准确的描述，不补充现有证据无法支持的细节或影响。
- 根据已确认的变更结果选择准确 type；仓库规则优先，只有其他类型都不合适时才使用 `chore`。
- 只有文件路径、模块名称或 diff 明确支持时才使用 scope；无法确认时省略。
- 描述使用祈使语气，概括目标快照中主要的用户可见或开发者可见变更。
- 语言和风格按上述优先级选择；没有稳定语言约定或仅提供文本上下文时匹配用户语言。没有其他约定时，标题结尾不加句号，建议不超过 72 个字符。
- 仅在标题无法说明原因、背景或影响时添加正文，不重复文件列表。
- 不要虚构 issue 编号、审查者或共同作者；未经明确要求，不添加 `BREAKING CHANGE:` 以外的 Git trailer。

### 处理 commitlint 错误

根据报错的规则名和仓库实际配置做最小修订，保留消息的真实含义。配置可比 Conventional Commits 更严格，例如要求 `!` 与 `BREAKING CHANGE:` 同时出现；不要为通过校验虚构破坏性变更。需要验证时使用仓库已有的 commitlint 入口，不通过创建提交来试错，也不擅自安装依赖、修改配置或关闭规则。规则语义不明确时查阅 [commitlint 官方规则](https://commitlint.js.org/reference/rules.html)。

## 工作流程

### 1. 分析目标改动

- 仅为 staged 改动生成消息时，检查 `git status --short` 和 `git diff --staged`；未暂存内容只能用于识别仍会保留的改动，不作为消息证据。
- 实际执行提交时，同时检查 `git status --short`、`git diff --staged` 和 `git diff`；文件仅部分暂存时，将两部分视为独立快照。
- amend 前确认用户要修改的提交是 HEAD，并检查其内容；其他历史提交不能用 `--amend` 直接修改。消息应描述修改后的完整提交，而不只是新加入的 staged diff。
- 以用户声明的范围确定本次应包含的改动。
- 用户明确指定的范围优先；未指定范围但已有暂存内容时，默认只处理 staged 快照。
- 用户只要求处理 staged 改动而暂存区为空时，报告没有目标改动，不自动改用工作区。其他任务没有暂存内容时，根据工作区 diff 和相关 untracked 内容确定范围。
- 需要匹配仓库约定时，检查仓库指令、commitlint 配置和近期提交标题。

### 2. 准备提交内容

- 仅修改 HEAD 消息时跳过暂存，使用 `git commit --amend --only --file=-` 且不传文件路径，保留原提交内容和已有暂存改动。这是下述 staged 范围规则的例外，语义见 [git commit 文档](https://git-scm.com/docs/git-commit#Documentation/git-commit.txt---only)。
- 创建新提交或将改动纳入 amend 时，在“操作边界”的授权范围内，优先保持一个提交对应一个逻辑变更，不得擅自遗漏或拆分用户要求的范围。用户未要求包含某文件全部改动时，不用整文件暂存覆盖其部分暂存快照。
- 对需要纳入文件改动的提交，保留已有 staged 快照。若其包含范围外改动且用户尚未指定处理方式，暂停提交并询问，不擅自取消暂存或绕过索引。
- `git diff` 不显示 untracked 文件；暂存前检查其类型和相关内容，不得暂存密钥、私钥或范围外生成文件，也不要暴露敏感值。
- 暂存后运行 `git diff --staged --check` 并检查 `git diff --staged`。新提交以该快照生成消息；纳入改动的 amend 同时结合原提交内容，描述修改后的完整提交。

### 3. 执行提交

通过标准输入将完整消息传给 `git commit --file=-`，或使用其他不会被 shell 重新解析的方式；不要把消息插值到 shell 命令中。

创建新提交时，如果确定目标范围后没有任何 `staged` 改动，应报告没有可提交的内容。除非用户明确要求创建空提交，否则不要使用 `--allow-empty`。

允许 hooks 正常运行，不要自动绕过。Hook 失败时：

- 检查 hook 输出和 `git status --short`。
- 仅修复本次范围内的问题；Hook 修改文件后重新检查 staged diff，不要盲目暂存。
- 如果失败涉及无关文件、扩大任务范围或缺少授权，停止并报告。同一原因重复失败且没有新的修复依据时，不循环重试。

确认 `git commit` 成功退出后，使用以下命令验证提交结果；失败时不能把已有 HEAD 当成本次成功提交：

```bash
git status --short
git log -1 --format='%H%n%s'
```

核对实际提交内容与预期快照一致；仅修改消息的 amend 还应确认提交的文件树未变。报告提交哈希和标题，并说明仍然存在的 staged、unstaged 或 untracked 改动。

## 安全边界

- 提交或 amend 都不代表用户授权推送。
- 除非用户明确要求，否则不修改 Git 配置、不使用 `--no-verify`、破坏性命令、历史重写或强制推送。
- 绝不强制推送 `main` 或 `master`。
