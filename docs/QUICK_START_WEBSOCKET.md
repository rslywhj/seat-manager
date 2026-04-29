# 快速开始 - WebSocket 增量同步

## 1. 安装依赖

```bash
cd D:\中核项目\set_manager
npm install
```

这将安装新的依赖项（包括 `socket.io`）

## 2. 启动服务器

```bash
npm run dev
```

或者使用 Node.js 直接启动：

```bash
node server/app.js
```

**预期输出：**

```
╔═══════════════════════════════════════════════╗
║   工位管理系统 API 服务已启动                 ║
║   Server: http://localhost:3000               ║
║   API: http://localhost:3000/api              ║
║   WebSocket: ws://localhost:3000              ║
║   Health: http://localhost:3000/health        ║
║   MongoDB: mongodb://localhost:27017/floor-db ║
╚═══════════════════════════════════════════════╝
[WebSocket] 服务已初始化
```

## 3. 打开前端

在浏览器中打开 `index.html`（使用 `http://` 而不是 `file://`）

### 使用 Python 快速服务器

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000/index.html`

### 使用 Node.js 快速服务器

```bash
npx http-server . -p 8000
```

## 4. 验证连接

页面右上角应显示：
- `● 已连接` - WebSocket 已连接（绿色）
- `○ 离线` - WebSocket 已断开（灰色）

浏览器控制台应显示：

```
[Sync] WebSocket 已连接: abc123...
[Sync] 客户端 ... 订阅楼层: floor_d8
[Sync] 收到初始数据
⏳ 初始化应用...
✓ 应用初始化完成
```

## 5. 测试同步功能

### 测试实时同步

1. **打开两个浏览器标签页**：
   - 标签页 A：`http://localhost:8000/index.html`
   - 标签页 B：`http://localhost:8000/index.html`

2. **在标签页 A 修改数据**：
   - 点击任意区域
   - 修改区域名称或配置
   - 点击保存

3. **观察标签页 B**：
   - 应自动接收更新
   - 界面自动刷新
   - 无需手动刷新

### 测试离线操作

1. **停止服务器**：
   ```bash
   # 在启动服务器的终端按 Ctrl+C
   ```

2. **在前端修改数据**：
   - 页面右上角显示 `○ 离线`
   - 继续修改区域/工位信息
   - 点击保存
   - 消息显示"保存失败，已在本地保存"
   - 数据仍然保存到 localStorage

3. **重启服务器**：
   ```bash
   npm run dev
   ```

4. **观察前端**：
   - 自动重连
   - 右上角显示 `● 已连接`
   - 离线变更自动上传
   - 控制台显示同步日志

### 测试冲突处理

1. **打开两个标签页**（都在线）

2. **两个标签页同时离线**：
   ```bash
   # 停止服务器
   ```

3. **在两个标签页修改同一工位信息**：
   - 标签页 A：修改工位 001 的姓名为"张三"，保存
   - 标签页 B：修改工位 001 的姓名为"李四"，保存
   - 两个都显示"保存失败，已在本地保存"

4. **恢复连接**：
   - 重启服务器
   - 标签页 A 先恢复（修改应用成功）
   - 标签页 B 检测冲突（使用服务器数据）

5. **检查结果**：
   - 标签页 A：显示"张三"（本地修改）
   - 标签页 B：显示"张三"（被覆盖为 A 的修改）
   - 控制台显示冲突警告

## 6. 查看日志

### 浏览器控制台

```javascript
// 打开浏览器开发者工具：F12 或右键 → 检查元素

// 查看日志
[Sync] WebSocket 已连接: socket-id
[Sync] 收到初始数据
[Sync] 请求增量同步...
[Sync] 收到增量数据: { zones: 2, seats: 5 }
[Sync] 区域已更新: {...}
```

### 服务器日志

```
[WebSocket] 客户端连接: socket-id
[WebSocket] 客户端 socket-id 订阅楼层: floor_d8
[WebSocket] 已向客户端 socket-id 发送初始数据
[WebSocket] 客户端 socket-id 请求增量同步
⏳ 保存区域到服务器...
✓ 区域已保存
```

## 7. 核心文件位置

| 文件 | 功能 | 行号 |
|------|------|------|
| `server/app.js` | Express 主应用 + WebSocket 初始化 | - |
| `server/services/websocketService.js` | 核心 WebSocket 服务逻辑 | - |
| `server/models/Zone.js` | Zone 模型 + version 字段 | 80-100 |
| `server/models/Seat.js` | Seat 模型 + version 字段 | 80-100 |
| `server/routes/zones.js` | 区域 API + WebSocket 通知 | 140-270 |
| `server/routes/seats.js` | 工位 API + WebSocket 通知 | 100-175 |
| `index.html` | 前端 WebSocket 客户端 | 790-1000 |

## 8. 配置调整

### 修改自动同步间隔

在 `index.html` 中找到：

```javascript
// 启动定期增量同步（每30秒）
this.syncInterval = setInterval(
  () => this.requestIncrementalSync(),
  30000  // ← 修改此值（毫秒）
);
```

### 禁用 WebSocket

在 `index.html` 中找到：

```javascript
const WS_ENABLED = true;  // ← 改为 false
const USE_API = true;      // ← 或改为 false
```

### 修改 WebSocket 服务器地址

在 `index.html` 中找到：

```javascript
const WS_URL = 'http://localhost:3000';  // ← 修改地址
```

## 9. 常见问题

### Q: 浏览器显示"连接失败"

**A:** 检查：
1. 服务器是否正在运行
2. 服务器地址是否正确（默认 `http://localhost:3000`）
3. 防火墙是否阻止 3000 端口
4. 浏览器控制台是否有 CORS 错误

### Q: 修改后没有同步到其他客户端

**A:** 检查：
1. 两个客户端是否都已连接（右上角显示 `● 已连接`）
2. 是否点击了保存按钮
3. 浏览器控制台是否有错误
4. 自动同步间隔是否已到（最多 30 秒）

### Q: 数据仍然显示旧内容

**A:**
1. 尝试手动刷新按钮（右上角"手动同步"）
2. 检查 localStorage（F12 → Application → Local Storage）
3. 检查数据库是否已更新

### Q: 离线时操作没有保存

**A:** 检查：
1. localStorage 是否已启用
2. 浏览器是否允许存储
3. 控制台是否有错误信息

## 10. 验证清单

在进行其他操作前，确保以下项目都通过：

- [ ] 服务器启动成功
- [ ] 前端加载成功
- [ ] 右上角显示 `● 已连接`
- [ ] 浏览器控制台无红色错误
- [ ] 服务器日志显示 WebSocket 初始化
- [ ] 修改区域后自动保存
- [ ] 两个标签页可实时同步
- [ ] 离线修改可正常保存
- [ ] 离线恢复后自动同步

---

**提示**：所有改动都已完成，无需额外配置即可运行。享受实时协作！🚀
