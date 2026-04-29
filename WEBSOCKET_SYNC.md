# WebSocket 增量同步功能说明

## 功能概述

本系统已实现基于 WebSocket (Socket.IO) 的实时增量同步功能，支持：

- ✅ **实时双向同步** - 服务器和客户端之间的实时数据同步
- ✅ **增量更新** - 仅同步变更的数据，节省带宽
- ✅ **版本控制** - 基于乐观锁的冲突检测
- ✅ **离线队列** - 离线时缓存操作，恢复后自动同步
- ✅ **冲突处理** - 自动检测并解决数据冲突
- ✅ **自动重连** - 网络断开后自动重连

## 架构设计

### 1. 数据模型增强

所有数据模型（Zone、Seat）新增 `version` 字段：

```javascript
version: {
  type: Number,
  default: 1,
  min: 1
}
```

每次更新时，版本号自动递增，用于：
- 检测数据冲突
- 判断是否需要增量同步

### 2. 服务端组件

#### WebSocket 服务 (`server/services/websocketService.js`)

提供以下功能：

- **连接管理** - 跟踪所有连接的客户端
- **楼层订阅** - 客户端订阅特定楼层的数据
- **增量同步** - 基于时间戳和版本号计算增量变更
- **离线变更上传** - 处理客户端的离线操作队列
- **冲突检测** - 使用乐观锁检测并处理冲突
- **实时广播** - 向所有订阅的客户端广播数据变更

#### WebSocket 事件

**客户端 → 服务器：**
- `subscribe:floor` - 订阅楼层数据
- `sync:request` - 请求增量同步
- `sync:upload` - 上传离线变更

**服务器 → 客户端：**
- `sync:initial` - 初始完整数据
- `sync:incremental` - 增量变更数据
- `zone:updated` - 区域更新通知
- `zone:deleted` - 区域删除通知
- `seat:updated` - 工位更新通知
- `seat:deleted` - 工位删除通知
- `sync:conflicts` - 冲突通知
- `error` - 错误通知

### 3. 客户端组件

#### 同步客户端 (`SyncClient` 类)

**核心功能：**

```javascript
const syncClient = new SyncClient();

// 初始化
syncClient.initialize();

// 手动触发同步
syncClient.manualSync();

// 离线队列
syncClient.addToOfflineQueue({
  type: 'zone',
  data: { _id, clientVersion, ...updates }
});
```

**版本跟踪：**

```javascript
syncClient.clientVersions = {
  zones: { 'zoneId1': 3, 'zoneId2': 5 },
  seats: { 'seatId1': 2, 'seatId2': 4 }
}
```

## 使用方法

### 1. 安装依赖

```bash
cd D:\中核项目\set_manager
npm install
```

新增依赖：`socket.io: ^4.7.0`

### 2. 启动服务器

```bash
npm run dev
```

服务器将在以下端口启动：
- HTTP API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000`

### 3. 打开前端

在浏览器中打开 `index.html`，系统会自动：

1. 连接到 WebSocket 服务器
2. 订阅楼层数据
3. 接收初始完整数据
4. 启动定期增量同步（每 30 秒）

### 4. 实时同步演示

#### 场景 1：单用户操作

1. 打开应用，修改区域或工位
2. 数据自动保存到服务器
3. 版本号自动更新
4. 本地缓存同步更新

#### 场景 2：多用户协作

1. 在两个浏览器标签页中打开应用
2. 在标签页 A 中修改数据
3. 标签页 B 自动接收更新并刷新界面

#### 场景 3：离线操作

1. 断开网络连接（关闭服务器）
2. 修改数据（自动添加到离线队列）
3. 恢复网络连接
4. 系统自动上传离线变更

#### 场景 4：冲突处理

1. 标签页 A 和 B 都离线
2. 两个标签页都修改同一数据
3. 先恢复标签页 A（成功同步）
4. 再恢复标签页 B（检测到冲突，使用服务器数据）

## 配置选项

### 前端配置 (`index.html`)

```javascript
// WebSocket 开关
const WS_ENABLED = true;

// API 开关
const USE_API = true;

// WebSocket 服务器地址
const WS_URL = 'http://localhost:3000';

// 增量同步间隔（毫秒）
syncInterval = setInterval(() =>
  this.requestIncrementalSync(), 30000
);
```

### 服务器配置 (`server/app.js`)

```javascript
// Socket.IO 配置
const io = socketIo(server, {
  cors: { ... },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

## 同步状态显示

页面右上角显示连接状态：

- `● 已连接` - 绿色，WebSocket 已连接
- `○ 离线` - 灰色，WebSocket 未连接

点击 **手动同步** 按钮可立即触发增量同步。

## 工作流程

### 增量同步流程

```
1. 客户端请求增量同步
   ↓
2. 发送上次同步时间和本地版本号
   ↓
3. 服务器查询变更数据
   - 时间戳过滤：updatedAt > lastSyncTime
   - 版本号过滤：serverVersion > clientVersion
   ↓
4. 返回增量变更
   ↓
5. 客户端应用变更并更新版本号
```

### 离线队列处理

```
1. 检测到离线状态
   ↓
2. 用户操作添加到 offlineQueue
   ↓
3. 恢复连接
   ↓
4. 批量上传队列中的变更
   ↓
5. 服务器验证版本号
   - 无冲突：应用变更
   - 有冲突：返回冲突信息
   ↓
6. 客户端处理结果
   - 成功：更新版本号
   - 冲突：使用服务器数据
```

### 冲突检测机制（乐观锁）

```javascript
// 客户端保存时
const updates = {
  _id: zone._id,
  clientVersion: zone.version,  // 当前版本号
  name: "新名称"
};

// 服务器验证
if (serverZone.version !== clientVersion) {
  // 版本号不匹配，产生冲突
  return {
    type: 'conflict',
    clientVersion,
    serverVersion: serverZone.version,
    clientData: updates,
    serverData: serverZone
  };
}

// 无冲突，应用变更
serverZone.name = updates.name;
await serverZone.save();  // 版本号自动 +1
```

## 性能优化

### 1. 增量同步

- 仅传输变更的数据
- 基于时间戳快速过滤
- 基于版本号精确判断

### 2. 批量处理

- 离线队列批量上传
- 单次请求处理多个变更

### 3. 本地缓存

- localStorage 作为备份
- 减少初始加载时间
- 离线时可用

### 4. 自动重连

- 断线后自动重连
- 重连成功后自动同步
- 指数退避策略

## 故障处理

### 网络断开

- 自动切换到离线模式
- 操作继续可用（本地缓存）
- 恢复后自动同步

### 服务器重启

- 客户端自动重连
- 重新订阅楼层数据
- 执行完整同步

### 数据冲突

- 自动检测冲突
- 默认策略：服务器优先
- 通知用户冲突情况

## 监控和调试

### 浏览器控制台日志

```
[Sync] WebSocket 已连接: abc123
[Sync] 收到初始数据
[Sync] 请求增量同步...
[Sync] 收到增量数据: { zones: 1, seats: 3 }
[Sync] 区域已更新: {...}
[Sync] 检测到数据冲突: [...]
```

### 服务器日志

```
[WebSocket] 客户端连接: abc123
[WebSocket] 客户端 abc123 订阅楼层: floor_d8
[WebSocket] 已向客户端 abc123 发送初始数据
[WebSocket] 客户端 abc123 请求增量同步
[WebSocket] 已发送增量数据: 2 个区域, 5 个工位
```

## 扩展建议

### 短期优化

1. **软删除跟踪** - 记录已删除的数据，支持删除同步
2. **UI 进度显示** - 替换 console.log 为可视化进度条
3. **冲突解决 UI** - 提供界面让用户手动选择保留哪个版本

### 长期优化

1. **用户认证** - 添加用户身份验证
2. **权限控制** - 不同用户不同权限
3. **操作审计** - 记录所有操作历史
4. **数据版本历史** - 支持回滚到历史版本
5. **分布式部署** - 支持多服务器负载均衡

## 常见问题

### Q: 如何禁用 WebSocket？

A: 设置 `WS_ENABLED = false` 或 `USE_API = false`

### Q: 如何修改同步间隔？

A: 修改 `syncInterval` 的延迟时间（默认 30000ms）

### Q: 如何处理大量数据？

A: 考虑实现分页或数据分片，当前实现适合中小规模数据

### Q: 如何测试离线功能？

A: 停止服务器，进行操作，重启服务器观察同步

---

**开发团队**：Floor Management Team
**更新时间**：2026-01-28
**版本**：v2.1.0 (WebSocket Sync)
