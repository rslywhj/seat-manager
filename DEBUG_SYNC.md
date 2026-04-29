# 数据同步调试和修复指南

## 问题诊断

你遇到的问题："数据只在前端，没有同步到服务器"

这通常是以下原因之一：

### 1. 端口配置不匹配

**前端配置** (`index.html`)：
```javascript
const API_BASE = 'https://seat.dougge.top/api';
const WS_URL = 'https://seat.dougge.top/';
```

**服务器配置** (`.env` 或默认)：
```
PORT=3000
```

如果前端和服务器的 URL 不匹配，API 请求会失败（跨域或 404）。

### 2. Nginx 反向代理未配置

如果使用域名 `seat.dougge.top`，需要 Nginx 反向代理到 `localhost:3000`。

### 3. WebSocket 连接失败

WebSocket 也需要通过 Nginx 代理才能工作。

---

## 快速修复步骤

### 步骤 1：停止占用的进程

```bash
# 停止旧的 Node.js 进程
pkill -f "node.*app.js"

# 清理占用的端口
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :3001 | xargs kill -9 2>/dev/null || true

# 验证端口已空闲
netstat -tulpn | grep 3000 || echo "✓ 端口 3000 已空闲"
```

### 步骤 2：创建 .env 文件

```bash
cat > /seat-manager/.env << 'EOF'
PORT=3000
MONGODB_URI=mongodb://localhost:27017/floor-db
CORS_ORIGIN=*
API_PREFIX=/api
NODE_ENV=production
EOF

chmod 600 /seat-manager/.env
cat /seat-manager/.env  # 验证
```

### 步骤 3：启动服务器

```bash
cd /seat-manager
npm install  # 确保 socket.io 已安装
npm run dev
```

**预期输出：**
```
[WebSocket] 服务已初始化
✓ MongoDB 连接成功
╔═══════════════════════════════════════════════╗
║   工位管理系统 API 服务已启动                 ║
║   Server: http://localhost:3000               ║
║   API: http://localhost:3000/api              ║
║   WebSocket: ws://localhost:3000              ║
╚═══════════════════════════════════════════════╝
```

### 步骤 4：配置 Nginx 反向代理

```bash
# 创建 Nginx 配置
sudo bash << 'EOF'
cat > /etc/nginx/sites-available/seat-manager << 'NGINX'
upstream seat_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name seat.dougge.top;

    # API 和 WebSocket 代理
    location / {
        proxy_pass http://seat_backend;
        proxy_http_version 1.1;

        # 重要：支持 WebSocket
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 标准代理头
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 超时（保持长连接）
        proxy_read_timeout 3600;
        proxy_connect_timeout 3600;
        proxy_send_timeout 3600;
    }
}
NGINX

# 创建符号链接
ln -sf /etc/nginx/sites-available/seat-manager /etc/nginx/sites-enabled/

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx

echo "✓ Nginx 已配置并重启"
EOF
```

### 步骤 5：验证数据同步

#### 5a. 测试 API 连接

```bash
# 测试健康检查
curl http://localhost:3000/health

# 预期输出：
# {"success":true,"service":"工位管理系统 API","status":"running","timestamp":"..."}
```

#### 5b. 测试楼层数据 API

```bash
# 获取楼层数据
curl http://localhost:3000/api/floors/floor_d8

# 应该返回：
# {"success":true,"data":{"floor":{...},"zones":[...],"seats":[...]}}
```

#### 5c. 使用域名测试

```bash
# 如果配置了 Nginx
curl https://seat.dougge.top/api/floors/floor_d8
curl https://seat.dougge.top/health
```

---

## 前端调试

### 检查浏览器控制台

打开前端并按 `F12` 打开开发者工具，检查：

**1. 网络标签 (Network)**
- 检查 API 请求是否成功
- 检查响应状态码（200、404、500 等）
- 检查响应内容

**2. 控制台标签 (Console)**
```javascript
// 手动测试 API
fetch('https://seat.dougge.top/api/floors/floor_d8')
  .then(r => r.json())
  .then(d => console.log('API 响应:', d))
  .catch(e => console.error('API 失败:', e));

// 检查 WebSocket 连接
console.log('WebSocket 连接状态:', window.syncClient?.socket?.connected);
```

**3. 应用标签 (Application)**
- 检查 localStorage 是否有数据：`D8F-floor-twins-v2`
- 检查 IndexedDB 是否有数据

### 常见错误及解决

| 错误 | 原因 | 解决方案 |
|------|------|--------|
| `CORS 错误` | 跨域请求被拒绝 | 检查 CORS_ORIGIN 配置 |
| `404 Not Found` | API 端点不存在 | 检查 API_BASE 是否正确 |
| `WebSocket 连接失败` | WebSocket 代理配置错误 | 检查 Nginx `Upgrade` 头配置 |
| `数据为空` | MongoDB 中无数据 | 需要导入数据或创建数据 |

---

## 数据库检查

### 检查 MongoDB 数据

```bash
# 连接 MongoDB
mongo floor-db

# 或者使用 mongosh
mongosh floor-db
```

**在 MongoDB shell 中执行：**

```javascript
// 检查数据量
db.zones.count()      // 应该 > 0
db.seats.count()      // 应该 > 0

// 查看第一条区域数据
db.zones.findOne()

// 查看第一条工位数据
db.seats.findOne()

// 检查版本号字段
db.zones.findOne({ version: { $exists: true } })
db.seats.findOne({ version: { $exists: true } })

// 退出
exit
```

### 如果没有数据

需要导入数据或运行迁移脚本：

```bash
# 方法 1：运行迁移脚本（如果有旧数据）
npm run migrate

# 方法 2：运行 seed 脚本（创建示例数据）
npm run seed

# 方法 3：手动导入 JSON
mongoimport --db floor-db --collection zones --file zones.json --jsonArray
mongoimport --db floor-db --collection seats --file seats.json --jsonArray
```

---

## 服务器日志调试

### 启用详细日志

修改 `server/app.js`，添加更多日志：

```javascript
// 在 API 路由之前添加
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('  Body:', req.body);
  next();
});

// 在处理请求前
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    console.log(`[${new Date().toISOString()}] 响应:`, data);
    return originalJson.call(this, data);
  };
  next();
});
```

### 查看服务器进程

```bash
# 查看 Node.js 进程
ps aux | grep node

# 实时监视日志
tail -f /var/log/app.log  # 如果有日志文件

# 使用 nodemon 自动重启（开发环境）
npm run dev
```

---

## 完整的修复脚本

保存为 `fix-all.sh`：

```bash
#!/bin/bash

echo "🔧 完整修复脚本"
echo "========================================"

# 1. 停止现有进程
echo "[1/6] 停止现有进程..."
pkill -f "node.*app.js" 2>/dev/null || true
sleep 1
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
echo "✓ 完成"

# 2. 配置 .env
echo "[2/6] 配置环境变量..."
cat > .env << 'EOF'
PORT=3000
MONGODB_URI=mongodb://localhost:27017/floor-db
CORS_ORIGIN=*
API_PREFIX=/api
NODE_ENV=production
EOF
echo "✓ 完成"

# 3. 安装依赖
echo "[3/6] 安装依赖..."
npm install 2>/dev/null
echo "✓ 完成"

# 4. 检查 MongoDB
echo "[4/6] 检查 MongoDB..."
systemctl start mongod 2>/dev/null || sudo service mongod start 2>/dev/null || true
sleep 2
mongo --eval "db.adminCommand('ping')" --quiet 2>/dev/null && echo "✓ MongoDB 正常" || echo "⚠ MongoDB 可能未启动"

# 5. 测试 API
echo "[5/6] 测试 API..."
npm run dev &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3000/health | grep success && echo "✓ API 正常" || echo "✗ API 错误"
kill $SERVER_PID 2>/dev/null || true

# 6. 启动服务器
echo "[6/6] 启动服务器..."
echo "========================================"
npm run dev
```

---

## 快速诊断清单

使用此清单快速定位问题：

- [ ] **端口 3000 是否可用？** `lsof -i :3000`
- [ ] **MongoDB 是否运行？** `systemctl status mongod`
- [ ] **是否有 node_modules？** `ls -d node_modules`
- [ ] **是否有 socket.io？** `ls node_modules/socket.io`
- [ ] **API 是否响应？** `curl http://localhost:3000/health`
- [ ] **数据库是否有数据？** `mongo floor-db --eval "db.zones.count()"`
- [ ] **前端 API_BASE 是否正确？** 打开 F12 检查网络请求
- [ ] **WebSocket 是否连接？** 在 F12 Console 输入 `window.syncClient?.socket?.connected`

---

## 还是不行？提供以下信息

如果问题仍未解决，请提供：

1. **服务器日志**：
   ```bash
   npm run dev 2>&1 | tee server.log
   # 生成日志文件，出现问题后 cat server.log
   ```

2. **浏览器控制台错误**：F12 → Console 中的红色错误信息

3. **网络请求详情**：F12 → Network 标签中失败的请求截图

4. **MongoDB 数据检查**：
   ```bash
   mongo floor-db --eval "
     print('Zones:', db.zones.count());
     print('Seats:', db.seats.count());
     db.zones.findOne();
   "
   ```

---

**更新时间**：2026-01-28
**版本**：2.1.0-debug
