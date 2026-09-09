# 安全迁移

先确认表规模、迁移工具的事务模式、并发写入和应用发布方式。空表初始化或允许停机的小表变更可直接使用合适的事务 DDL；需要在线兼容时再拆阶段，避免让简单迁移承担无用流程。

## Expand/Contract

需要旧应用和新应用并存时，按兼容窗口推进：

1. **Expand**：增加可选列、表、索引或兼容写路径，不删除旧结构。
2. **Write / backfill**：先部署兼容写路径，再按稳定键分批回填。需要双写时明确同事务一致性或补偿机制；防止旧快照回填覆盖新的业务写入。
3. **Switch**：切换读取路径，验证新数据和旧数据的一致性。
4. **Contract**：确认旧版本应用已退出后，再删除旧列、旧索引或兼容代码。

大型回填使用稳定键、批量上限、独立提交和限速，避免长事务和无界 `OFFSET`。进度只在批次提交后推进，重跑条件应可识别已完成行；使用版本条件或一致的并发写入协议防止覆盖新值。评估 WAL、复制延迟和磁盘，并根据延迟/锁/错误率设置暂停条件。

## DDL 与索引

- `ALTER TABLE` 的锁取决于子命令；即使不重写表，也可能等待强锁，并让后续请求排队。按阶段设置有依据的锁等待和执行超时，失败后先查阻塞原因，不无限重试。
- 新增列是否重写表取决于版本、默认表达式及类型；不要一律去掉默认值，也不要把易变默认值或 `ALTER COLUMN TYPE` 当作元数据变更。
- `CREATE INDEX CONCURRENTLY` **不能在事务块中执行**，需要迁移工具支持独立的非事务步骤；它仍会等待事务/快照，并消耗扫描、I/O 和空间。同表并发建索引及分区父表支持有额外限制，按目标版本编排。
- 失败可能留下无效索引；唯一索引在构建完成前可能已开始拒绝重复值，失败残留也可能继续执行唯一性检查。重试前检查定义与状态，不能靠同名 `IF NOT EXISTS` 判断成功。

```sql
SELECT indexrelid::regclass AS index_name,
       indisvalid, indisready, pg_get_indexdef(indexrelid) AS definition
FROM pg_index
WHERE indrelid = 'app.orders'::regclass;
```

先处理失败原因，再选择删除本次残留后重建或受版本支持的重建方式；不要删除用途未明的已有索引。[CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)

## 分阶段验证约束

`CHECK` / 外键可用 `NOT VALID` 跳过添加时的历史数据扫描，之后 `VALIDATE CONSTRAINT`；新增/更新行仍要满足约束。它与 `DEFERRABLE`（事务内推迟约束检查时机）不同，不能套用于 `UNIQUE` / 主键；其他约束支持情况按主版本核对。

大表唯一性可先并发创建符合要求的唯一索引，再 `ADD CONSTRAINT ... USING INDEX`；部分索引、表达式索引等不能直接挂成普通唯一约束。预检查重复数据不能替代构建期间的并发唯一性验证。

例如将 `app.orders.tenant_id` 收紧为非空：前提是已分批回填，且应用写路径不再产生 NULL。以下各阶段单独提交，避免把添加约束时取得的强锁一直持有到扫描结束：

```sql
-- 阶段 1：快速建立新写入的约束，仍需取得 DDL 锁
ALTER TABLE app.orders
  ADD CONSTRAINT orders_tenant_id_nn
  CHECK (tenant_id IS NOT NULL) NOT VALID;

-- 阶段 2：扫描验证；使用 SHARE UPDATE EXCLUSIVE 锁
ALTER TABLE app.orders VALIDATE CONSTRAINT orders_tenant_id_nn;

-- 阶段 3：支持利用已验证 CHECK 的版本可免去再次扫描，仍需强锁
ALTER TABLE app.orders ALTER COLUMN tenant_id SET NOT NULL;

-- 阶段 4：SET NOT NULL 成功后，单独移除辅助约束
ALTER TABLE app.orders DROP CONSTRAINT orders_tenant_id_nn;
```

若先添加 `NOT VALID` 再回填，已有 NULL 行的其他更新也可能被拒绝，需确认应用能接受这一过渡行为。锁级别、免扫描条件及约束语法见 [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)。

## 失败恢复与清理

- 不依赖 `IF NOT EXISTS` 掩盖定义冲突。对象同名但列、谓词或约束不一致时，应停止并报告。
- 删除或重命名前确认所有应用版本、报表、触发器、函数、视图和备份脚本的引用。
- 逐阶段记录提交状态、回填游标和目录状态；非事务迁移失败后，不能因迁移工具显示失败就假定所有步骤都未执行。
- 回滚 SQL 不自动恢复已删除或不可逆转换的数据；按阶段选择回退应用、保留兼容列、前进修复或从备份恢复，并明确恢复代价。

## 迁移记录

每个高风险迁移写清：

- 预检查、目标数据库版本和所需权限
- 预计锁、空间、WAL、复制和连接影响
- 分批参数、超时、暂停条件和进度指标
- 失败后的重试、前进修复和回滚/降级路径
- 旧应用兼容窗口和最终清理条件

高风险生产迁移在接近生产的数据和副本拓扑上演练；没有演练条件时明确哪些锁、耗时和恢复假设尚未验证。
