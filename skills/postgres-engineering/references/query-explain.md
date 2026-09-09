# EXPLAIN 与性能诊断

性能结论必须绑定真实 SQL、参数、数据规模和版本。执行计划中的 cost 是优化器估算单位，不是用户实际等待时间。

## 取证顺序

1. 记录脱敏后的完整 SQL、参数类型/代表性取值、调用频率、并发量、目标延迟和返回行数，以及执行角色、RLS、`search_path` 和预备语句使用方式。
2. 先使用不执行查询的 `EXPLAIN` 查看计划；需要比较时固定数据状态和参数。
3. 需要实际耗时和缓冲区信息时，在安全环境使用：

```sql
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, TIMING OFF, FORMAT JSON)
SELECT id, total
FROM app.orders
WHERE tenant_id = $1 AND status = $2
ORDER BY created_at DESC, id DESC
LIMIT $3;
```

此处 `$1`–`$3` 由驱动绑定；`psql` 中使用匹配参数类型的 `PREPARE` / `EXPLAIN ... EXECUTE`，或明确的脱敏字面值。应用实际使用预备语句时，字面值计划不能替代其通用/定制计划的验证。[PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html)

`EXPLAIN ANALYZE` 会执行语句，`SELECT` 也可能通过函数产生写入、序列消耗或外部副作用；事务回滚不是完整的副作用隔离。`TIMING OFF` 保留行数及整体执行时间、减少逐节点计时开销，需要节点耗时时再启用计时。[EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)

## 重点观察

- 估算与实际行数的偏差；`actual rows` 和启用计时后的节点时间通常是每次执行的平均值，结合 `loops` 理解总工作量。父节点包含子节点工作，不把树上所有时间简单相加
- `Seq Scan`、`Index Scan`、`Bitmap Heap Scan` 是否符合表规模和选择性
- `Sort`、`Hash` 是否溢出内存或产生临时文件
- `Rows Removed by Filter` 对应的过滤位置及选择性，不能仅凭数量就断定缺索引
- `Buffers` 的 hit/read、临时块及可用的 I/O 时间；shared read 可能命中操作系统缓存，不能直接等同于物理磁盘读取
- 规划时间、执行时间、并行度、连接顺序和参数敏感性

不要为了让计划出现 `Index Scan` 而关闭 `enable_seqscan`；这类设置只适合诊断对比。估算偏差先查统计新鲜度、偏斜和列相关性；必要时评估列级统计目标或扩展统计，再调整 SQL 或索引。[计划解读](https://www.postgresql.org/docs/current/using-explain.html)、[规划器统计](https://www.postgresql.org/docs/current/planner-stats.html)

## 统计与复测

- 使用 `pg_stat_statements` 按总耗时、平均耗时、调用次数和返回行数定位优先级；采集前提与统计窗口见 [监控与维护](monitoring-vacuum.md)。p95/p99 从应用追踪等分布数据取得，不能从均值推导。
- 对代表性参数重复测量，分别记录冷缓存与热缓存（若两者都重要）。比较 p95/p99、吞吐、锁等待和资源使用，不只比较一次 wall-clock。
- 改动后复测；数据分布、表达式索引统计等发生变化时再执行相应 `ANALYZE`，不因每次 SQL 改写或普通索引创建就强制分析全表。
- `EXPLAIN ANALYZE` 不向客户端返回实际结果行；结果等价性需另行检查，端到端延迟还需包含连接排队、网络传输及客户端处理。
- 把执行计划、版本、统计信息时间和数据规模作为诊断证据保存，避免把一次偶然计划写成永久规则。
