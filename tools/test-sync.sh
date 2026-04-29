#!/bin/bash
# 数据同步诊断脚本

echo "=========================================="
echo "数据同步诊断"
echo "=========================================="

# 1. 检查端口占用
echo -e "\n1. 检查端口状态："
PORT=${1:-3000}
lsof -i :$PORT 2>/dev/null || netstat -tulpn 2>/dev/null | grep $PORT || echo "端口 $PORT 未被占用"

# 2. 检查服务器进程
echo -e "\n2. 检查 Node.js 进程："
ps aux | grep "node.*app.js" | grep -v grep

# 3. 测试 API 连接
echo -e "\n3. 测试 API 连接："
BASE_URL=${2:-http://localhost:3000}
curl -s "${BASE_URL}/health" | jq . 2>/dev/null || curl -s "${BASE_URL}/health"

# 4. 测试楼层数据 API
echo -e "\n4. 测试楼层数据 API："
curl -s "${BASE_URL}/api/floors/floor_d8" | jq '.success' 2>/dev/null || echo "API 请求失败"

# 5. 检查 MongoDB 连接
echo -e "\n5. 检查 MongoDB："
mongo --quiet --eval "db.adminCommand('ping')" 2>/dev/null || mongosh --quiet --eval "db.adminCommand('ping')" || echo "无法连接 MongoDB"

# 6. 查看数据库中的数据量
echo -e "\n6. 数据库数据量："
mongo floor-db --quiet --eval "
  print('Zones: ' + db.zones.count());
  print('Seats: ' + db.seats.count());
" 2>/dev/null || mongosh floor-db --quiet --eval "
  print('Zones: ' + db.zones.countDocuments());
  print('Seats: ' + db.seats.countDocuments());
"

echo -e "\n=========================================="
echo "诊断完成"
echo "=========================================="
