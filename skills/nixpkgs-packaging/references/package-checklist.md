# 软件包专项检查

用于新包、打包审查，以及版本更新涉及的专项检查。通用 hash 和验证流程见 [主文件](../SKILL.md)，更新脚本细节见 [更新流程](update-workflow.md)。只检查适用项，不为完成清单扩大改动范围。

## Nixpkgs 上游贡献

本节仅适用于向 Nixpkgs 贡献软件包，独立 flake、overlay 和个人包集遵循自己的约定。

- 核对目标 checkout 的 `CONTRIBUTING.md`、`pkgs/README.md` 及目录规范。评估上游许可证、维护状态、使用场景和维护责任是否满足收录要求。
- 新顶层包通常放在 `pkgs/by-name/<两位小写前缀>/<包名>/package.nix`；语言包集等特殊位置按仓库规范处理。by-name 包会自动加入顶层属性集，包目录内的文件不得通过文件路径引用目录外文件。
- 需要修改包定义时直接修改，不增加无必要的 `overrideAttrs`/`overridePythonAttrs` 包装。个人 overlay 中则可按需要使用这些接口。
- 不用 Import From Derivation 在求值时生成需要随包提交的依赖数据；按对应 builder 要求保存 lockfile、依赖清单或 hash 文件。
- 提交标题遵循 `pkg: old -> new`、`pkg: init at version` 或仓库对应格式；PR 标题概括实际改动，版本更新附上游 release/changelog。执行提交、推送和 PR 修改的授权边界见主文件。

## Derivation 和依赖

- 选择适合项目的语言 builder，例如 Python 的应用/库 builder、`buildGoModule`、`buildRustPackage` 或 `buildNpmPackage`；只有现有框架不适合时才采用自定义构建。
- 需要引用最终版本、源码或派生属性且 builder 支持时使用 `finalAttrs`；不为简单更新重写无关表达式。
- 构建平台上执行的工具放在 `nativeBuildInputs`，目标平台的系统库放在 `buildInputs`，测试工具放在 `nativeCheckInputs`。语言依赖使用框架专用字段，并区分构建和运行依赖。
- Python 在目标框架支持时使用 `build-system` 和 `dependencies`。Go 检查 `vendorHash`；`null` 表示跳过依赖 vendoring derivation，须确认源码自带可用依赖或不需要外部模块。Rust 按包使用的 Cargo 依赖机制维护 hash。
- Go 包核对 `go.mod` 的 `go` 指令与默认 `buildGoModule` 的工具链版本，必要时使用版本化 builder（如 `buildGo127Module`）。
- pnpm 选择兼容 lockfile 的工具大版本；lockfile、工具大版本或 `fetcherVersion` 变化时检查依赖输出。接口以目标 revision 为准。
- 覆盖标准阶段时保留对应 `runHook pre<Phase>` 和 `runHook post<Phase>`；可通过属性或 hook 完成时，不无理由重写整个阶段。
- wrapper 参数不做 shell 展开：`${qtWrapperArgs[@]}` 这类数组语法不能放进 `makeWrapperArgs`，应在 `preFixup` 中追加：`makeWrapperArgs+=("''${qtWrapperArgs[@]}")`。
- Python builder 把 `doCheck`/`nativeCheckInputs` 映射到 installCheck；其他 builder 中 `installCheckPhase` 需要 `doInstallCheck = true` 才会执行。

## 元数据和测试

- 按仓库约定将 `meta` 放在 derivation 最后。核对 `description`、`homepage`、`license`、`platforms`，以及适用的 `changelog`、`maintainers` 和 `mainProgram`。Nixpkgs 英文 description 简短、客观、首字母大写、不以句号结尾。
- 包含第三方预编译二进制或字节码时，设置对应 `meta.sourceProvenance`，不要将其标作纯源码构建。
- 保留上游测试；必须禁用时说明具体原因。存在可靠 CLI 时按需使用 `versionCheckHook` 或等效安装检查；Python 包可使用 `pythonImportsCheck` 验证导入。
- 集成测试按需放入 `passthru.tests`，通过目标项目入口运行具体测试属性。smoke test 和导入检查不能替代完整构建及上游测试结论。
- 不为消除辅助工具（如 `desktop-file-validate`）的 hint 而偏离上游文件，只有实际错误才处理。
