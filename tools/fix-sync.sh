#!/bin/bash
# 快速修复脚本 - 解决数据同步问题

echo "🔧 开始修复数据同步问题..."

# 1. 停止占用端口的进程
echo -e "\n[1/5] 清理端口占用..."
lsof -ti :3001 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :3000 2>/dev/null | xargs kill -9 2>/dev/null || true
echo "✓ 端口已清理"

# 2. 创建正确的 .env 配置
echo -e "\n[2/5] 配置服务器..."
cat > .env << 'EOF'
# 服务器端口（确保与前端 API_BASE 匹配）
PORT=3000

# MongoDB 连接
MONGODB_URI=mongodb://localhost:27017/floor-db

# CORS 配置（允许所有域名）
CORS_ORIGIN=*

# API 前缀
API_PREFIX=/api
EOF
echo "✓ .env 配置已创建"

# 3. 检查 MongoDB 服务
echo -e "\n[3/5] 检查 MongoDB..."
if systemctl is-active --quiet mongod 2>/dev/null; then
    echo "✓ MongoDB 正在运行"
elif pgrep -x mongod > /dev/null; then
    echo "✓ MongoDB 进程已启动"
else
    echo "⚠ MongoDB 未运行，尝试启动..."
    sudo systemctl start mongod 2>/dev/null || sudo service mongodb start 2>/dev/null || mongod --fork --logpath /var/log/mongodb.log 2>/dev/null || echo "❌ 无法启动 MongoDB，请手动启动"
fi

# 4. 安装依赖
echo -e "\n[4/5] 检查依赖..."
if [ ! -d "node_modules/socket.io" ]; then
    echo "⚠ 缺少 socket.io，正在安装..."
    npm install
    echo "✓ 依赖已安装"
else
    echo "✓ 依赖完整"
fi

# 5. 启动服务器
echo -e "\n[5/5] 启动服务器..."
echo "======================================"
echo "服务器配置："
echo "  端口: 3000"
echo "  API: http://localhost:3000/api"
echo "  WebSocket: ws://localhost:3000"
echo "======================================"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

npm run dev
