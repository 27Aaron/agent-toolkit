# Nix/Nixpkgs 打包检查清单

这份清单用于新建软件包、版本升级和 PR 自查。根据目标包的语言和仓库约定选择适用项，不要为了“勾满”而增加无关改动。

## 开始前

- [ ] 已阅读目标仓库中的 `AGENTS.md`、`CONTRIBUTING.md`、`pkgs/README.md` 或同类指令。
- [ ] 已确认上游项目、版本/tag、许可证、发布渠道和维护状态。
- [ ] 已确认这是源码包、预编译二进制包，还是包含两者的混合包。
- [ ] 已确认包名、属性名和目录位置；新顶层包优先使用 `pkgs/by-name`。

## Derivation

- [ ] 使用最贴近项目构建系统的 Nixpkgs builder。
- [ ] 使用 `finalAttrs` 处理版本、源码 URL、源码目录名和派生属性。
- [ ] 依赖放在正确字段：
  - 构建阶段执行的工具：`nativeBuildInputs`
  - 目标平台链接或运行所需的系统库：`buildInputs`
  - Python 运行依赖：`dependencies`
  - Python 构建依赖：`build-system`
  - 测试工具：`nativeCheckInputs`
  - Go、Rust、npm、pnpm 等语言依赖：使用对应 builder/fetcher 的专用字段
- [ ] 不在普通构建阶段访问网络；网络依赖通过固定输出 fetcher 提前获取并锁定。
- [ ] 自定义阶段保留 `runHook`，并记录非默认阶段或特殊参数的原因。
- [ ] `pkgs/by-name` 包只引用自身目录内的文件。

## 源码和 hash

- [ ] GitHub 项目使用 `fetchFromGitHub`，tag 使用 `tag`，commit 使用完整 revision。
- [ ] hash 使用 `hash = "sha256-..."` 的 SRI 格式。
- [ ] 明确每个 hash 对应的输出：源码、子模块、Go vendor、Cargo 依赖、npm/pnpm/yarn 依赖或平台二进制。
- [ ] 修改 fetcher 参数后，所有受影响的固定输出 hash 都已重新生成。
- [ ] 临时更新时只使用 `lib.fakeHash`、空字符串或其他官方标准 fake hash；最终文件不能留下 fake hash。
- [ ] `fetchSubmodules = true` 时按递归 `fetchgit` 的输出计算 hash，不能直接使用压缩包的 `sha256sum`。

## 元数据和测试

- [ ] `meta` 位于 derivation 最后。
- [ ] `meta.description` 简短、客观、首字母大写且不以句号结尾。
- [ ] `license` 与上游一致，`maintainers`、`platforms` 和 `mainProgram`（适用时）准确。
- [ ] 使用第三方预编译代码时设置正确的 `meta.sourceProvenance`。
- [ ] 保留上游测试；如果禁用测试，注释说明原因和分发安全性判断。
- [ ] 有可靠 CLI 时加入 `versionCheckHook` 或等效版本检查。
- [ ] 无法运行完整测试时，至少保留 `pythonImportsCheck`、`--help`、`--version` 或安装后 smoke test。
- [ ] 复杂集成测试放入 `passthru.tests`，并按需用 `nix-build -A package.passthru.tests` 执行。

## 更新脚本

- [ ] 简单的字面量版本和 hash 优先使用通用 `nix-update-script`。
- [ ] 如果版本或 hash 从 JSON/其他数据文件导入，通用更新器无法修改时再使用专用 `update.sh`。
- [ ] 专用脚本使用 Nix 感知的预取或 fake-hash 构建获取真实 hash。
- [ ] 多个固定输出按依赖顺序更新，例如先源码，再前端依赖，最后 Go/Rust 依赖。
- [ ] 更新脚本失败时恢复工作区，不提交 fake hash。
- [ ] 更新脚本不自行创建 commit、push 或修改无关文件。

## 本地验证

```bash
git diff --check
nix fmt
nix eval .#package --json
nix build .#package
nix build .#package.passthru.tests.example
./ci/nixpkgs-vet.sh master
nixpkgs-review wip
```

`nix build`、`nixpkgs-review` 和测试命令按环境与任务范围选择。若 Nix daemon、网络或二进制缓存不可用，应报告阻塞原因，不要把求值通过当作完整构建通过。

## 提交和 PR

- [ ] 提交标题遵循 Nixpkgs 的 `(pkg-name): old -> new`、`init at version` 或相应修复格式。
- [ ] PR 标题与提交标题保持一致或能概括所有提交；包名前缀有助于 CI 识别要构建的包。
- [ ] 版本更新说明上游 release/changelog，特殊打包选择在注释或 PR 描述中说明。
- [ ] 只有用户明确要求时才 commit、push 或修改 PR 元数据。
