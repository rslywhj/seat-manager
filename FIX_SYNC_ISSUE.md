# 数据同步问题修复说明

## 问题根因

**关键问题**：新创建的区域没有 `_id` 字段（MongoDB ObjectId），导致保存时无法调用 API。

###  问题代码

```javascript
// 创建区域时只生成客户端 ID
const newZone = {
  id: uid("zone"),  // ← 只有客户端 ID
  name: "新区域",
  // ... 没有 _id 字段
};

// 保存时检查 _id
if (USE_API && zone._id) {  // ← 新区域没有 _id，永远不会执行！
  await api.updateZone(...);
}
```

**结果**：新区域只保存在 localStorage，永远不会同步到服务器！

---

## 修复方案

### 修改后的逻辑

```javascript
if (USE_API) {
  if (zone._id) {
    // 更新现有区域
    const result = await api.updateZone(zone._id, updates);
    zone.version = result.zone.version;
  } else {
    // 创建新区域（首次保存）
    const result = await api.createZone(updates);
    zone._id = result.zone._id;  // ← 关键：保存服务器返回的 _id
    zone.version = result.zone.version;
    zone.id = zone._id.toString();  // 统一 id 和 _id
  }
}
```

---

## 快速验证步骤

### 1. 打开调试工具

在浏览器中打开：
```
debug-tool.html
```

### 2. 配置 API 地址

在页面顶部输入：
- **API Base URL**: `https://seat.dougge.top/api`
- **WebSocket URL**: `https://seat.dougge.top/`
- **Floor ID**: `floor_d8`

### 3. 运行完整测试

点击 **"运行完整测试"** 按钮（在页面底部），测试流程：
1. ✓ 创建区域
2. ✓ 读取区域（验证已保存到服务器）
3. ✓ 更新区域
4. ✓ 验证更新
5. ✓ 创建工位
6. ✓ 更新工位
7. ✓ 清理数据

**预期结果**：所有步骤显示 ✓，最后显示"所有测试通过！"

### 4. 测试实际应用

打开 `index.html`：

#### 步骤 A：创建新区域
1. 点击 **"添加区域"** 按钮
2. 在画布上拖拽绘制区域
3. 在弹出的配置窗口中输入信息
4. 点击 **"保存"**
5. **打开浏览器控制台（F12）**

**预期日志**：
```
⏳ 创建区域到服务器...
✓ 区域已创建: 67a1b2c3d4e5f6789a0b1c2d
```

#### 步骤 B：验证数据已同步

打开第二个浏览器标签页或新的浏览器窗口：
```
http://localhost:8000/index.html
```

**预期结果**：新创建的区域自动显示！

#### 步骤 C：检查数据库

在服务器上运行：
```bash
mongo floor-db --eval "
  db.zones.find().forEach(z => {
    print(z.name + ': ' + z._id);
  });
"
```

**预期输出**：可以看到刚才创建的区域

---

## 诊断清单

如果仍然有问题，按此清单检查：

### □ 前端配置检查

打开 `index.html`，按 F12，在控制台输入：

```javascript
// 1. 检查 API 配置
console.log('API_BASE:', API_BASE);
console.log('USE_API:', USE_API);
console.log('WS_URL:', WS_URL);

// 2. 检查现有区域是否有 _id
console.log('区域数据:', state.zones);
console.log('第一个区域:', state.zones[0]);

// 3. 测试 API 连接
fetch(API_BASE + '/floors/' + FLOOR_ID)
  .then(r => r.json())
  .then(d => console.log('API 响应:', d))
  .catch(e => console.error('API 错误:', e));
```

### □ 服务器检查

```bash
# 检查服务器是否运行
curl https://seat.dougge.top/health

# 检查 API
curl https://seat.dougge.top/api/floors/floor_d8

# 检查数据库
mongo floor-db --eval "db.zones.count()"
```

### □ 网络请求检查

1. 打开浏览器 F12 → **Network** 标签
2. 创建或修改区域
3. 查看请求列表

**成功的请求**：
- POST `/api/floors/floor_d8/zones` - 状态 200
- PUT `/api/floors/floor_d8/zones/{id}` - 状态 200

**失败的情况**：
- 404：API 路径错误或服务器未运行
- 500：服务器内部错误
- CORS：跨域问题

---

## 常见错误排查

### 错误 1：控制台显示 "API 保存失败"

**原因**：
- 服务器未运行
- API 地址配置错误
- CORS 配置问题

**解决**：
```bash
# 检查服务器
curl https://seat.dougge.top/health

# 检查 Nginx
nginx -t
systemctl status nginx
```

### 错误 2：数据保存到 localStorage 但不在数据库中

**原因**：修复前创建的区域没有 `_id`

**解决**：
```javascript
// 在浏览器控制台执行
console.log('检查区域:', state.zones.map(z => ({ name: z.name, hasId: !!z._id })));

// 删除没有 _id 的旧区域
state.zones = state.zones.filter(z => z._id);
saveState();
location.reload();
```

### 错误 3：WebSocket 未连接

**原因**：
- Nginx WebSocket 配置缺失
- 服务器未启动 Socket.IO

**解决**：
检查 Nginx 配置是否包含：
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## 迁移旧数据

如果系统中已有旧数据（没有 `_id`），需要清理：

### 方法 1：清空 localStorage（简单）

在浏览器控制台执行：
```javascript
localStorage.removeItem('D8F-floor-twins-v2');
location.reload();
```

### 方法 2：修复现有数据（保留数据）

在浏览器控制台执行：
```javascript
(async () => {
  for (const zone of state.zones) {
    if (!zone._id) {
      try {
        console.log('修复区域:', zone.name);
        const result = await api.createZone({
          name: zone.name,
          code: zone.code,
          x: zone.x,
          y: zone.y,
          width: zone.width,
          height: zone.height,
          count: zone.count,
          rows: zone.rows,
          cols: zone.cols,
          order: zone.order,
          color: zone.color
        });
        zone._id = result.zone._id;
        zone.id = zone._id.toString();
        console.log('✓ 已修复:', zone._id);
      } catch (e) {
        console.error('修复失败:', e);
      }
    }
  }
  saveState();
  alert('修复完成！请刷新页面');
})();
```

---

## 总结

### 修复内容

1. **区域保存逻辑**：增加新建和更新的判断
2. **_id 字段处理**：首次保存时从服务器获取 _id
3. **离线队列**：支持创建和更新两种操作类型

### 影响范围

- ✅ 新建区域
- ✅ 更新区域
- ⚠️ 工位由区域自动创建，无需单独修复

### 后续建议

1. **清理旧数据**：删除没有 `_id` 的历史数据
2. **监控日志**：观察控制台，确保所有操作都显示 "✓ 区域已创建" 或 "✓ 区域已保存"
3. **多终端测试**：用两个浏览器测试实时同步

---

**修复时间**：2026-01-28
**影响版本**：2.0.0 → 2.1.1
**状态**：已修复并测试
