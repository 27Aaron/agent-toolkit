---
name: nixpkgs-packaging
description: 创建、更新和审查 Nix/Nixpkgs 软件包，包括 fetcher、固定输出 hash、语言依赖、更新脚本、元数据和验证流程。
---

# Nix/Nixpkgs 打包

当任务涉及为 Nix 或 Nixpkgs 打包软件、更新已有 derivation、将生成的 hash 拆分到数据文件，或让软件包更新流程可重复时，使用此技能。

当需要确认权威语法、fetcher 语义或更新脚本行为时，阅读 [references/official-links.md](references/official-links.md)。新建或审查软件包时，再阅读 [references/package-checklist.md](references/package-checklist.md)。优先参考当前 Nixpkgs 手册和目标仓库自己的 `pkgs/README.md`，不要依赖记忆或第三方示例。

## 范围和流程

1. 编辑前先检查目标仓库的指令、当前分支、工作区、软件包布局和已有 derivation，并保留无关改动。
2. 确认软件包实际对应的上游源码和构建系统。条件允许时，复用仓库已有的 builder 和依赖约定。
3. 根据 fetcher 的实际语义选择 fetcher：
   - GitHub 快照使用 `fetchFromGitHub`，获取 tag 时优先使用 `tag`。
   - 新增或更新固定输出 fetch 时使用 `hash = "sha256-..."`（SRI 格式）。
   - 将 `fetchSubmodules = true`、`fetchgit`、压缩包、补丁和生成的依赖存储视为不同的 hash 输入。
4. 版本或 fetcher 参数变化时，更新所有受影响的固定输出 hash。最终软件包中不得留下 fake hash。
5. 保持软件包可复现：固定相关工具的大版本（例如 `pnpm_10`），普通构建阶段不要访问网络，并使用 Nixpkgs 提供的语言构建器处理依赖。
6. 按风险进行验证：运行语法和数据检查，求值 derivation，并在本地 Nix store/daemon 可用时构建软件包。明确区分“求值成功”和“完整构建成功”。

## 新建和审查软件包

- 新的顶层软件包优先放在 `pkgs/by-name/<两位小写前缀>/<软件包名>/package.nix`。`pkgs/by-name` 中的软件包会自动加入顶层属性集，但其中的文件不能引用目录外的文件。
- 先确认上游项目有清晰许可证、可维护性和合理的使用场景。源代码可用时优先从源码构建；只有在确有必要时才包装上游二进制，并正确标记来源。
- 使用合适的语言框架，如 `buildPythonApplication`、`buildGoModule`、`buildRustPackage` 或 `buildNpmPackage`，不要用通用 `mkDerivation` 绕过已有框架。
- `meta` 放在 derivation 最后。至少核对 `description`、`homepage`、`license`、`maintainers`、`mainProgram` 和 `platforms`；包含第三方构建的二进制或字节码时补充 `meta.sourceProvenance`。
- 将构建时需要执行的工具放入 `nativeBuildInputs`，将目标平台的库放入 `buildInputs`，将语言运行时依赖放入语言框架对应的依赖字段，将测试工具放入 `nativeCheckInputs`。
- 使用 `finalAttrs` 引用最终版本、源码或派生属性；在 Nixpkgs 中不要为了覆盖已有软件包而新增不必要的 `overrideAttrs`/`overridePythonAttrs`。
- 覆盖构建阶段时保留对应的 `runHook pre<Phase>` 和 `runHook post<Phase>`，不要无理由重写整个标准阶段。
- Nixpkgs 禁止用 Import From Derivation 生成提交时需要的依赖数据；应把生成的 lockfile、依赖清单或 hash 文件提交到包目录。

详细的语言框架、测试、审查和 PR 检查项见 [references/package-checklist.md](references/package-checklist.md)。

## Hash 和 fetcher

Nixpkgs fetcher 属于固定输出 derivation。hash 标识的是 fetcher 的输出，不一定是远程压缩包逐字节的 hash。修改 `tag`、`rev`、`fetchSubmodules`、`sourceRoot`、`fetcherVersion`、补丁或依赖输入时，重新生成受影响的 hash。

新代码优先使用 `hash = "sha256-..."` 的 SRI 格式。GitHub tag 使用 `tag`；如果固定到 commit，使用完整 commit hash。Nixpkgs 的 `fetchFromGitHub` 会根据参数选择快照或递归 Git fetch，因此必须按实际参数计算 hash。

普通更新时，暂时将 Nix 表达式中的相关 hash 设置为 `lib.fakeHash`（或 Nixpkgs 文档规定的其他标准 fake hash），运行最小必要构建，并从 hash 不匹配错误中复制 `got` 的值。对于由 JSON 驱动的更新脚本，只能将对应的标准 fake SRI 值作为临时工作区值，并在失败时恢复原文件。

除非 fetcher 确实对下载文件本身计算 hash，否则不要用下载压缩包的 `sha256sum` 计算 `fetchFromGitHub` 的 hash。设置 `fetchSubmodules = true` 时，要使用递归 `fetchgit` 语义；子模块会改变最终结果。

常见的依赖 hash 都是相互独立的固定输出：

- `vendorHash` 是 `buildGoModule` 使用的 Go 模块依赖输出。
- `cargoHash`/`cargoDeps` 用于 Rust 依赖 vendoring。
- `npmDepsHash`、`yarnHash` 或传给 `fetchPnpmDeps` 的 hash，属于对应的 JavaScript 依赖存储。
- 不同平台的二进制 hash 应以平台为 key 保存，并且只重新生成受影响的构件。

## 保持生成值可维护

对于简单软件包，将版本和 hash 直接写在 `package.nix` 中最简单；当通用更新器可以修改字面量属性时，也能很好地配合 `nix-update-script`。

只有在用户明确要求、多个生成值需要一起更新，或更新器天然以该文件为管理对象时，才使用同目录的 `hashes.json` 等 JSON 文件。使用 `lib.importJSON` 加载，例如：

```nix
let
  versionData = lib.importJSON ./hashes.json;
  inherit (versionData) version hash;
in
...
```

如果这些值被移出 `package.nix`，不要保留一个无法更新它们的通用 `nix-update-script`。应添加专门的可执行 `update.sh` 或等效的自定义更新器，并让它：

- 发现上游 release；
- 写入临时的标准 fake hash；
- 使用 Nix 感知的预取工具或 `nix build` 错误获取真实 hash；
- 原子更新数据文件，并在失败时恢复；
- 不自行 commit 或 push。

如果标准更新器仍能正确处理表达式，不要仅仅因为软件包简单就额外添加自定义更新器。

Nixpkgs 的 `maintainers/scripts/update.nix` 可能并行执行多个更新脚本。脚本应从 `git rev-parse --show-toplevel` 找到工作树，不能假定当前目录就是仓库根目录，也不应自行 commit 或 push。需要使用通用更新器时，可优先尝试 `nix-update` 的语言依赖支持；自定义字段再使用专用脚本或 `--custom-dep`。

## 软件包专项检查

- 对 `buildGoModule`，源码更新后检查 `vendorHash` 是否变化；只有源码已经包含合适的 vendor 目录时，才使用 `vendorHash = null`。
- 对 pnpm，固定兼容的大版本，并在 lockfile、pnpm 大版本或 `fetcherVersion` 变化时重新生成依赖 hash。
- 对子模块，核对子模块 revision，并使用与 derivation 相同的 fetcher 参数计算递归源码输出。
- 保持元数据准确：适用时正确填写 `homepage`、`changelog`、`license`、`maintainers`、`mainProgram`、`platforms` 和源码来源类型。
- 当软件包有可靠的 CLI 版本信息或有意义的 smoke test 时，添加或保留安装检查/版本检查。

## 验证清单

根据软件包和环境选择适用的检查：

```bash
git diff --check
bash -n path/to/update.sh                 # 存在 shell 更新脚本时
jq empty path/to/hashes.json              # 存在 JSON 数据文件时
nix-instantiate --eval --strict ...       # 或使用 `nix eval`
nix build .#package                       # 本地 Nix daemon/store 可用时
nix-build -A package.passthru.tests       # 存在软件包测试时
./ci/nixpkgs-vet.sh master                # 修改 pkgs/by-name 结构时
nixpkgs-review wip                        # 审查 PR 和受影响的依赖时
```

如果软件包有可执行文件，至少运行主程序的 `--help`、`--version` 或等效 smoke test；如果构建了多个可执行文件，尽量逐个检查。交付前报告修改的文件、最终版本和 hash、已通过的检查、构建阻塞原因，以及工作区是否已 commit 或 push。只有用户明确要求时才 commit 或 push。
