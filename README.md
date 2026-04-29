# 🏢 D座8层 数字孪生工位管理系统 v2.0

一个强大的工位管理系统，支持可视化布局、动态编号、MongoDB后端存储和可选工位编号功能。

## ✨ 核心特性

### 🎯 v2.0 新功能

- ✅ **MongoDB 后端存储**：从 localStorage 迁移到数据库，数据更安全可靠
- ✅ **工位编号可选化**：支持工位没有编号（`seatNo: null`）
- ✅ **RESTful API**：完整的 CRUD 接口
- ✅ **自动备份**：前端自动保存到 localStorage 作为备份
- ✅ **错误容错**：API 失败时自动回退到本地模式
- ✅ **Docker 支持**：一键部署生产环境

### 🔥 原有功能

- **可视化画布**：拖拽式区域管理，支持缩放和调整大小
- **智能编号**：支持 6 种编号模式（行、列、蛇形等）
- **人员管理**：记录姓名、部门、工号、电话、备注
- **数据导入导出**：支持 JSON 和 XLSX 格式
- **实时统计**：总工位、已占用、空闲数量
- **工位分布图**：网格视图展示区域内所有工位

## 📸 功能截图

### Canvas 可视化布局
- 自由拖拽区域位置
- 调整区域大小
- 实时显示工位分布

### 工位编辑器
- 支持清空工位编号
- 显示工位号或"未分配"
- 完整的人员信息管理

### 工位分布网格
- 可视化显示所有工位
- 已占用/空闲状态一目了然
- 点击工位快速编辑

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动 MongoDB

```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongod
```

### 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件（可选，默认配置可直接使用）：

```env
MONGODB_URI=mongodb://localhost:27017/floor-db
PORT=3000
NODE_ENV=development
```

### 启动后端服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 打开前端

在浏览器中打开 `index.html`

## 📊 数据迁移

如果你已有旧版本的数据（localStorage），请按照以下步骤迁移：

### 1. 导出现有数据

在旧版系统中点击"导出JSON"，保存为 `floor-data.json`

### 2. 运行迁移脚本

```bash
node scripts/migrate.js floor-data.json
```

### 3. 启动服务并验证

详细迁移指南请参阅 [MIGRATION.md](./MIGRATION.md)

## 🗄️ 数据模型

### Floor（楼层）

```javascript
{
  id: "floor_d8",
  name: "D座8层",
  canvasWidth: 1200,
  canvasHeight: 800
}
```

### Zone（区域）

```javascript
{
  floorId: "floor_d8",
  name: "区域A",
  code: "ZHA",
  x: 100,
  y: 100,
  width: 300,
  height: 400,
  count: 100,
  rows: 10,
  cols: 10,
  order: "row",
  color: "#6366f1"
}
```

### Seat（工位）

```javascript
{
  floorId: "floor_d8",
  zoneId: ObjectId,
  seatNo: "001" | null,  // ⭐ 可选工位编号
  globalIdx: 1,
  localIdx: 1,
  r: 1,
  c: 1,
  person: {
    name: "张三",
    dept: "供应链组",
    empId: "E001",
    phone: "13800138000",
    note: "备注信息"
  }
}
```

## 🔌 API 接口

### Floors API

```bash
GET    /api/floors/:floorId              # 获取楼层及所有数据
POST   /api/floors                       # 创建新楼层
PUT    /api/floors/:floorId              # 更新楼层
DELETE /api/floors/:floorId              # 删除楼层
```

### Zones API

```bash
GET    /api/floors/:floorId/zones        # 获取所有区域
GET    /api/floors/:floorId/zones/:zoneId  # 获取单个区域
POST   /api/floors/:floorId/zones        # 创建区域（自动生成工位）
PUT    /api/floors/:floorId/zones/:zoneId  # 更新区域
DELETE /api/floors/:floorId/zones/:zoneId  # 删除区域（级联删除工位）
```

### Seats API

```bash
GET    /api/floors/:floorId/seats        # 获取所有工位
GET    /api/floors/:floorId/seats/:seatId  # 获取单个工位
PUT    /api/floors/:floorId/seats/:seatId  # 更新工位（支持清空编号）
PATCH  /api/floors/:floorId/seats/:seatId/clear-number  # 清空工位编号
```

## 🧪 测试

### 运行测试

```bash
npm test
```

### 手动测试 API

```bash
# 健康检查
curl http://localhost:3000/health

# 获取楼层数据
curl http://localhost:3000/api/floors/floor_d8

# 清空工位编号
curl -X PATCH http://localhost:3000/api/floors/floor_d8/seats/507f1f77bcf86cd799439011/clear-number
```

## 🐳 Docker 部署

### 使用 Docker Compose

```bash
# 启动所有服务（MongoDB + 后端）
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境部署

```bash
# 构建镜像
docker build -t floor-manager:2.0 .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017/floor-db \
  --name floor-manager-api \
  floor-manager:2.0
```

## 📦 项目结构

```
set_manager/
├── index.html                    # 前端单页应用
├── package.json                  # 项目依赖
├── .env.example                  # 环境变量模板
├── docker-compose.yml            # Docker Compose 配置
├── Dockerfile                    # Docker 镜像
├── MIGRATION.md                  # 迁移指南
├── README.md                     # 本文件
├── server/                       # 后端源码
│   ├── app.js                   # Express 应用入口
│   ├── config/
│   │   └── db.js                # MongoDB 配置
│   ├── models/
│   │   ├── Floor.js             # Floor 模型
│   │   ├── Zone.js              # Zone 模型
│   │   └── Seat.js              # Seat 模型（支持 null seatNo）
│   ├── routes/
│   │   ├── floors.js            # Floor 路由
│   │   ├── zones.js             # Zone 路由
│   │   └── seats.js             # Seat 路由
│   ├── utils/
│   │   └── seatBuilder.js       # 工位编号算法
│   └── middleware/
│       └── errorHandler.js      # 错误处理
└── scripts/
    └── migrate.js               # 数据迁移脚本
```

## ⚙️ 配置选项

### 前端配置

在 `index.html` 中修改：

```javascript
const API_BASE = 'http://localhost:3000/api';  // API 地址
const FLOOR_ID = 'floor_d8';                   // 楼层 ID
const USE_API = true;                           // 是否使用 API（false 为纯本地模式）
```

### 后端配置

在 `.env` 文件中修改：

```env
MONGODB_URI=mongodb://localhost:27017/floor-db  # MongoDB 连接
PORT=3000                                       # 服务端口
NODE_ENV=development                            # 环境（development/production）
CORS_ORIGIN=*                                   # CORS 配置
```

## 🎯 工位编号模式

系统支持 6 种工位编号模式：

1. **按行（row）**: 从左到右，从上到下
2. **行逆序（row-reverse）**: 从右到左，从上到下
3. **蛇形（snake）**: 奇数行从左到右，偶数行从右到左
4. **按列（col）**: 从上到下，从左到右
5. **列逆序（col-reverse）**: 从下到上，从左到右
6. **列蛇形（col-snake）**: 奇数列从上到下，偶数列从下到上

每种模式都支持倒序编号（N→1）。

## ⭐ 可选工位编号功能

### 使用场景

- **临时工位**：短期使用的工位可不分配编号
- **预留工位**：规划中但未投入使用的工位
- **特殊区域**：会议室、休息区等不需要编号的位置
- **灵活管理**：根据实际需求动态调整编号

### 如何清空工位编号

1. 点击工位打开编辑器
2. 点击工位号字段旁的 **"清除编号"** 按钮
3. 确认操作

清空后：
- 工位号字段显示为空
- 标题显示"编辑工位（无编号）"
- 工位卡片显示 "-"（灰色）
- Canvas 上显示 "-"

### API 支持

```bash
# 清空工位编号
curl -X PATCH http://localhost:3000/api/floors/floor_d8/seats/:seatId/clear-number

# 更新工位（设置 seatNo 为 null）
curl -X PUT http://localhost:3000/api/floors/floor_d8/seats/:seatId \
  -H "Content-Type: application/json" \
  -d '{"seatNo": null}'
```

## 🛠️ 技术栈

### 前端
- 原生 JavaScript（无框架）
- Canvas API（可视化绘图）
- SheetJS（XLSX 导入导出）

### 后端
- Node.js
- Express.js
- Mongoose（MongoDB ODM）

### 数据库
- MongoDB 6.0+

### 部署
- Docker
- Docker Compose
- PM2（可选）

## 📝 脚本命令

```json
{
  "start": "node server/app.js",          // 启动生产服务器
  "dev": "nodemon server/app.js",         // 启动开发服务器（自动重启）
  "test": "jest --detectOpenHandles",     // 运行测试
  "test:watch": "jest --watch",           // 监听模式测试
  "migrate": "node scripts/migrate.js"    // 数据迁移
}
```

## 🔒 安全注意事项

1. **生产环境**：
   - 修改 MongoDB 默认端口
   - 启用 MongoDB 认证
   - 使用环境变量存储敏感信息
   - 配置防火墙规则

2. **API 安全**：
   - 实施 CORS 白名单
   - 添加请求速率限制
   - 实现用户认证（JWT）

3. **数据备份**：
   - 定期备份 MongoDB 数据
   - 保留前端 localStorage 备份
   - 设置自动备份任务

## 📈 性能优化

- **数据库索引**：已为常用查询字段创建索引
- **分页支持**：Seats API 支持分页（limit/offset）
- **前端缓存**：使用 localStorage 作为二级缓存
- **懒加载**：大量数据时按需加载

## 🐛 故障排查

### API 无法连接

1. 检查后端服务是否运行：`npm run dev`
2. 检查 MongoDB 是否运行
3. 验证 CORS 配置
4. 查看浏览器控制台错误

### 数据不同步

1. 检查网络连接
2. 清空浏览器缓存
3. 重新加载页面
4. 查看后端日志

### 工位编号错误

1. 检查区域 `order` 配置
2. 重新生成工位：删除区域后重新创建
3. 运行迁移脚本重建数据

## 📄 许可证

MIT License

## 👥 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📞 联系方式

- 项目维护：Floor Management Team
- 版本：v2.0.0
- 更新日期：2026-01-28

---

**🎉 感谢使用工位管理系统！**
