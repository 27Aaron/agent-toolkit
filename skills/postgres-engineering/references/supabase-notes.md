# Supabase 专项

项目材料或用户请求表明使用 Supabase 时读取本章。`auth.uid()`、`auth.jwt()`、Data API 暴露 Schema、Supavisor 和 CLI 迁移流程都属于平台上下文，不能推广成通用 PostgreSQL 规则。通用授权、策略组合和函数要求见 [安全与 RLS](security-rls.md)。

## 安全与 RLS

- 把 `anon`、`authenticated`、服务端角色和后台任务分别建模，确认 Data API 暴露配置、GRANT 与 RLS 同时成立。不要把 `service_role`/secret key 放进客户端或拿绕过 RLS 的调用当权限测试；实际访问身份还取决于请求携带的用户 JWT。
- `auth.uid()` 在未认证请求中返回 NULL；策略表达式为 NULL 时不会放行。用户 ID 不等于租户 ID，应验证租户成员关系。按 SQL 命令设计 `USING` / `WITH CHECK`，INSERT 策略不能照搬 UPDATE 的子句。
- 不使用用户可修改的 `user_metadata` 作为授权依据。即使是受控的 `app_metadata`，JWT 中的权限信息也可能在刷新前过期；需要及时撤销权限时核对当前数据库成员关系或设计相应的令牌失效机制。
- `(SELECT auth.uid())` 可让与当前行无关的身份函数通过 initPlan 按语句求值；只在结果不依赖行数据时使用，并验证计划，不把所有策略函数机械包成子查询。
- 内部 `SECURITY DEFINER` 辅助函数优先放在不暴露的 Schema；确需公开为 RPC 时明确授权、调用者检查及提权范围。视图/函数/暴露 Schema 的权限变更通过实际 API 和用户 JWT 测试。

## 平台流程

- Supabase 变化较快；实现前核对当前官方文档、CLI 版本和项目迁移约定，不凭记忆猜命令或配置。
- 区分直连、会话池与事务池的连接地址和能力。迁移工具的会话状态、锁和预备语句需求必须匹配所选连接；不要把 PgBouncer 的功能矩阵直接套给 Supavisor。[连接数据库](https://supabase.com/docs/guides/database/connecting-to-postgres)
- 连接池、分支数据库、备份恢复、扩展和 Edge/Realtime 等能力按项目实际启用情况判断；不要将未使用的产品假设写进通用迁移。
- 任何平台顾问或自动修复结果都要回到 Schema、权限、查询计划和应用调用方验证。

参考：[Supabase RLS 文档](https://supabase.com/docs/guides/database/postgres/row-level-security)、[API 安全](https://supabase.com/docs/guides/api/securing-your-api)。
