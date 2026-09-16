# Nix/Nixpkgs 官方参考链接

以下均为官方或项目一手资料，用于查询语法和当前行为。下列 `unstable` 和 `master` 链接用于发现资料，不保证适用于目标分支。优先查看目标 checkout 的文档和实现，或将 GitHub 链接固定到目标 revision；`stable` 也只表示当前稳定版，不能代替特定历史版本的文档。

## Nixpkgs 打包和 fetcher

- [Nixpkgs 参考手册](https://nixos.org/manual/nixpkgs/unstable/)
- [Fetcher 总览和固定输出注意事项](https://nixos.org/manual/nixpkgs/unstable/#chap-pkgs-fetchers)
- [更新源码 hash](https://nixos.org/manual/nixpkgs/unstable/#sec-pkgs-fetchers-updating-source-hashes)
- [安全地获取 hash](https://nixos.org/manual/nixpkgs/unstable/#sec-pkgs-fetchers-secure-hashes)
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
- [Flake 本地路径与 Git 输入](https://nix.dev/manual/nix/stable/command-ref/new-cli/nix3-flake.html#path-like-syntax)

## 更新和审查工具

- [`nix-update`](https://github.com/Mic92/nix-update)
- [Nixpkgs 自动更新 bot（r-ryantm / nixpkgs-update）维护者 FAQ](https://nix-community.github.io/nixpkgs-update/nixpkgs-maintainer-faq/)
- [`nixpkgs-review`](https://github.com/Mic92/nixpkgs-review)
- [`nix-init`](https://github.com/nix-community/nix-init)
- [`passthru.updateScript` 接口](https://nixos.org/manual/nixpkgs/unstable/#var-passthru-updateScript)
- [Nixpkgs 更新脚本调度实现](https://github.com/NixOS/nixpkgs/blob/master/maintainers/scripts/update.py)

## Nixpkgs 贡献和提交

- [Nixpkgs 贡献指南](https://github.com/NixOS/nixpkgs/blob/master/CONTRIBUTING.md)
- [Nixpkgs 提交规范（位于 `pkgs/README.md`）](https://github.com/NixOS/nixpkgs/blob/master/pkgs/README.md#commit-conventions)

## 搜索关键词

如果手册目录发生变化，可在 Nixpkgs 参考手册中搜索：

`fixed-output`, `Updating source hashes`, `fetchFromGitHub`, `vendorHash`, `fetchPnpmDeps`, `fetcherVersion`, `passthru.updateScript`.
