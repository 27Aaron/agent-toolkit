# 并发、事务与锁

并发设计要同时说明一致性目标、锁范围、等待上限、重试边界和失败后的状态。短事务通常比盲目提高连接数更有效。

## 事务与锁

- 事务内只做必要工作，不在持锁期间调用不受控的网络服务或等待用户输入。
- 多表、多行操作固定锁顺序；统一访问顺序可降低死锁概率。为锁等待设置合理的 `lock_timeout`，并在应用层识别可重试的死锁和序列化失败。
- 选择隔离级别要对应业务不变量；`READ COMMITTED` 的每条语句快照不等同于整个事务快照。
- 乐观并发优先使用递增版本列，在同一条 `UPDATE` 中匹配旧版本并递增；影响零行时区分不存在、无权限与版本冲突。`updated_at` 只有在每次写入都可靠变化且精度足够时才适合作版本标记。

对 SQLSTATE `40001`（序列化失败）和 `40P01`（死锁），回滚后有限重试**完整事务及决定 SQL/参数的逻辑**，使用退避和总 deadline。不要只重试最后一条语句，也不要把所有唯一冲突当成瞬时失败。提交结果因断线而未知时，先凭幂等键或业务状态核对，避免重复执行外部动作。[事务重试](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html)

库存扣减等单行不变量可用带条件的原子更新；UPSERT 的冲突目标需要匹配的唯一约束/索引，不能先查是否存在再无条件插入。跨多行不变量要明确约束、锁或隔离级别如何阻止竞争，并用两个会话交错执行验证。

## 锁等待诊断

先识别阻塞链及事务年龄，避免只依据当前 SQL 判断阻塞原因：

```sql
SELECT pid, usename, state, wait_event_type, wait_event,
       clock_timestamp() - xact_start AS transaction_age,
       pg_blocking_pids(pid) AS blocking_pids
FROM pg_stat_activity
WHERE datname = current_database()
  AND wait_event_type = 'Lock'
ORDER BY xact_start NULLS LAST;
```

继续查看阻塞 PID 的事务和调用方；空闲事务也可能持锁。跨角色可见信息受权限限制；`pg_cancel_backend` 取消语句后不保证已释放整个事务持有的锁，不能把取消查询或终止会话当作默认修复。[会话信息函数](https://www.postgresql.org/docs/current/functions-info.html)、[服务器信号函数](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL)

## 队列领取

`FOR UPDATE SKIP LOCKED` 适合多个消费者领取互不冲突的任务，但会牺牲严格公平性。领取和状态变更应在一个短事务内完成，并有索引支持状态与排序条件：

```sql
WITH next_job AS (
  SELECT id
  FROM app.jobs
  WHERE status = 'pending'
    AND run_at <= now()
  ORDER BY run_at, id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE app.jobs AS j
SET status = 'processing',
    claimed_at = now()
FROM next_job
WHERE j.id = next_job.id
  AND j.status = 'pending'
RETURNING j.*;
```

领取语句成功后先提交，再执行任务；事务内不等待任务处理完成。`SKIP LOCKED` 不保证严格 FIFO，也不能提供恰好一次执行。需要超时重领时记录租约及每次领取的 token/版本，续租和完成更新都匹配该 token，防止过期 worker 覆盖新领取者的状态；外部动作另用幂等键，失败需有限重试和死信处理。

## Advisory Lock

Advisory lock 适合保护明确的应用级资源，但必须定义键空间、持有范围、超时和进程崩溃后的行为。事务池内优先使用事务级锁（如 `pg_advisory_xact_lock`）；会话级锁不会随事务回滚释放，也不能依赖下一次请求取得同一连接。它只协调遵循相同约定的调用方，不能替代数据库约束。[显式锁](https://www.postgresql.org/docs/current/explicit-locking.html)
