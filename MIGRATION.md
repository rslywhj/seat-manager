# 数据迁移指南

## 📋 概述

本指南详细说明如何将工位管理系统从 localStorage 本地存储迁移到 MongoDB + Node.js Express 后端。

## 🎯 迁移目标

1. **数据持久化**：从浏览器 localStorage 迁移到 MongoDB 数据库
2. **工位编号可选化**：支持工位编号为空（`seatNo: null`）
3. **无缝切换**：保持前端 UI 和用户体验不变
4. **数据安全**：提供完整的备份和回滚方案

## ⚠️ 前置条件

在开始迁移前，请确保已安装：

- **Node.js** (v14.0 或更高版本)
- **npm** (v6.0 或更高版本)
- **MongoDB** (v5.0 或更高版本)

### 安装检查

```bash
# 检查 Node.js 版本
node --version  # 应显示 v14.0.0 或更高

# 检查 npm 版本
npm --version   # 应显示 6.0.0 或更高

# 检查 MongoDB 是否运行
mongo --version # 应显示 MongoDB 版本信息
```

## 📁 项目结构

迁移后的完整项目结构：

```
set_manager/
├── index.html                    # 前端文件（已修改）
├── package.json                  # 依赖配置
├── .env.example                  # 环境变量模板
├── .env                          # 环境变量（需创建）
├── Dockerfile                    # Docker 镜像配置
├── docker-compose.yml            # Docker Compose 配置
├── server/                       # 后端目录
│   ├── app.js                   # Express 应用入口
│   ├── config/
│   │   └── db.js                # MongoDB 连接配置
│   ├── models/
│   │   ├── Floor.js             # Floor 数据模型
│   │   ├── Zone.js              # Zone 数据模型
│   │   └── Seat.js              # Seat 数据模型 ⭐ 支持 null seatNo
│   ├── routes/
│   │   ├── floors.js            # Floor API 路由
│   │   ├── zones.js             # Zone API 路由
│   │   └── seats.js             # Seat API 路由
│   ├── utils/
│   │   └── seatBuilder.js       # 工位编号生成算法
│   └── middleware/
│       └── errorHandler.js      # 错误处理中间件
└── scripts/
    └── migrate.js               # 数据迁移脚本
```

## 🚀 迁移步骤

### 步骤 1: 导出现有数据

1. 在浏览器中打开现有的工位管理系统（index.html 旧版本）
2. 点击顶部工具栏的 **"导出JSON"** 按钮
3. 将文件保存为 `floor-data.json`
4. 将该文件复制到项目根目录

### 步骤 2: 安装依赖

```bash
cd set_manager
npm install
```

预期输出：
```
added 423 packages in 58s
✓ 安装成功
```

### 步骤 3: 启动 MongoDB

**Windows:**
```bash
# 方法 1: 如果已安装 MongoDB 服务
net start MongoDB

# 方法 2: 手动启动（指定数据目录）
mongod --dbpath C:\data\db
```

**macOS/Linux:**
```bash
# 方法 1: 使用系统服务
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS

# 方法 2: 手动启动
mongod --dbpath /data/db
```

**验证 MongoDB 是否运行:**
```bash
mongo --eval "db.version()"
# 应显示 MongoDB 版本号
```

### 步骤 4: 配置环境变量

复制环境变量模板并编辑：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/floor-db

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:8000,http://localhost:3000,file://

# API Configuration
API_PREFIX=/api
LOG_LEVEL=info
```

⚠️ **注意**：如果前端是从文件系统打开（`file://`），请在 `CORS_ORIGIN` 中添加 `file://` 或 `*`

### 步骤 5: 运行迁移脚本

```bash
node scripts/migrate.js floor-data.json
```

**预期输出：**

```
╔═══════════════════════════════════════════════╗
║   工位管理系统数据迁移工具                    ║
╚═══════════════════════════════════════════════╝

⏳ 正在连接 MongoDB...
✓ MongoDB 连接成功

⏳ 正在读取文件: floor-data.json
✓ JSON 文件读取成功

📊 数据统计:
   楼层: D座8层
   区域数量: 3
   工位数量: 150

⏳ 正在创建楼层...
✓ 楼层创建成功: D座8层

⏳ 正在创建区域...
   ✓ 区域A (zone_abc -> 507f1f77bcf86cd799439011)
   ✓ 区域B (zone_def -> 507f1f77bcf86cd799439012)
   ✓ 区域C (zone_ghi -> 507f1f77bcf86cd799439013)
✓ 3 个区域创建成功

⏳ 正在迁移工位...
   进度: 150 / 150
✓ 150 个工位迁移成功
   ⭐ 其中 5 个工位没有编号（seatNo = null）

⏳ 正在验证数据...
   ✓ 区域数量: 3
   ✓ 工位数量: 150

╔═══════════════════════════════════════════════╗
║   ✅ 迁移成功完成！                          ║
╚═══════════════════════════════════════════════╝

下一步：
  1. 启动后端服务: npm run dev
  2. 在浏览器中打开 index.html
  3. 验证数据是否正确加载

✓ MongoDB 连接已关闭
```

### 步骤 6: 启动后端服务

```bash
npm run dev
```

**预期输出：**

```
✓ MongoDB 连接成功

╔═══════════════════════════════════════════════╗
║   工位管理系统 API 服务已启动                 ║
║   Server: http://localhost:3000               ║
║   API: http://localhost:3000/api              ║
║   Health: http://localhost:3000/health        ║
║   MongoDB: mongodb://localhost:27017/floor-db ║
╚═══════════════════════════════════════════════╝
```

### 步骤 7: 验证 API

在新的终端窗口测试 API：

```bash
# 健康检查
curl http://localhost:3000/health

# 获取楼层数据
curl http://localhost:3000/api/floors/floor_d8

# 获取区域列表
curl http://localhost:3000/api/floors/floor_d8/zones

# 获取工位列表
curl http://localhost:3000/api/floors/floor_d8/seats
```

### 步骤 8: 打开前端并验证

1. 在浏览器中打开 `index.html`
2. 打开浏览器开发者工具（F12）查看控制台
3. 应该看到：
   ```
   ⏳ 初始化应用...
   ⏳ 正在从 API 加载数据...
   ✓ API 数据加载成功
   ✓ 应用初始化完成
   ```
4. 验证：
   - 所有区域是否正确显示
   - 工位数量是否正确
   - 点击区域查看工位分布
   - 编辑工位信息并保存
   - 测试清空工位编号功能

## 🔧 可选工位编号功能测试

### 测试清空工位编号

1. 点击任意工位打开编辑器
2. 在工位号字段旁边点击 **"清除编号"** 按钮
3. 确认提示对话框
4. 验证：
   - 工位号字段变为空
   - 标题显示"编辑工位（无编号）"
   - 工位卡片显示 "-" 或 "未分配"
   - Canvas 上显示 "-"

### 测试工位编号显示

- **有编号的工位**：显示 3 位数字（如 "001"）
- **无编号的工位**：
  - 编辑器：显示空或"未分配"
  - 卡片视图：显示 "-"（灰色）
  - Canvas 视图：显示 "-"

## 📊 数据验证清单

迁移完成后，请验证以下项目：

### ✅ 基础功能
- [ ] 后端服务正常启动
- [ ] MongoDB 连接成功
- [ ] 所有 API 端点正常响应
- [ ] 前端可以从 API 加载数据

### ✅ 区域管理
- [ ] 创建新区域功能正常
- [ ] 编辑区域信息功能正常
- [ ] 删除区域功能正常（级联删除工位）
- [ ] 区域在 Canvas 上正确显示

### ✅ 工位管理
- [ ] 工位编号正确显示
- [ ] 工位编号可以清空为 null
- [ ] 工位编号为空时显示为"-"或"未分配"
- [ ] 编辑工位人员信息功能正常
- [ ] 工位保存后数据持久化

### ✅ 导入/导出
- [ ] JSON 导出功能正常
- [ ] JSON 导入功能正常
- [ ] XLSX 导入功能正常

### ✅ 错误处理
- [ ] API 失败时自动回退到 localStorage
- [ ] 显示用户友好的错误提示
- [ ] 数据始终保存到本地备份

### ✅ 性能
- [ ] 大量工位（1000+）加载速度正常
- [ ] 工位编号算法前后端结果一致
- [ ] 界面操作流畅无卡顿

## ⚠️ 常见问题与解决方案

### 问题 1: MongoDB 连接失败

**错误信息：**
```
✗ MongoDB 连接失败: connect ECONNREFUSED 127.0.0.1:27017
```

**解决方案：**
1. 检查 MongoDB 是否正在运行：
   ```bash
   # Windows
   tasklist | findstr mongo

   # Linux/macOS
   ps aux | grep mongo
   ```
2. 启动 MongoDB 服务（见步骤 3）
3. 检查 `.env` 文件中的 `MONGODB_URI` 是否正确

### 问题 2: API 跨域错误（CORS）

**错误信息：**
```
Access to fetch at 'http://localhost:3000/api/...' from origin 'file://' has been blocked by CORS policy
```

**解决方案：**
1. 修改 `.env` 文件：
   ```env
   CORS_ORIGIN=*
   ```
2. 重启后端服务

### 问题 3: 迁移脚本找不到文件

**错误信息：**
```
错误: 文件不存在: ./floor-data.json
```

**解决方案：**
1. 确认 JSON 文件路径正确
2. 使用绝对路径：
   ```bash
   node scripts/migrate.js "D:\中核项目\set_manager\floor-data.json"
   ```

### 问题 4: 工位编号不一致

**症状：** 前端显示的工位编号与预期不符

**解决方案：**
1. 检查区域的 `order` 配置是否正确（row/snake/col）
2. 删除所有工位重新生成：
   ```javascript
   // 在前端控制台执行
   state.seats = {};
   buildAllSeats();
   saveState();
   ```
3. 或者删除区域并重新创建

### 问题 5: 前端显示 "使用本地缓存数据"

**原因：** API 未启动或无法连接

**解决方案：**
1. 确认后端服务正在运行：
   ```bash
   npm run dev
   ```
2. 检查控制台是否有错误信息
3. 如果想使用纯本地模式，修改 `index.html`：
   ```javascript
   const USE_API = false; // 第 777 行
   ```

## 🔄 回滚方案

如果迁移后发现问题，可以快速回滚：

### 方法 1: 使用本地备份

前端会自动将数据备份到 localStorage，直接切换回本地模式：

1. 打开 `index.html`
2. 修改第 777 行：
   ```javascript
   const USE_API = false;
   ```
3. 刷新页面

### 方法 2: 重新导入 JSON

1. 使用之前导出的 `floor-data.json`
2. 在前端点击 **"导入JSON"** 按钮
3. 选择备份文件

### 方法 3: 清空数据库重新迁移

```bash
# 连接 MongoDB
mongo

# 切换到数据库
use floor-db

# 删除所有集合
db.floors.drop()
db.zones.drop()
db.seats.drop()

# 退出
exit

# 重新运行迁移
node scripts/migrate.js floor-data.json
```

## 🐳 Docker 部署（可选）

使用 Docker Compose 快速部署：

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

Docker Compose 会自动启动：
- MongoDB 数据库（端口 27017）
- Node.js 后端（端口 3000）

## 📝 数据库维护

### 备份数据库

```bash
# 导出所有数据
mongodump --db floor-db --out ./backup

# 导出特定集合
mongodump --db floor-db --collection seats --out ./backup
```

### 恢复数据库

```bash
# 恢复所有数据
mongorestore --db floor-db ./backup/floor-db

# 恢复特定集合
mongorestore --db floor-db --collection seats ./backup/floor-db/seats.bson
```

### 创建数据库索引

```bash
mongo
use floor-db

# 为工位创建索引
db.seats.createIndex({ floorId: 1, zoneId: 1 })
db.seats.createIndex({ globalIdx: 1 })
db.seats.createIndex({ seatNo: 1 }, { sparse: true })

# 为区域创建索引
db.zones.createIndex({ floorId: 1 })
db.zones.createIndex({ floorId: 1, code: 1 }, { unique: true })
```

## 🎓 下一步

迁移成功后，您可以：

1. **配置生产环境**：使用 PM2 或 Docker 部署
2. **添加用户认证**：集成 JWT 或 OAuth
3. **实现实时同步**：使用 WebSocket 实现多用户协作
4. **添加数据分析**：创建工位使用率报表
5. **移动端适配**：开发响应式布局或移动应用

## 📞 支持与反馈

如遇到问题，请：

1. 查看本文档的常见问题部分
2. 检查控制台错误信息
3. 查看后端服务日志
4. 提交 Issue 到项目仓库

---

**版本**: 2.0.0
**最后更新**: 2026-01-28
**作者**: Floor Management Team
