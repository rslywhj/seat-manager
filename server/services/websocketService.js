/**
 * WebSocket Service - 实时数据同步服务
 * 基于 Socket.IO 的增量同步实现
 */

const Zone = require('../models/Zone');
const Seat = require('../models/Seat');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // 存储连接的客户端信息
  }

  /**
   * 初始化 WebSocket 服务
   * @param {Server} io - Socket.IO 实例
   */
  initialize(io) {
    this.io = io;

    io.on('connection', (socket) => {
      console.log(`[WebSocket] 客户端连接: ${socket.id}`);

      // 存储客户端信息
      this.connectedClients.set(socket.id, {
        socketId: socket.id,
        floorId: null,
        connectedAt: new Date(),
        lastSync: null
      });

      // 客户端订阅特定楼层
      socket.on('subscribe:floor', async (floorId) => {
        try {
          console.log(`[WebSocket] 客户端 ${socket.id} 订阅楼层: ${floorId}`);
          socket.join(`floor:${floorId}`);

          // 更新客户端信息
          const clientInfo = this.connectedClients.get(socket.id);
          if (clientInfo) {
            clientInfo.floorId = floorId;
          }

          // 发送初始数据（格式化数据以保持与 REST API 一致）
          const [zones, seats] = await Promise.all([
            Zone.find({ floorId }).sort({ createdAt: 1 }),
            Seat.find({ floorId })
          ]);

          socket.emit('sync:initial', {
            zones: zones.map(z => ({
              _id: z._id,
              id: z._id.toString(), // 前端兼容性
              floorId: z.floorId,
              type: z.type, // 区域类型
              name: z.name,
              code: z.code,
              x: z.x,
              y: z.y,
              width: z.width,
              height: z.height,
              count: z.count,
              rows: z.rows,
              cols: z.cols,
              order: z.order,
              color: z.color,
              image: z.image, // 区域图片
              version: z.version,
              createdAt: z.createdAt,
              updatedAt: z.updatedAt
            })),
            seats: seats.map(s => ({
              _id: s._id,
              seatId: s._id.toString(), // 前端兼容性
              floorId: s.floorId,
              zoneId: s.zoneId.toString(),
              seatNo: s.seatNo,
              globalIdx: s.globalIdx,
              localIdx: s.localIdx,
              r: s.r,
              c: s.c,
              person: s.person,
              network: s.network, // 网络接口信息
              version: s.version,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt
            })),
            timestamp: Date.now()
          });

          console.log(`[WebSocket] 已向客户端 ${socket.id} 发送初始数据`);
        } catch (error) {
          console.error(`[WebSocket] 订阅失败:`, error);
          socket.emit('error', { message: '订阅楼层失败', error: error.message });
        }
      });

      // 客户端请求增量同步
      socket.on('sync:request', async ({ floorId, lastSyncTime, clientVersions }) => {
        try {
          console.log(`[WebSocket] 客户端 ${socket.id} 请求增量同步`);
          console.log(`  - 楼层: ${floorId}`);
          console.log(`  - 上次同步: ${new Date(lastSyncTime).toISOString()}`);

          // 查询自上次同步以来的变更
          const changes = await this.getIncrementalChanges(floorId, lastSyncTime, clientVersions);

          socket.emit('sync:incremental', {
            changes,
            timestamp: Date.now()
          });

          // 更新客户端最后同步时间
          const clientInfo = this.connectedClients.get(socket.id);
          if (clientInfo) {
            clientInfo.lastSync = new Date();
          }

          console.log(`[WebSocket] 已发送增量数据: ${changes.zones.length} 个区域, ${changes.seats.length} 个工位`);
        } catch (error) {
          console.error(`[WebSocket] 增量同步失败:`, error);
          socket.emit('error', { message: '增量同步失败', error: error.message });
        }
      });

      // 客户端上传本地变更（离线时产生的）
      socket.on('sync:upload', async ({ floorId, changes }) => {
        try {
          console.log(`[WebSocket] 客户端 ${socket.id} 上传本地变更`);

          const result = await this.applyClientChanges(floorId, changes, socket.id);

          socket.emit('sync:upload-result', result);

          // 如果有冲突，通知客户端
          if (result.conflicts.length > 0) {
            socket.emit('sync:conflicts', {
              conflicts: result.conflicts,
              timestamp: Date.now()
            });
          }

          console.log(`[WebSocket] 变更应用完成: 成功 ${result.applied.length}, 冲突 ${result.conflicts.length}`);
        } catch (error) {
          console.error(`[WebSocket] 上传变更失败:`, error);
          socket.emit('error', { message: '上传变更失败', error: error.message });
        }
      });

      // 客户端断开连接
      socket.on('disconnect', () => {
        console.log(`[WebSocket] 客户端断开: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });

    console.log('[WebSocket] 服务已初始化');
  }

  /**
   * 获取增量变更
   * @param {String} floorId - 楼层 ID
   * @param {Number} lastSyncTime - 上次同步时间戳
   * @param {Object} clientVersions - 客户端的版本信息 { zoneId: version, seatId: version }
   * @returns {Object} 变更数据
   */
  async getIncrementalChanges(floorId, lastSyncTime, clientVersions = {}) {
    const lastSync = new Date(lastSyncTime);

    // 查询更新的区域（基于时间戳或版本号）
    const zones = await Zone.find({
      floorId,
      $or: [
        { updatedAt: { $gt: lastSync } },
        { _id: { $in: Object.keys(clientVersions.zones || {}) } }
      ]
    });

    // 过滤出真正需要同步的区域（版本号不同的）
    const changedZones = zones.filter(zone => {
      const clientVersion = clientVersions.zones?.[zone._id.toString()];
      return !clientVersion || zone.version > clientVersion;
    });

    // 查询更新的工位
    const seats = await Seat.find({
      floorId,
      $or: [
        { updatedAt: { $gt: lastSync } },
        { _id: { $in: Object.keys(clientVersions.seats || {}) } }
      ]
    });

    // 过滤出真正需要同步的工位
    const changedSeats = seats.filter(seat => {
      const clientVersion = clientVersions.seats?.[seat._id.toString()];
      return !clientVersion || seat.version > clientVersion;
    });

    return {
      zones: changedZones.map(z => ({
        _id: z._id,
        id: z._id.toString(),
        floorId: z.floorId,
        type: z.type, // 区域类型
        name: z.name,
        code: z.code,
        x: z.x,
        y: z.y,
        width: z.width,
        height: z.height,
        count: z.count,
        rows: z.rows,
        cols: z.cols,
        order: z.order,
        color: z.color,
        image: z.image, // 区域图片
        version: z.version,
        createdAt: z.createdAt,
        updatedAt: z.updatedAt
      })),
      seats: changedSeats.map(s => ({
        _id: s._id,
        seatId: s._id.toString(),
        floorId: s.floorId,
        zoneId: s.zoneId.toString(),
        seatNo: s.seatNo,
        globalIdx: s.globalIdx,
        localIdx: s.localIdx,
        r: s.r,
        c: s.c,
        person: s.person,
        network: s.network, // 网络接口信息
        version: s.version,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      deletedZones: [], // TODO: 实现软删除跟踪
      deletedSeats: []  // TODO: 实现软删除跟踪
    };
  }

  /**
   * 应用客户端变更（处理离线时产生的变更）
   * @param {String} floorId - 楼层 ID
   * @param {Object} changes - 客户端变更 { zones: [], seats: [] }
   * @param {String} clientId - 客户端 ID
   * @returns {Object} 应用结果
   */
  async applyClientChanges(floorId, changes, clientId) {
    const result = {
      applied: [],
      conflicts: [],
      errors: []
    };

    // 处理区域变更
    for (const zoneChange of changes.zones || []) {
      try {
        const { _id, clientVersion, ...updates } = zoneChange;

        // 查询服务器端的最新版本
        const serverZone = await Zone.findById(_id);

        if (!serverZone) {
          result.errors.push({
            type: 'zone',
            id: _id,
            error: '区域不存在'
          });
          continue;
        }

        // 检查版本冲突（乐观锁）
        if (serverZone.version !== clientVersion) {
          result.conflicts.push({
            type: 'zone',
            id: _id,
            clientVersion,
            serverVersion: serverZone.version,
            clientData: zoneChange,
            serverData: serverZone
          });
          continue;
        }

        // 应用变更
        Object.assign(serverZone, updates);
        await serverZone.save();

        result.applied.push({
          type: 'zone',
          id: _id,
          newVersion: serverZone.version
        });

        // 广播变更给其他客户端
        this.broadcastChange('zone:updated', serverZone, clientId, floorId);

      } catch (error) {
        result.errors.push({
          type: 'zone',
          id: zoneChange._id,
          error: error.message
        });
      }
    }

    // 处理工位变更
    for (const seatChange of changes.seats || []) {
      try {
        const { _id, clientVersion, ...updates } = seatChange;

        const serverSeat = await Seat.findById(_id);

        if (!serverSeat) {
          result.errors.push({
            type: 'seat',
            id: _id,
            error: '工位不存在'
          });
          continue;
        }

        // 检查版本冲突
        if (serverSeat.version !== clientVersion) {
          result.conflicts.push({
            type: 'seat',
            id: _id,
            clientVersion,
            serverVersion: serverSeat.version,
            clientData: seatChange,
            serverData: serverSeat
          });
          continue;
        }

        // 应用变更（特别处理 person 字段）
        if (updates.person) {
          Object.assign(serverSeat.person, updates.person);
        }
        if (updates.seatNo !== undefined) {
          serverSeat.seatNo = updates.seatNo;
        }
        await serverSeat.save();

        result.applied.push({
          type: 'seat',
          id: _id,
          newVersion: serverSeat.version
        });

        // 广播变更给其他客户端
        this.broadcastChange('seat:updated', serverSeat, clientId, floorId);

      } catch (error) {
        result.errors.push({
          type: 'seat',
          id: seatChange._id,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * 广播数据变更给所有客户端（除发送者外）
   * @param {String} event - 事件名称
   * @param {Object} data - 数据
   * @param {String} excludeClientId - 排除的客户端 ID
   * @param {String} floorId - 楼层 ID
   */
  broadcastChange(event, data, excludeClientId, floorId) {
    if (!this.io) return;

    this.io.to(`floor:${floorId}`).except(excludeClientId).emit(event, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * 通知区域更新
   */
  notifyZoneUpdate(zone, excludeClientId = null) {
    this.broadcastChange('zone:updated', zone, excludeClientId, zone.floorId);
  }

  /**
   * 通知区域删除
   */
  notifyZoneDelete(zoneId, floorId, excludeClientId = null) {
    this.broadcastChange('zone:deleted', { _id: zoneId }, excludeClientId, floorId);
  }

  /**
   * 通知工位更新
   */
  notifySeatUpdate(seat, excludeClientId = null) {
    this.broadcastChange('seat:updated', seat, excludeClientId, seat.floorId);
  }

  /**
   * 通知工位删除
   */
  notifySeatDelete(seatId, floorId, excludeClientId = null) {
    this.broadcastChange('seat:deleted', { _id: seatId }, excludeClientId, floorId);
  }

  /**
   * 获取在线客户端数量
   */
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  /**
   * 获取在线客户端列表
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.values());
  }
}

// 导出单例
module.exports = new WebSocketService();
