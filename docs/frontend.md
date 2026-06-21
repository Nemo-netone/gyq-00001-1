# 前端开发文档

## 概述
本文档描述网页剪贴板工具的前端设计与实现。

## 技术选型

- **HTML5**：页面结构
- **CSS3**：样式设计（原生 CSS，无需预处理）
- **原生 JavaScript (ES6+)**：交互逻辑，无框架依赖

## 文件结构

```
public/
├── index.html    # 页面结构
├── style.css     # 样式文件
└── app.js        # 交互逻辑
```

## 页面结构 (index.html)

页面由以下主要部分组成：

1. **Header 头部**：标题和副标题
2. **Input Section 输入区**：
   - 多行文本输入框（textarea）
   - 保存按钮
   - 字数统计
3. **List Section 列表区**：
   - 标题 + 总数徽章
   - 剪贴内容列表（动态渲染）
4. **Toast 提示**：全局消息提示组件

## 样式设计 (style.css)

### 设计规范

- **配色方案**：紫色渐变主题 (#667eea → #764ba2)
- **圆角**：卡片 16px，按钮 8-10px
- **字体**：系统字体栈，优先苹方、微软雅黑
- **阴影**：柔和的 box-shadow，hover 时有上浮效果

### 关键样式类

| 类名 | 说明 |
|------|------|
| .container | 主容器，居中最大宽度 800px |
| .clip-item | 单条剪贴内容卡片 |
| .clip-item.selected | 选中态（键盘选择） |
| .btn | 按钮基础样式 |
| .btn-primary | 主要按钮（紫色渐变） |
| .btn-icon | 图标按钮（上下移动） |
| .btn-copy | 复制按钮（绿色） |
| .btn-delete | 删除按钮（红色） |
| .toast | 全局消息提示 |

## 交互逻辑 (app.js)

### 全局状态

```javascript
let clips = [];          // 剪贴内容数组
let selectedIndex = -1;  // 当前键盘选中的索引
```

### 核心函数

#### `fetchClips()`
从后端获取所有剪贴内容并重新渲染列表。

#### `addClip()`
读取输入框内容，调用 POST /api/clips 保存。空内容校验通过后禁用按钮防重复提交。

#### `deleteClip(id)`
调用 DELETE /api/clips/:id 删除指定内容。

#### `copyClip(id, isShortcut)`
1. 使用 `navigator.clipboard.writeText()` 写入系统剪贴板
2. 调用 POST /api/clips/:id/copy 通知后端更新 last_copied_at
3. 显示复制成功提示

#### `moveClip(id, direction)`
调用上移/下移接口，direction 取值 'up' 或 'down'。

#### `moveSelection(direction)`
键盘上下选择，direction 为 -1（上）或 1（下）。

#### `renderClips()`
根据 clips 数组和 selectedIndex 渲染列表。主要处理：
- 空状态展示
- 内容过长截断（500 字符）
- HTML 转义防 XSS
- 时间格式化
- 选中态、首末条按钮禁用

#### `formatTime(timestamp)`
相对时间格式化：刚刚 → N 分钟前 → N 小时前 → N 天前 → 完整日期。

#### `showToast(message, type)`
全局消息提示，支持 success / error 两种类型，2 秒后自动消失。

#### `escapeHtml(str)`
将内容进行 HTML 转义，防止 XSS 攻击。

### 事件绑定

| 事件 | 目标 | 处理 |
|------|------|------|
| input | #clipInput | 更新字数统计 |
| click | #addBtn | 保存内容 |
| keydown | #clipInput | Ctrl+Enter 快捷保存 |
| keydown | document | ↑↓选择、Ctrl+C复制、Delete删除 |
| click | .clip-item | 点击选中（忽略按钮区域） |

### 键盘快捷键

| 快捷键 | 触发条件 | 功能 |
|--------|----------|------|
| Ctrl + Enter | 输入框聚焦时 | 保存内容 |
| ↑ / ↓ | 输入框未聚焦时 | 在列表中上下选择 |
| Ctrl + C | 已选中条目时 | 复制选中内容 |
| Delete | 已选中条目时 | 删除选中内容 |

## 数据流

```
用户操作 → 前端状态更新 → API 调用 → 后端处理 → 返回新数据 → 重新渲染
```

所有修改操作（新增、删除、移动、复制）后都会触发 `fetchClips()` 或直接使用接口返回的最新数据重新渲染，保持前后端数据一致。

## 安全考虑

1. **XSS 防护**：所有用户输入内容通过 `escapeHtml()` 转义后再渲染
2. **输入校验**：前端校验空内容，后端也有二次校验
3. **纯静态前端**：不使用 eval、innerHTML 直接拼接用户内容

## 后续优化建议

1. 可扩展功能
   - 内容全文搜索
   - 拖拽排序
   - 内容收藏/置顶
   - 批量删除
   - 导入/导出
   - 暗色模式
2. 体验优化
   - 复制后闪烁动画
   - 删除确认弹窗
   - 离线缓存（Service Worker）
   - 内容自动去重
