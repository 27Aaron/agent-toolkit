# 索引与查询

索引是对具体查询形状、数据分布和写入代价的投资。先记录查询、参数分布、返回行数和执行计划，再提出索引；不要从列名直接推导索引。

## 索引类型

| 类型 | 适合的访问方式 | 注意事项 |
| --- | --- | --- |
| B-tree | 等值、范围、`IS NULL`、常见排序 | 多列索引对左侧列最敏感；写入和存储有成本 |
| GIN | 数组、`jsonb` 包含关系、全文搜索等多值项 | 更新成本和体积可能较高，确认操作符类 |
| BRIN | 与物理存储顺序高度相关的大表范围查询 | 不是“低选择性列通用索引”，相关性会随写入方式变化 |
| GiST / SP-GiST | 几何、范围、近邻或特定扩展类型 | 由操作符类决定能力，不能只看索引名称 |

PostgreSQL 的索引类型针对不同可索引条件；默认 B-tree 并不意味着它适合所有查询。[索引类型](https://www.postgresql.org/docs/current/indexes-types.html)

## 多列索引

B-tree 通常最有效地利用左侧连续列上的等值条件，以及第一个没有等值约束列上的范围条件；右侧条件仍可能减少回表，支持 skip scan 的版本还可能利用前导列取值较少等分布特征减少扫描。不要把“缺少最左列就完全不能用索引”或“选择性最高的列永远放首位”当成规则。[多列索引](https://www.postgresql.org/docs/current/indexes-multicolumn.html)

设计时同时考虑：

- `WHERE` 的常见组合、选择性和租户前缀
- `ORDER BY` 与分页边界是否能复用索引顺序
- 连接键、部分条件和参数是否稳定
- 索引大小、写入频率、更新列和缓存命中
- 是否已有可复用或被新索引覆盖的索引

示例：

```sql
-- 查询限定租户、待处理状态及未归档记录，按创建时间与 id 倒序
CREATE INDEX orders_pending_created_idx
ON app.orders (tenant_id, created_at DESC, id DESC)
WHERE status = 'pending' AND archived_at IS NULL;
```

部分索引用于查询时，规划器必须能证明查询条件蕴含索引谓词。通用预备计划中的 `status = $2` 无法证明总是满足 `status = 'pending'`；定制计划可能利用已知参数值，应按实际驱动路径验证。不要为了匹配部分索引而将用户输入拼进 SQL。[部分索引](https://www.postgresql.org/docs/current/indexes-partial.html)

该示例只说明索引定义；在线大表的创建方式和失败恢复见 [迁移](schema-migrations.md)。

## 表达式与覆盖列

- `lower(email)`、日期桶等表达式索引必须与查询表达式一致，并考虑排序规则、不可变性和写入成本。
- `INCLUDE` 列不参与搜索键或唯一性判定；带非键列的 B-tree 索引不使用去重。Index-only scan 还取决于 visibility map 的 all-visible 状态，检查计划的 `Heap Fetches`，不能承诺添加 INCLUDE 就不回表。[覆盖索引](https://www.postgresql.org/docs/current/indexes-index-only-scans.html)、[CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)
- 不为 `SELECT *` 盲目创建“覆盖所有字段”的索引；缩小投影通常比扩大索引更稳妥。

## 查询改写与分页

先检查 JOIN 是否放大结果、过滤是否过晚、列侧函数/隐式转换是否影响索引条件；改写同时验证重复行、NULL、排序及权限语义，不能用 `DISTINCT` 掩盖错误的连接关系。

深分页可评估 keyset；例如与上面的索引配合，假定 `created_at` 非空、`id` 为 bigint 主键，下一页使用末行的完整排序键：

```sql
-- $1 为租户，$2/$3 为上页末行 created_at/id，$4 为页大小，由驱动绑定
SELECT id, created_at, total
FROM app.orders
WHERE tenant_id = $1
  AND status = 'pending' AND archived_at IS NULL
  AND (created_at, id) < ($2::timestamptz, $3::bigint)
ORDER BY created_at DESC, id DESC
LIMIT $4;
```

首屏省略游标谓词。混合排序方向、可空键和可变排序键需单独设计；keyset 不提供跨请求的一致快照，也不天然支持任意跳页。避免笼统承诺 O(1)，用实际索引与扫描量验证。[行比较](https://www.postgresql.org/docs/current/functions-comparisons.html#ROW-WISE-COMPARISON)、[LIMIT/OFFSET](https://www.postgresql.org/docs/current/queries-limit.html)

## 索引评审

1. 从 `pg_stat_statements`、日志或应用追踪确定高成本且可优化的查询。
2. 用代表性参数查看 `EXPLAIN`，确认瓶颈是扫描、连接、排序、估算错误还是返回数据量。
3. 设计最小索引并估算写入、存储和缓存影响。
4. 在接近生产的数据分布上比较基线与候选计划，必要时更新统计信息。
5. 上线后观察 p95/p99 延迟、读写吞吐、索引大小、缓存命中和写入放大。

`idx_scan = 0` 只代表当前实例和统计窗口内没有记录到扫描，不证明索引无用。删除前核对统计重置、只读副本、周期性任务、唯一/主键约束和恢复窗口；部分唯一索引即使从未用于查询仍可能承担正确性约束。
