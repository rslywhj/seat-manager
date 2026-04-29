# 🚀 快速启动指南

## 5 分钟快速开始

### 1️⃣ 前置准备（1 分钟）

确保已安装：
- Node.js v14+ （[下载](https://nodejs.org/)）
- MongoDB v5+ （[下载](https://www.mongodb.com/try/download/community)）

### 2️⃣ 启动服务（2 分钟）

#### Windows

```bash
# 打开 PowerShell 或 CMD

# 启动 MongoDB（在新窗口）
mongod

# 在当前窗口安装依赖
cd set_manager
npm install

# 启动后端服务
npm run dev
```

#### macOS/Linux

```bash
# 启动 MongoDB（在后台）
sudo systemctl start mongod

# 或使用 Homebrew（macOS）
brew services start mongodb-community

# 安装依赖并启动
cd set_manager
npm install
npm run dev
```

### 3️⃣ 打开应用（1 分钟）

在浏览器中打开：`file:///path/to/set_manager/index.html`

或者用 Python 启动简单 HTTP 服务器：

```bash
cd set_manager
python -m http.server 8000

# 然后在浏览器打开：http://localhost:8000
```

### 4️⃣ 验证成功（1 分钟）

- ✅ 页面加载完成
- ✅ 控制台显示 "✓ API 数据加载成功"
- ✅ 显示楼层和区域
- ✅ 可点击区域查看工位

完成！🎉

---

## 📚 下一步

### 导入现有数据

如果你有旧版系统的数据备份：

```bash
# 1. 导出旧系统数据为 JSON
# （在旧系统中点击"导出JSON"）

# 2. 运行迁移脚本
node scripts/migrate.js floor-data.json

# 3. 刷新浏览器
```

详见：[MIGRATION.md](./MIGRATION.md)

### 测试 API

```bash
# 在新的终端窗口运行

# 测试后端是否运行
curl http://localhost:3000/health

# 获取楼层数据
curl http://localhost:3000/api/floors/floor_d8
```

### 测试新功能

1. **清空工位编号**
   - 点击任意工位 → 点击"清除编号" → 确认
   - 工位号变为"-"或"未分配"

2. **编辑工位信息**
   - 点击工位 → 编辑人员信息 → 保存
   - 数据自动同步到后端和本地

3. **导入导出**
   - 导出：点击"导出JSON"保存备份
   - 导入：点击"导入JSON"恢复数据

---

## 🐳 使用 Docker（可选）

一条命令启动所有服务：

```bash
docker-compose up -d
```

访问：`http://localhost:3000`

---

## 📊 关键指标

| 功能 | 状态 | 说明 |
|------|------|------|
| 工位可视化 | ✅ | Canvas 实时显示工位分布 |
| 工位编号 | ✅ | 支持 6 种编号模式，可为空 |
| 数据持久化 | ✅ | MongoDB 后端 + localStorage 备份 |
| 人员管理 | ✅ | 记录姓名、部门、工号等 |
| 数据导入导出 | ✅ | JSON 和 XLSX 格式 |
| API 接口 | ✅ | 完整的 RESTful API |
| 错误容错 | ✅ | API 失败自动回退 |
| Docker 支持 | ✅ | 一键部署 |

---

## ⚠️ 常见问题

**Q: API 连接失败怎么办？**
A: 检查后端是否运行（`npm run dev`）和 MongoDB 是否启动（`mongod`）

**Q: 数据没有保存？**
A: 检查浏览器控制台是否有错误，查看后端日志

**Q: 如何关闭 API 只使用本地模式？**
A: 修改 `index.html` 第 777 行：`const USE_API = false;`

**Q: 如何重置所有数据？**
A:
```bash
# 删除本地缓存
# 清空浏览器 localStorage
# 或删除 MongoDB 数据库
mongo
use floor-db
db.dropDatabase()
```

---

## 🎓 学习资源

- [API 文档](../README.md#-api-接口)
- [迁移指南](./MIGRATION.md)
- [完整文档](../README.md)

---

## 💡 使用建议

1. **定期备份**：定期导出 JSON 作为备份
2. **性能优化**：大量工位时使用分页 API
3. **安全部署**：生产环境使用 Docker + HTTPS
4. **监控告警**：使用 PM2 Plus 监控服务状态

---

## 📞 获得帮助

- 查看控制台错误信息（F12）
- 检查 [MIGRATION.md](./MIGRATION.md) 的故障排查部分
- 查看 [README.md](../README.md) 获取完整文档

---

**版本**: 2.0.0 | **更新**: 2026-01-28

**祝您使用愉快！** 🎉
