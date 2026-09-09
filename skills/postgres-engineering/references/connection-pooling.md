# 连接管理

连接数是数据库容量的一部分，不是越大越好。按数据库内存、查询并发、应用副本、池化方式和上游队列共同计算，并用指标验证。

## 池化决策

- 直连的连接上限按各服务「副本数 × 每副本进程数 × 进程池上限」加总，并包含滚动发布期间的额外副本、任务和直连工具；为迁移、监控和管理员保留余量。
- 有池化器时分开计算客户端连接与 PostgreSQL 后端连接。PgBouncer 的池大小通常按数据库/用户组合生效，多池化器实例还会叠加，不能把单个 `default_pool_size` 当作数据库总上限。[池容量配置](https://www.pgbouncer.org/config.html#default_pool_size)
- Serverless 或突发工作负载优先控制连接创建和请求并发，不通过无限增大数据库连接上限解决排队。
- 记录活跃、空闲、等待锁和长事务连接；`idle in transaction` 往往比普通空闲连接更危险。

## 事务池兼容性

事务结束后后端连接可能换人使用；按具体池化器、版本、驱动和配置验证：

- `LISTEN`、跨事务临时表、会话级 advisory lock，以及依赖持久 `SET` 状态的代码通常需要会话池或专用连接。
- 租户上下文和事务级设置在同一显式事务中用 `SET LOCAL` 或 `set_config(..., true)` 设置并使用；不要在一条自动提交语句中设置后，指望下一条语句继承它。
- 预备语句区分 SQL `PREPARE` / `DEALLOCATE` 与驱动的协议级 prepared statements。PgBouncer 的事务池可在受支持版本且 `max_prepared_statements` 非零时跟踪协议级命名语句；这不代表 SQL `PREPARE` 可跨事务使用，也不代表所有池化器都有同样能力。

兼容矩阵见 [PgBouncer 功能](https://www.pgbouncer.org/features.html)；Supabase 项目同时核对 [平台说明](supabase-notes.md)。

## 超时

按角色或会话设置有理由的 `statement_timeout`、`lock_timeout` 和 `idle_in_transaction_session_timeout`。先在低风险范围验证，再决定是否提升到全局配置；不要直接复制固定秒数或通过 `ALTER SYSTEM` 覆盖托管平台设置。

将获取连接、等待锁、执行语句和上游请求分别设限，给取消与回滚留出时间。需要让锁超时先触发时，`lock_timeout` 应小于有效的 `statement_timeout`。客户端超时不保证服务端已停止；出错连接先回滚或按驱动约定丢弃，再归还池。

不要把 `work_mem` 当成每个连接的固定内存上限：多个排序/哈希节点和并行 worker 可能各自用内存，哈希还受 `hash_mem_multiplier` 影响。按活跃并发和计划估算峰值，再做局部调整。[资源配置](https://www.postgresql.org/docs/current/runtime-config-resource.html)、[超时配置](https://www.postgresql.org/docs/current/runtime-config-client.html)

## 诊断

结合 `pg_stat_activity`、连接池指标、锁等待、查询延迟和数据库 CPU/I/O 判断瓶颈。区分连接耗尽、查询慢、锁等待和网络排队；单独调大池上限可能让后三者更严重。
