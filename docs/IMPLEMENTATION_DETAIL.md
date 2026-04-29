# 增量同步实现总结

## 项目改动清单

### 1. 后端改动

#### 新增文件

- **`server/services/websocketService.js`** - WebSocket 服务核心实现
  - 连接管理
  - 楼层订阅
  - 增量同步计算
  - 离线变更处理
  - 实时广播
  - 冲突检测

#### 修改文件

- **`package.json`**
  - 新增依赖：`socket.io: ^4.7.0`

- **`server/app.js`**
  - 引入 `http` 和 `socket.io`
  - 创建 HTTP 服务器用于 WebSocket
  - 初始化 Socket.IO
  - 初始化 WebSocket 服务
  - 使用 `server.listen()` 代替 `app.listen()`

- **`server/models/Zone.js`**
  - 新增字段：`version` (默认值 1)
  - 修改 pre-save 钩子，自动递增版本号

- **`server/models/Seat.js`**
  - 新增字段：`version` (默认值 1)
  - 修改 pre-save 钩子，自动递增版本号

- **`server/routes/zones.js`**
  - 引入 `websocketService`
  - PUT 操作后发送 `notifyZoneUpdate()` 广播
  - DELETE 操作后发送 `notifyZoneDelete()` 广播

- **`server/routes/seats.js`**
  - 引入 `websocketService`
  - PUT 操作后发送 `notifySeatUpdate()` 广播
  - PATCH 操作后发送 `notifySeatUpdate()` 广播

### 2. 前端改动

#### 修改文件

- **`index.html`**

  新增导入：
  - Socket.IO 客户端库 (CDN)

  新增 JavaScript 类：
  - **`SyncClient`** - WebSocket 同步客户端
    - 初始化和连接管理
    - 事件监听和处理
    - 增量同步请求
    - 初始数据应用
    - 增量数据应用
    - 离线队列管理
    - 版本号跟踪
    - 冲突处理
    - 连接状态显示

  修改内容：
  - 页面初始化时调用 `syncClient.initialize()`
  - 区域保存时添加版本号处理和离线队列逻辑
  - 区域删除时添加版本号清理和离线队列逻辑
  - 工位保存时添加版本号处理和离线队列逻辑
  - 工位编号清除时添加版本号处理和离线队列逻辑
  - Header 添加同步状态显示和手动同步按钮

## 核心功能实现

### 1. 版本控制 (Optimistic Locking)

```javascript
// 数据模型中自动管理版本号
version: { type: Number, default: 1, min: 1 }

// 每次保存时自动递增
zoneSchema.pre('save', function(next) {
  if (!this.isNew) {
    this.version += 1;
  }
  next();
});
```

### 2. 增量同步

```javascript
// 客户端请求
socket.emit('sync:request', {
  floorId,
  lastSyncTime,
  clientVersions  // { zones: {...}, seats: {...} }
});

// 服务器计算增量
const zones = await Zone.find({
  floorId,
  $or: [
    { updatedAt: { $gt: lastSync } },
    { _id: { $in: Object.keys(clientVersions.zones) } }
  ]
});

// 过滤已同步的版本
const changedZones = zones.filter(zone => {
  const clientVersion = clientVersions.zones[zone._id];
  return !clientVersion || zone.version > clientVersion;
});
```

### 3. 离线队列

```javascript
// 添加到离线队列
if (!this.isConnected) {
  syncClient.addToOfflineQueue({
    type: 'zone',
    data: {
      _id, clientVersion, ...updates
    }
  });
}

// 恢复连接后自动处理
socket.on('connect', () => {
  this.processOfflineQueue();
});

// 服务器处理，执行乐观锁验证
for (const change of changes.zones) {
  if (serverZone.version !== change.clientVersion) {
    result.conflicts.push({ type, clientData, serverData });
  } else {
    Object.assign(serverZone, change);
    await serverZone.save();
  }
}
```

### 4. 冲突处理

```javascript
// 服务器检测冲突
if (serverZone.version !== clientVersion) {
  result.conflicts.push({
    type: 'zone',
    clientVersion,
    serverVersion: serverZone.version,
    clientData: change,
    serverData: serverZone
  });
}

// 客户端处理冲突（默认服务器优先）
socket.on('sync:conflicts', ({ conflicts }) => {
  for (const conflict of conflicts) {
    this.applyZoneUpdate(conflict.serverData);
  }
  renderAll();
  saveState();
  showNotification(`${conflicts.length} 个数据冲突，已使用服务器数据`);
});
```

### 5. 实时广播

```javascript
// 数据更新后广播通知
socket.emit('zone:updated', {
  data: updatedZone,
  timestamp: Date.now()
});

// 其他连接的客户端实时接收
socket.on('zone:updated', ({ data }) => {
  this.applyZoneUpdate(data);
  renderAll();
});
```

## 数据流

### 初始加载流程

```
1. 浏览器打开 index.html
   ↓
2. DOM 加载完成，触发 DOMContentLoaded
   ↓
3. 初始化 syncClient
   ↓
4. 创建 WebSocket 连接
   ↓
5. emit 'subscribe:floor' 事件，订阅楼层数据
   ↓
6. 服务器发送 'sync:initial' (完整数据)
   ↓
7. 客户端应用初始数据，更新 UI
   ↓
8. 启动定期增量同步 (每 30 秒)
```

### 用户编辑流程

```
1. 用户修改区域/工位信息
   ↓
2. 点击保存按钮
   ↓
3. 调用 API.updateZone() 或 API.updateSeat()
   ↓
4. 服务器更新数据库并自动递增版本号
   ↓
5. 服务器返回更新后的对象（含新版本号）
   ↓
6. 客户端更新本地版本号缓存
   ↓
7. 广播 'zone:updated' 或 'seat:updated' 事件
   ↓
8. 其他客户端接收更新并刷新 UI
```

### 离线操作流程

```
1. 网络断开（service 离线）
   ↓
2. 用户继续修改数据
   ↓
3. API 调用失败，添加到 offlineQueue
   ↓
4. 本地更新和显示成功（基于 localStorage）
   ↓
5. 网络恢复（service 重连）
   ↓
6. emit 'sync:upload' 事件，上传离线变更
   ↓
7. 服务器验证版本号
   ↓
8. 返回 'sync:upload-result' 或 'sync:conflicts'
   ↓
9. 客户端更新版本号或处理冲突
   ↓
10. 清空 offlineQueue
```

## 配置说明

### WebSocket 事件列表

| 事件名 | 方向 | 目的 | 数据 |
|--------|------|------|------|
| `subscribe:floor` | C→S | 订阅楼层数据 | `{ floorId }` |
| `sync:request` | C→S | 请求增量同步 | `{ floorId, lastSyncTime, clientVersions }` |
| `sync:upload` | C→S | 上传离线变更 | `{ floorId, changes }` |
| `sync:initial` | S→C | 发送初始数据 | `{ zones, seats, timestamp }` |
| `sync:incremental` | S→C | 发送增量数据 | `{ changes, timestamp }` |
| `zone:updated` | S→C | 区域更新通知 | `{ data, timestamp }` |
| `zone:deleted` | S→C | 区域删除通知 | `{ data, timestamp }` |
| `seat:updated` | S→C | 工位更新通知 | `{ data, timestamp }` |
| `seat:deleted` | S→C | 工位删除通知 | `{ data, timestamp }` |
| `sync:upload-result` | S→C | 上传结果 | `{ applied, conflicts, errors }` |
| `sync:conflicts` | S→C | 冲突通知 | `{ conflicts, timestamp }` |
| `error` | S→C | 错误通知 | `{ message, error }` |

## 测试检查清单

- [ ] 启动服务器，检查 WebSocket 初始化日志
- [ ] 打开前端，检查自动连接和数据加载
- [ ] 修改区域/工位，检查实时同步
- [ ] 停止服务器，离线修改数据
- [ ] 重启服务器，检查离线数据自动同步
- [ ] 两个浏览器标签同时编辑，检查冲突处理
- [ ] 检查版本号递增
- [ ] 检查同步状态指示器
- [ ] 检查手动同步按钮
- [ ] 检查浏览器控制台日志
- [ ] 检查服务器日志

## 性能影响

### 优势

- ✅ 减少数据传输（增量同步）
- ✅ 实时更新（WebSocket）
- ✅ 离线支持（离线队列）
- ✅ 自动恢复（自动重连）
- ✅ 冲突解决（乐观锁）

### 注意事项

- 定期增量同步间隔 30 秒
- WebSocket 连接始终开放
- 离线队列可能占用内存
- 冲突时使用服务器优先策略

## 向后兼容性

### API 变化

- Zone 和 Seat 模型新增 `version` 字段
- 所有现有 API 仍然有效
- 新增 WebSocket 事件（不影响现有 REST API）

### 数据库迁移

旧数据自动获得 `version: 1`，无需特殊处理

### 禁用 WebSocket

设置 `WS_ENABLED = false` 或 `USE_API = false` 可返回纯 localStorage 模式

## 部署建议

### 生产环境

1. 设置合理的自动同步间隔
2. 添加数据库索引优化查询
3. 配置 CORS 跨域策略
4. 使用 HTTPS/WSS 加密连接
5. 添加用户认证和权限控制
6. 实现操作审计日志
7. 定期备份数据库

### 高可用部署

1. 多个服务器实例使用 Redis 共享状态
2. Socket.IO 配置 Redis 适配器
3. 前端负载均衡配置
4. 定期同步检查和修复不一致数据

---

**实现日期**：2026-01-28
**开发者**：Claude Code
**版本**：2.1.0
