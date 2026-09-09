---
name: pull-request
description: 生成、优化或检查 PR 的分支名、标题、正文、改动范围与验证说明，并在用户要求时创建或更新 PR。不用于单独生成 Git 提交消息。
metadata:
  author: Aaron
  version: "1.0.1"
---

# Pull Request

根据已确认的改动准备便于审查的 PR。优先遵循用户要求和仓库专用规则；未规定的格式和语言参考近期 PR 的稳定约定，仍无约定时使用下述默认值。历史记录只用于风格参考，不作为本次改动的证据。

本 Skill 组合 Conventional Branch、Conventional Commits 和 PR 工程实践；分支偏好、正文结构和操作流程是默认建议，不是一套统一的行业强制标准。

## 按请求确定范围

- 只要求取名、起草文字或规范审查时，仅交付所需内容；不自动运行完整开发流程或修改远程状态。用户已提供充分文本或 diff 时，直接使用，不为简单润色扫描整个仓库。
- 用户要求创建 PR 时，可完成已确定范围内必要的建分支、提交、推送和创建步骤；沿用会话中已有授权，不逐步重复确认。仅要求更新 PR 说明时，编辑对应文字即可。
- 合并、关闭、删除分支、改写已推送历史或强制推送须在用户授权范围内；创建 PR 本身不包含这些操作。保留用户已有的暂存内容、范围外修改和协作者提交。
- 实际提交时可结合当前环境可用的 `git-commit` Skill；它不是生成 PR 文字的必需依赖，执行范围仍由用户任务与已有授权决定。
- 创建或更新 GitHub PR、检查远程状态、处理 Review 或合并任务时，阅读 [GitHub 操作流程](references/github-workflow.md)。其他平台按其模板、工具和合并规则处理。

## 确认规则和目标改动

需要仓库上下文时，按任务查阅适用的 `AGENTS.md`、贡献指南、PR 模板和 PR 校验工作流。GitHub 的模板可能位于仓库根目录、`docs/` 或 `.github/`，包括这些位置的 `PULL_REQUEST_TEMPLATE/` 多模板目录；选择匹配任务的模板。commitlint 的配置只有被 PR 标题校验流程引用或文档明确要求时，才是 PR 标题的硬性约束。

- 已有 PR：以该 PR 的仓库、base、远程 head SHA 和完整 diff 为准，不假定本地 `HEAD` 与 PR 相同。
- 新 PR：先确定目标仓库和 base；用户指定、仓库贡献流程、发布分支或堆叠 PR 的依赖关系优先，默认分支仅作兜底。不要假定 `origin` 就是上游仓库，或 base 一定是 `main`。
- 使用已确认的引用比较整条分支。下面的 `<base-ref>`、`<head-ref>` 是占位符，执行前替换为真实引用或 SHA：

```bash
git diff --stat <base-ref>...<head-ref> --
git diff <base-ref>...<head-ref> --
git diff --check <base-ref>...<head-ref> --
```

GitHub 的三点差异显示从共同祖先到 head 引入的改动。引用过期、缺失历史或 diff 被截断时，先按需获取完整数据；无法获取则说明审查范围限制，不把空输出当成没有改动。[比较分支](https://docs.github.com/en/pull-requests/reference/branches)

在本地准备 PR 时，用 `git status --short`、`git diff --staged` 和 `git diff` 区分 staged、unstaged 与 untracked 内容。它们不属于已提交分支的 PR diff；只有用户任务包含这些内容时，才作为待纳入改动处理，提交和推送后重新核对最终 diff。不要用分支名、最后一条 commit 或未提交文件代替完整 PR 的事实依据。

## 分支命名

没有仓库命名约定时，参考 [Conventional Branch](https://conventionalbranch.org/zh/) 使用：

```text
<type>/<description>
```

常用用途前缀：

| 前缀 | 用途 | 示例 |
| --- | --- | --- |
| `feature/` 或 `feat/` | 新功能、功能增强 | `feature/add-login` |
| `bugfix/` 或 `fix/` | Bug 修复 | `bugfix/123-expired-token` |
| `hotfix/` | 紧急生产修复 | `hotfix/session-expiry` |
| `release/` | 发布准备 | `release/v1.4.0` |
| `chore/` | 依赖、文档等维护 | `chore/update-readme` |

- 名称简洁、具体；有已知 Issue 时可将编号放入 description，没有则省略，不为取名额外要求创建 Issue。
- 默认生成小写 ASCII 字母、数字和连字符组成的描述；版本描述可使用点号。避免空格、下划线、首尾或连续分隔符，以及 `-.`、`.-`。不设置通用的硬性字数限制。
- 保持仓库对长短前缀、工单大小写、命名空间及长期分支的既有约定。`main`、`master`、`develop` 不加用途前缀；已有命名不能仅因偏离本 Skill 默认值就被判为无效。
- Conventional Branch 允许项目扩展类型。纯重构或性能改动可采用仓库的 `refactor/`、`perf/`；无约定且未限制类型时，也可将其作为本 Skill 的扩展建议。存在类型白名单时遵循白名单，不为通过校验把重构写成新增功能。
- AI 来源前缀依用户、仓库或运行环境要求使用；无要求时默认使用用途前缀。这是本 Skill 的选择，不是上游规范禁止 Agent 前缀。
- 创建前用 `git check-ref-format --branch '<branch-name>'` 检查 Git 合法性，再检查项目命名规则和同名分支。Git 合法不代表符合项目规则；严格采用某版本 Conventional Branch 时以对应规范或校验器为准。[Git 命名校验](https://git-scm.com/docs/git-check-ref-format)

## PR 标题

没有其他稳定格式约定时，采用 [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)：

```text
<type>[optional scope][!]: <imperative description>

feat(auth): add refresh-token rotation
refactor(api)!: remove legacy response field
```

- 按实际结果选择 type：`feat` 新功能、`fix` 修复缺陷；其他常用类型包括 `docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`、`revert`。这些扩展类型不是规范要求的固定白名单。`style` 指不改变代码含义的格式调整，不自动对应 UI 改动；性能改进用 `perf`，不把所有“优化”都归为 `chore`。
- scope 表达有依据的模块或代码区域，不默认填 Issue 编号。未要求且无法确认时省略。
- 描述概括最终变更及其可证实的影响。语言沿用用户要求或仓库稳定约定，无约定时匹配用户语言；默认简洁、祈使表达、结尾不加句号，长度以项目规则为准。
- 破坏性变更可用 `!` 和/或 `BREAKING CHANGE:` footer 表达，任意 type 均可使用。本 Skill 默认建议标题标 `!` 并说明破坏内容、正文补充迁移方法；仅 footer 的合法形式不应被误判，仓库更严格的校验要求优先。
- 标题不从分支前缀机械转换。混合无关目标时建议拆分；相关测试、文档等辅助改动不改变主要 type，也不需要单独列进标题。

Squash 不保证自动采用 PR 标题：GitHub 的默认消息取决于配置和提交数量，合并时还能编辑。使用提交历史驱动发布时，应核对最终 squash 消息及破坏性标记；merge/rebase 保留单独提交时，仅 PR 标题合规也不保证提交历史合规。[Squash 消息配置](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests)

## PR 正文

优先填写仓库模板；通过 API 或 CLI 传入正文时主动读取并填写模板，不依赖自动插入。没有模板时，简单 PR 用一两句说明具体问题和改后行为，再给出相关验证。复杂 PR 按需要补充实现取舍、Review 重点、风险、迁移或回滚说明，章节随复杂度增减。

- 面向未参与对话的审查者描述最终实现；需要时给出触发条件和前后行为，不复述聊天过程或逐文件罗列修改。范围变化后同步修订标题与正文。
- 验证写清命令或场景、结果和覆盖范围。区分“本次执行”“用户提供”“CI 报告”和“未运行”；没有证据时不能写“测试通过”或勾选完成项。未知风险不能写成 `None`。
- UI 改动可附截图或复现步骤；性能结论需要测量证据；兼容性、迁移、依赖或权限影响只在相关时展开。
- 引用真实 Issue。部分解决用 `Refs #123` 或普通链接；明确解决且意图关闭时才使用 `Closes #123`。GitHub 正文中的关闭关键词仅在 PR 以默认分支为目标时生效；面向发布或堆叠分支时不要承诺本次合并会自动关闭 Issue。[Issue 关联规则](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- 保留仓库模板要求的必填项和维护者已有说明。不适用项按模板标注原因；自选章节可省略，提交的正文不留空占位符或重复的 Checklist。[模板位置与用法](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)

## 可审查性与验证

- 一个 PR 尽量表达一个自包含目标，相关测试与文档一起纳入。无关大重构、格式化或依赖更新建议拆分；范围内的小清理不必机械拆出，不擅自替用户拆提交或丢弃改动。
- 大小是审查成本的判断，不设统一行数门槛。机械生成、锁文件和删除文件与手写逻辑区别评估；大 PR 提供关键文件、审查顺序或拆分建议。[Google Small CLs](https://github.com/google/eng-practices/blob/master/review/developer/small-cls.md)
- 检查完整目标 diff 的空白错误与意外改动。按涉及的代码和仓库要求选择 lint、类型检查、测试或构建；纯命名、文字润色不需要跑项目全套测试，也不自动修改代码来“优化 PR”。
- 验证结果必须对应被描述的版本。在有额外修改的工作区测试通过，不等于远程 PR head 已通过；说明差异，必要时在隔离工作树中验证目标提交。修复、同步或新增提交后重跑受影响检查，不沿用已失效结果。
- 检查失败或环境受限时记录原因，不绕过仓库策略；创建 PR 可以先于远程 CI 完成，是否 Ready 按实际完成度和项目流程决定。需要额外依赖或服务时，先完成当前可用验证和草稿。

## 交付

- 只要分支名或标题时，返回对应结果；完整草稿提供已知 base、当前或建议分支、标题和可直接使用的正文，验证结果只在正文写一次。
- 规范审查说明具体位置、规则依据和修订建议，区分必需修正与可选建议。用户要求代码审查时再展开缺陷、触发条件与影响；没有发现就如实说明。
- 实际操作后提供 PR 链接、已确认的状态和影响交付的限制。信息不足时明确哪些内容仅为建议，不把草稿描述为已创建的 PR。
