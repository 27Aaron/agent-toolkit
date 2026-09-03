# Nix/Nixpkgs 官方参考链接

以下均为官方或项目一手资料，用于查询语法和当前行为。目标是 stable 分支时，可将 Nixpkgs 手册链接中的 `unstable` 替换为 `stable`；`unstable` 对应当前 Nixpkgs 开发文档。

## Nixpkgs 打包和 fetcher

- [Nixpkgs 参考手册](https://nixos.org/manual/nixpkgs/unstable/)
- [Fetcher 总览和固定输出注意事项](https://nixos.org/manual/nixpkgs/unstable/#sec-pkgs-fetchers)
- [更新源码 hash](https://nixos.org/manual/nixpkgs/unstable/#sec-pkgs-fetchers-updating-source-hashes)
- [安全地获取 hash](https://nixos.org/manual/nixpkgs/unstable/#sec-pkgs-fetchers-obtaining-hashes-securely)
- [`fetchFromGitHub`](https://nixos.org/manual/nixpkgs/unstable/#sec-pkgs-fetchers-fetchFromGitHub)
- [Nixpkgs 快速添加软件包和打包规范](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#quick-start-to-adding-a-package)
- [Nixpkgs 软件包来源和 hash 规范](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#sources)
- [Nixpkgs 软件包元数据规范](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#meta-attributes)
- [`pkgs/by-name` 目录规范](https://github.com/NixOS/nixpkgs/blob/master/pkgs/by-name/README.md)
- [Nixpkgs 软件包 README：自动更新和 `updateScript`](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#automatic-package-updates)
- [Nixpkgs 软件包测试](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#package-tests)

## 语言构建器和依赖存储

- [Go：`buildGoModule` 和 `vendorHash`](https://nixos.org/manual/nixpkgs/unstable/#sec-language-go)
- [JavaScript：pnpm、`fetchPnpmDeps` 和 `fetcherVersion`](https://nixos.org/manual/nixpkgs/unstable/#javascript-pnpm)
- [JavaScript：npm 打包](https://nixos.org/manual/nixpkgs/unstable/#javascript)
- [Rust：`buildRustPackage` 和 Cargo hash](https://nixos.org/manual/nixpkgs/unstable/#rust)
- [Python：`buildPythonPackage`、`buildPythonApplication` 和依赖字段](https://github.com/NixOS/nixpkgs/blob/master/doc/languages-frameworks/python.section.md)

## Nix 核心 hash 模型

- [Nix 高级 derivation 属性](https://nix.dev/manual/nix/stable/language/advanced-attributes.html)
- [Nix 术语表：固定输出 derivation](https://nix.dev/manual/nix/stable/glossary)

## 更新和审查工具

- [`nix-update`](https://github.com/Mic92/nix-update)
- [`nixpkgs-review`](https://github.com/Mic92/nixpkgs-review)
- [`nix-init`](https://github.com/nix-community/nix-init)

## Nixpkgs 贡献和提交

- [Nixpkgs 贡献指南](https://github.com/NixOS/nixpkgs/blob/master/CONTRIBUTING.md)
- [Nixpkgs 提交规范（位于 `pkgs/README.md`）](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#commit-conventions)

## 搜索关键词

如果手册目录发生变化，可在 Nixpkgs 参考手册中搜索：

`fixed-output`, `Updating source hashes`, `fetchFromGitHub`, `vendorHash`, `fetchPnpmDeps`, `fetcherVersion`, `passthru.updateScript`.
