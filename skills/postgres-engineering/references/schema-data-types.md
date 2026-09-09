# Schema 与数据类型

先从业务不变量和访问方式反推结构，再选择类型。不要因为某个类型在另一套数据库或单一示例中常见，就把它写成所有项目的固定答案。

## 标识符

在以下选项中按实际约束选择：

| 选择 | 适合的情况 | 需要权衡 |
| --- | --- | --- |
| `bigint GENERATED ... AS IDENTITY` | 单库或集中写入，数值连接和索引成本重要 | 暴露给不可信客户端时容易被枚举；跨库合并需要额外策略 |
| `uuid` | 多服务生成、离线创建、跨库合并或不希望暴露顺序 | 存储和索引更宽；随机写入的局部性取决于 UUID 版本和生成方式 |
| 业务键 + 内部主键 | 外部需要稳定业务标识，内部希望自由迁移 | 需要分别维护唯一约束和生命周期语义 |

主键必须稳定、非空且唯一；`IDENTITY` 负责生成值，唯一性仍需 `PRIMARY KEY` 或 `UNIQUE`。UUID 的生成函数及版本支持应按目标数据库核对；不可枚举 ID 也不能替代访问授权。[UUID 类型](https://www.postgresql.org/docs/current/datatype-uuid.html)、[Identity 列](https://www.postgresql.org/docs/current/ddl-identity-columns.html)

## 常用类型

- 字符串通常使用 `text` 或不带长度的 `varchar`；有业务长度上限时用 `CHECK (char_length(value) <= ...)` 或带长度类型表达约束。PostgreSQL 中 `text` 与 `varchar` 通常没有性能差异，`char(n)` 还会引入空格填充语义。[字符类型](https://www.postgresql.org/docs/current/datatype-character.html)
- 金额和需要精确舍入的数值使用 `numeric`，或使用明确币种的最小单位整数；精度和小数位由业务范围计算，不复制固定的 `numeric(10,2)`。
- 时间点通常使用 `timestamptz`；它保存时间点，不保留输入的时区名称，展示受会话 `TimeZone` 影响。需要原始时区或按当地时间重复的日程时单独建模；日历日期用 `date`，本地墙上时间可用 `timestamp without time zone`。[日期/时间类型](https://www.postgresql.org/docs/current/datatype-datetime.html)
- 真假值使用 `boolean`；三值逻辑会影响 `WHERE`、唯一约束和业务判断，明确 `NULL` 是否有独立含义。
- `jsonb` 适合结构确实动态、整体读写或按包含关系查询的数据；稳定且需要约束、连接或高频筛选的字段优先建成列。数组不应成为规避关系建模的默认方案。

## 约束与关系

- 用 `NOT NULL`、`CHECK`、`UNIQUE`、主键和外键表达数据库能够验证的不变量。应用层校验只负责友好提示，不能替代并发条件下的数据库约束。
- `CHECK` 在结果为真或 NULL 时通过，不能用 `CHECK (amount > 0)` 替代 `NOT NULL`；不要通过读取其他行/表的函数伪装跨行约束，应使用适当的唯一、外键、排斥约束或事务机制。
- 唯一性要明确 `NULL` 语义、大小写、规范化和作用域；默认唯一约束允许多个 NULL，需要将 NULL 视为相同时核对目标版本的 `NULLS NOT DISTINCT` 支持。“未删除记录中唯一”可用部分唯一索引，其正确性用途不要求它被查询计划选中。
- 外键写清 `ON DELETE`/`ON UPDATE` 行为。子表外键列是否需要索引取决于连接、父行删除/更新和级联操作；检查真实工作负载，不为每个字段盲目建索引。
- 多租户关系需防止跨租户引用：仅 `project_id REFERENCES projects(id)` 不会保证两行的 `tenant_id` 相同。需要此不变量时使用 `(tenant_id, project_id)` 复合外键，并为目标 `(tenant_id, id)` 提供匹配的唯一键；相关列是否允许 NULL 也要明确。
- 默认值在省略列或显式使用 `DEFAULT` 时生效，显式传 NULL 不会触发默认值。修改已有列的默认值不回填旧行。[默认值](https://www.postgresql.org/docs/current/ddl-default.html)

约束语义与支持范围见 [PostgreSQL 约束](https://www.postgresql.org/docs/current/ddl-constraints.html)。

## 评审清单

1. 主键、业务唯一性和外键关系是否与真实生命周期一致？
2. 类型是否能覆盖范围、精度、时区和排序语义？
3. 约束是否在并发写入下仍然成立？
4. 高频过滤、连接和排序是否有可解释的索引路径？
5. 删除、归档、租户隔离和备份恢复是否有明确行为？
6. 新约束和列能否与旧版本应用并存？
