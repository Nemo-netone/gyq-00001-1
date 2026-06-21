# 后端开发文档

## 概述
本文档描述网页剪贴板工具的后端设计与实现。

## 技术选型

- **运行时**: Node.js
- **Web 框架**: Express 4.x
- **数据库**: SQLite (sql.js，纯 JavaScript 实现，无需编译)
- **跨域**: cors

## 目录结构

```
server.js          # 入口文件，所有后端逻辑
```

后端采用单文件架构，所有代码集中在 `server.js` 中，适合这种方式简洁明了。

## 数据库设计

### 表结构：`clips` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | 主键，自增 |
| content | TEXT NOT NULL | 剪贴板内容 |
| created_at | INTEGER NOT NULL | 创建时间戳（毫秒） |
| last_copied_at | INTEGER | 最后复制时间戳（毫秒） |
| sort_order | INTEGER NOT NULL | 排序字段，越大越靠前 |

### 索引

- `idx_clips_sort_order`：按 sort_order 降序索引，加速列表查询。

## API 接口

所有接口前缀：`/api/clips`

### 1. 获取所有剪贴内容

```
GET /api/clips
```

**响应示例：
```json
[
  {
    "id": 1,
    "content": "示例内容",
    "created_at": 1700000000000,
    "last_copied_at": null,
    "sort_order": 1
  }
]
```

按 sort_order 降序排列（最新的在最前。

### 2. 新增剪贴内容

```
POST /api/clips
```

**请求体：
```json
{
  "content": "要保存的文字内容"
}
```

**响应**：返回创建的剪贴对象，状态码 201

### 3. 删除剪贴内容

```
DELETE /api/clips/:id
```

**响应**：
```json
{ "success": true }
```

### 4. 标记为已复制

```
POST /api/clips/:id/copy
```

更新 `last_copied_at` 字段为当前时间。

**响应**：返回更新后的剪贴对象

### 5. 上移

```
POST /api/clips/:id/move-up
```

与上一条交换 sort_order。

**响应**：返回全部列表（按新顺序）

### 6. 下移

```
POST /api/clips/:id/move-down
```

与下一条交换 sort_order。

**响应**：返回全部列表（按新顺序）

## 核心实现逻辑

### 排序机制

使用独立的 `sort_order` 字段实现排序，每次新增时取当前最大值 +1。

上移：找到 sort_order 比当前大的最小记录，交换两者 sort_order。

下移：找到 sort_order 比当前小的最大记录，交换两者 sort_order。

### 数据持久化

sql.js 在内存中运行数据库，每次写操作（新增、删除、更新、移动）后通过 `db.export()` 导出数据并写入磁盘文件，确保数据持久化。

### 启动配置

| 配置项 | 值 | 说明 |
|--------|------|------|
| PORT | 3000 | 服务端口 |
| DB_PATH | clipboard.db | 数据库文件路径 |
| journal_mode | WAL | SQLite 日志模式 |

## 错误处理

- 参数校验失败返回 400
- 记录不存在返回 404
- 所有错误信息以 JSON 格式返回错误信息

## 后续优化建议

1. 可扩展点

- 添加内容搜索功能
- 分页查询
- 内容分类/标签
- 数据导出备份
- 用户认证（多用户隔离
