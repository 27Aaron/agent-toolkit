---
name: nixpkgs-packaging
description: 创建、更新或审查 Nix/Nixpkgs 软件包 derivation，处理源码和依赖 hash、构建依赖及软件包更新脚本。适用于软件打包，不用于一般 NixOS 或 Home Manager 配置。
metadata:
  author: Aaron
  version: "1.0.2"
---

# Nix/Nixpkgs 打包

## 确定范围

- 用户仅要求审查时，报告发现和验证结果，不自动修改软件包；实施任务按用户要求的范围修复。
- 先确认目标是 Nixpkgs 上游仓库，还是独立 flake、overlay 或个人包集。Nixpkgs 的目录、收录和贡献要求只适用于上游贡献；独立项目沿用自身结构和约定。
- 检查目标仓库指令、工作区、已有 derivation、上游源码和构建系统。保留用户已有修改，只处理本次要求的软件包及必要依赖。
- 用户指定版本时使用该版本；自动选择版本时遵循现有发布渠道和稳定版/预发布约定。
- 语法和 builder/fetcher 行为以目标 Nixpkgs revision 的实现及文档为准。需要查询一手资料时阅读 [官方链接](references/official-links.md)，不要将当前 unstable 文档中的新接口直接套用到旧分支。
- 新建或审查软件包时阅读 [打包检查清单](references/package-checklist.md)；修改更新器或生成数据布局时阅读 [更新脚本与生成数据](references/update-workflow.md)。普通版本更新按涉及的部分查阅。

## 打包流程

1. 复用适合构建系统的语言 builder 和仓库依赖约定。源代码可用时优先从源码构建；包装预编译代码时准确记录许可证和来源。
2. 选择匹配所需源码的 fetcher。GitHub 源码快照优先用 `fetchFromGitHub`；目标版本支持时用 `tag` 获取 tag，固定 commit 时使用完整 revision。不要把发布附件当作源码快照。
3. 确定源码、语言依赖存储和平台二进制各自对应的固定输出，按依赖关系更新版本及受影响的 hash。
4. 普通构建阶段不访问网络；语言依赖通过对应 builder/fetcher 预先获取。对 pnpm 等依赖工具版本的流程选择目标仓库提供且与 lockfile 兼容的版本。
5. 按下述验证流程检查结果。交付文件中不得留下临时 fake hash；获取真实 hash 受阻时，还原本次未完成的一组版本/hash 修改，保留其他已有改动，并报告更新未完成。不要留下新版本配旧 hash 的组合。

## Hash 和 fetcher

hash 标识固定输出 derivation 的输出，不一定是远程文件逐字节的 hash。先确定变化发生在哪个 derivation，再计算受影响的输出：

- 源码 fetcher 的 `tag`、`rev`、子模块选项或输出处理变化时，重新获取源码 hash。
- 外层 derivation 的 `sourceRoot` 或构建阶段补丁变化不自动改变 `src.hash`；若它们被依赖 fetcher 使用，则检查对应依赖输出。远程补丁自己的下载 hash 单独处理。
- Go 的 `vendorHash`、Rust 的 `cargoHash` 或 `cargoDeps` 中的 hash、npm/pnpm/yarn 依赖 hash 分别对应各自的依赖输出，不能互换。源码更新后检查这些输出是否受影响，不假设每个 hash 都一定变化。
- 平台二进制按各自 URL 和输出记录 hash，仅重新生成受影响的构件；保留仓库已有数据结构。

新增或更新 hash 时优先使用 SRI 格式，并使用 builder 要求的字段名，例如 `hash`、`vendorHash` 或 `npmDepsHash`。用与 derivation 参数一致的 Nix 感知预取工具，或临时设置 `lib.fakeHash` 后构建目标固定输出。从错误中获取 `got` 时，确认报错的 derivation 正是当前待更新的输出；网络、求值或普通构建错误不能作为 hash 结果。

输入变化后沿用旧 hash，可能直接复用 Nix store 中的旧输出。因此一次成功构建不能证明旧 hash 仍然正确；应通过独立预取或标准 fake hash 重新获取受影响输出的 hash，再判断它是否变化。

`fetchFromGitHub` 会按参数选择快照或 Git fetch。启用 `fetchSubmodules` 时按实际递归输出计算 hash，不能使用下载压缩包的 `sha256sum` 代替。更新 fake hash 后重新验证，不能把预期的 hash mismatch 当作完整构建通过。

## 更新器选择

简单软件包优先在 `package.nix` 中保留版本和 hash 字面量，并复用能够正确更新它们的通用更新器。只有用户要求、多个生成值需要统一管理或现有更新器以数据文件为输入时，才考虑 JSON 等外部文件。

调整数据布局时同步检查更新器能否读写新位置；确实无法使用通用工具时再添加自定义脚本。具体要求见 [更新脚本与生成数据](references/update-workflow.md)。

## 验证和交付

按改动和环境选择检查，不机械执行所有命令：

- 用仓库指定格式化器检查或格式化本次修改的文件，并运行 `git diff --check`；不要为单包修改格式化整个仓库。
- 存在更新脚本时按实际解释器检查语法，例如 Bash 使用 `bash -n path/to/update.sh`；存在 JSON 数据时运行 `jq empty path/to/hashes.json`，并核对消费者要求的字段。
- 使用目标项目的入口求值并构建软件包。flake 项目可用 `nix eval .#package.drvPath` 和 `nix build .#package`；传统 Nixpkgs checkout 可用 `nix-instantiate -A package` 和 `nix-build -A package`。替换示例属性名，并确认入口实际包含本次修改。
- Git flake 默认不会纳入 untracked 文件。新增包或数据文件时确认它们实际进入求值输入；需要暂存时遵循已有授权，也可在合适的临时副本中验证或使用明确的 `path:` 入口。切换入口时检查源文件集合和对 Git 元数据的依赖。
- 构建环境和目标平台可用时运行完整构建及适用的 `passthru.tests`。对可在当前环境运行的程序执行有意义的版本检查或 smoke test；跨平台产物不能直接运行时说明限制。
- Nixpkgs 上游贡献按目标分支要求运行结构检查；PR 审查或改动影响依赖包时按需使用 `nixpkgs-review`。命令和比较基线以目标 checkout 为准。

报告修改结果、通过的验证和未完成的验证及原因，明确区分静态检查、求值、构建和运行测试。版本或 hash 更新应指出最终版本及相关数据位置，不必重复列出所有长 hash。只有用户明确要求时才 commit、push 或修改 PR 元数据。
