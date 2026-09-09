# 监控、统计与维护

维护建议必须与表大小、写入模式、保留策略和复制拓扑相关。固定的“死元组超过某个数量就处理”不适合作为所有表的规则。

## 观测面

按问题选取以下指标，并保留采样窗口与基线：

- 查询：总耗时、p95/p99、调用次数、返回行数、计划/执行时间
- 资源：CPU、I/O、缓存命中、临时文件、WAL 和复制延迟
- 并发：活跃连接、锁等待、长事务、死锁和序列化失败
- 维护：自动清理/分析最后运行时间、死元组比例、冻结年龄和表/索引增长

`pg_stat_statements` 需要服务端预加载模块、启用 query ID 计算，并在目标数据库安装扩展以查询视图；托管平台可能已配置，先检查现状。仅 `CREATE EXTENSION` 不保证采集可用，缺少预加载通常涉及重启，不在诊断中顺手修改。

按相同数据库、角色、query ID 和时间窗口比较计数增量，注意统计重置或条目淘汰。该视图提供累计值和均值等聚合，**不直接提供 p95/p99**，分位数应来自应用追踪、日志样本或延迟直方图。[pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)

## VACUUM 与 ANALYZE

- 保持 autovacuum 和自动分析开启并观察其是否赶得上写入；调整表级阈值时按表规模和写入速率计算。
- `n_dead_tup` 是估算的死元组数量，不等于可回收字节或精确膨胀率；结合表/索引大小、趋势和必要的进一步测量判断。[统计视图](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-ALL-TABLES-VIEW)
- 大批量删除或更新后检查死元组、膨胀、WAL 和复制延迟；必要时分批执行并留出维护窗口。
- `ANALYZE` 用于更新优化器统计，不等同于回收空间；在数据分布突变后及时重新分析。
- 普通 `VACUUM` 主要让空间在表内复用，通常不将空间归还操作系统。`VACUUM FULL` 重写表、持有 `ACCESS EXCLUSIVE` 锁并需要额外磁盘，不能作为默认在线修复；普通 `VACUUM` 也可能在截断尾部空页时短暂请求强锁。
- 清理追不上时检查长事务、旧快照、复制槽保留的 xmin/WAL 和 standby feedback；冻结年龄过高时需优先处理事务 ID 回卷风险，不能只提高死元组阈值或关闭 autovacuum。[日常清理](https://www.postgresql.org/docs/current/routine-vacuuming.html)

## 告警与复盘

告警应包含受影响对象、观测时间、基线、可能原因和安全的下一步。维护操作后记录指标变化；如果只看到单个查询变快而锁、WAL 或写入延迟恶化，不算完成优化。
