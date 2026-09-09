# 安全、权限与 RLS

先画出角色、租户和资源关系，再写 GRANT 和策略。对象权限决定“能否访问表”，RLS 决定“能看到或修改哪些行”，两者必须同时验证。

## 权限分层

- 默认使用最小权限角色；区分迁移、服务端、后台任务和终端用户角色。
- 检查 Schema `USAGE`、表/列权限、所需序列权限和函数 `EXECUTE`。RLS 不限制某一列能否更新，敏感字段还需列权限或受控写入路径。
- 表所有者通常绕过 RLS，`FORCE ROW LEVEL SECURITY` 可让所有者受策略约束；超级用户和 `BYPASSRLS` 角色仍可绕过。测试时记录 `session_user`、`current_user` 和角色继承，不能只在管理员会话验证。
- `ALTER DEFAULT PRIVILEGES` 影响指定创建角色之后创建的对象，不修复已有对象；现有 GRANT 与未来默认权限分别处理。[默认权限](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)

## 策略设计

启用 RLS 后，对受 RLS 约束的角色，没有适用策略时默认拒绝。`USING` 控制现有行，`WITH CHECK` 检查插入/更新后的行；INSERT 使用 `WITH CHECK`，DELETE 使用 `USING`，UPDATE 通常还需要匹配的 SELECT 权限与策略。[CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)

检查全部适用策略：同一命令/角色的 permissive 策略默认以 OR 合并，新增一条严格策略未必收紧原有宽松策略；restrictive 策略以 AND 限制，但仍需要 permissive 策略允许访问。[行级安全](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## 租户上下文示例

以下仅适用于**受信任后端代用户执行 SQL**：后端先验证身份与租户成员关系，终端用户不能以 `app_user` 直连执行任意 SQL，也不能调用能改写上下文的 RPC。自定义 GUC `app.tenant_id` 本身不是身份凭证；拥有该 SQL 执行能力的客户端可以改值，不能用此方案隔离不可信数据库用户。

后端在同一显式事务中用绑定参数执行 `SELECT set_config('app.tenant_id', $1::text, true)`，随后执行业务 SQL 并提交/回滚；每次请求重新设置，不依赖池连接上一次的状态。[连接管理](connection-pooling.md)

假定已有 `app.orders(tenant_id uuid, ...)`、非所有者且无 `BYPASSRLS` 的 `app_user`，并已授予所需 Schema 和表/列权限。下面演示 SELECT 与 UPDATE 策略，其他命令按实际业务单独设计：

```sql
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_select_own_tenant
ON app.orders
FOR SELECT
TO app_user
USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY orders_update_own_tenant
ON app.orders
FOR UPDATE
TO app_user
USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
```

缺失或空上下文转为 NULL，使策略不放行；`WITH CHECK` 阻止将可见行改到其他租户。部署到已有表时先检查旧策略，不能假定添加这两条策略就替换了原有授权。

## 视图与安全函数

- 视图可能使用所有者权限访问底层表；PostgreSQL 15+ 可按需求使用 `security_invoker = true`，并验证调用者的底层权限/RLS。旧版本使用受限入口或收紧视图访问，不假定底层启用 RLS 就自动保护视图。[CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html)
- `SECURITY DEFINER` 只在确需提权时使用，函数所有者也遵循最小权限。固定可信 `search_path`（例如 `pg_catalog, app_private, pg_temp`，其中 `app_private` 不允许不可信角色创建对象），明确限定对象名，避免临时对象或同名对象劫持。
- 新函数默认可能向 `PUBLIC` 授予 `EXECUTE`；创建函数、收紧执行权限及向目标角色授权放在同一事务中，避免暴露窗口。非公开 Schema 不替代调用权限与函数内身份检查，公开 RPC 更需检查实际调用路径。[安全的 SECURITY DEFINER 函数](https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)

## 验证

- 覆盖相关命令的允许与拒绝路径：同租户、跨租户、缺失上下文、修改租户 ID、越权字段，以及实际使用的 JOIN、视图和函数。
- 用真实角色和应用连接方式测试；池连接连续处理两个不同租户，确认没有串用上下文。区分过滤为 0 行、`WITH CHECK` 拒绝与对象权限错误。
- 策略切换与授权步骤需避免短暂的全表可见窗口。RLS 不保证跨表关系属于同租户，关联完整性见 [Schema 约束](schema-data-types.md)。
