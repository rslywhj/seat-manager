/**
 * API 集成测试
 * 使用 Jest 和 Supertest 进行测试
 */

const request = require('supertest');
const app = require('../server/app');
const { connectDB, disconnectDB } = require('../server/config/db');
const Floor = require('../server/models/Floor');
const Zone = require('../server/models/Zone');
const Seat = require('../server/models/Seat');

describe('工位管理系统 API 测试', () => {
  beforeAll(async () => {
    // 连接测试数据库
    await connectDB();
  });

  afterAll(async () => {
    // 清理数据和断开连接
    await Floor.deleteMany({});
    await Zone.deleteMany({});
    await Seat.deleteMany({});
    await disconnectDB();
  });

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('running');
    });
  });

  describe('Floors API', () => {
    let floorId = 'floor_test_001';

    it('应该创建新楼层', async () => {
      const res = await request(app)
        .post('/api/floors')
        .send({
          id: floorId,
          name: '测试楼层',
          canvasWidth: 1200,
          canvasHeight: 800
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(floorId);
      expect(res.body.data.name).toBe('测试楼层');
    });

    it('应该获取楼层数据', async () => {
      const res = await request(app)
        .get(`/api/floors/${floorId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.floor.id).toBe(floorId);
      expect(Array.isArray(res.body.data.zones)).toBe(true);
      expect(Array.isArray(res.body.data.seats)).toBe(true);
    });

    it('应该更新楼层', async () => {
      const res = await request(app)
        .put(`/api/floors/${floorId}`)
        .send({
          name: '更新后的楼层'
        })
        .expect(200);

      expect(res.body.data.name).toBe('更新后的楼层');
    });
  });

  describe('Zones API', () => {
    let floorId = 'floor_test_002';
    let zoneId;

    beforeAll(async () => {
      // 创建楼层
      await Floor.create({
        id: floorId,
        name: '测试楼层'
      });
    });

    it('应该创建新区域', async () => {
      const res = await request(app)
        .post(`/api/floors/${floorId}/zones`)
        .send({
          name: '测试区域',
          code: 'TEST',
          x: 100,
          y: 100,
          width: 300,
          height: 400,
          count: 20,
          rows: 4,
          cols: 5,
          order: 'row',
          color: '#6366f1'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.zone.name).toBe('测试区域');
      expect(res.body.data.zone.code).toBe('TEST');
      expect(res.body.data.seats.length).toBe(20);

      zoneId = res.body.data.zone._id;
    });

    it('应该获取所有区域', async () => {
      const res = await request(app)
        .get(`/api/floors/${floorId}/zones`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('应该获取单个区域', async () => {
      const res = await request(app)
        .get(`/api/floors/${floorId}/zones/${zoneId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.zone._id.toString()).toBe(zoneId.toString());
    });

    it('应该更新区域', async () => {
      const res = await request(app)
        .put(`/api/floors/${floorId}/zones/${zoneId}`)
        .send({
          name: '更新的区域名'
        })
        .expect(200);

      expect(res.body.data.zone.name).toBe('更新的区域名');
    });

    it('应该删除区域（级联删除工位）', async () => {
      // 先验证工位存在
      const seatsBeforeDelete = await Seat.countDocuments({ zoneId });
      expect(seatsBeforeDelete).toBeGreaterThan(0);

      // 删除区域
      const res = await request(app)
        .delete(`/api/floors/${floorId}/zones/${zoneId}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // 验证工位已删除
      const seatsAfterDelete = await Seat.countDocuments({ zoneId });
      expect(seatsAfterDelete).toBe(0);
    });
  });

  describe('Seats API', () => {
    let floorId = 'floor_test_003';
    let zoneId;
    let seatId;

    beforeAll(async () => {
      // 创建楼层和区域
      await Floor.create({
        id: floorId,
        name: '测试楼层'
      });

      const zone = await Zone.create({
        floorId,
        name: '测试区域',
        code: 'TEST',
        count: 10,
        rows: 2,
        cols: 5,
        order: 'row'
      });

      zoneId = zone._id;

      // 创建一些工位
      const seats = await Seat.insertMany(
        Array.from({ length: 10 }, (_, i) => ({
          floorId,
          zoneId,
          seatNo: String(i + 1).padStart(3, '0'),
          globalIdx: i + 1,
          localIdx: i + 1,
          r: Math.floor(i / 5) + 1,
          c: (i % 5) + 1,
          person: {
            name: '',
            dept: '',
            empId: '',
            phone: '',
            note: ''
          }
        }))
      );

      seatId = seats[0]._id;
    });

    it('应该获取所有工位', async () => {
      const res = await request(app)
        .get(`/api/floors/${floorId}/seats`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.seats.length).toBeGreaterThan(0);
    });

    it('应该获取单个工位', async () => {
      const res = await request(app)
        .get(`/api/floors/${floorId}/seats/${seatId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data._id.toString()).toBe(seatId.toString());
    });

    it('应该更新工位信息', async () => {
      const res = await request(app)
        .put(`/api/floors/${floorId}/seats/${seatId}`)
        .send({
          person: {
            name: '张三',
            dept: '供应链',
            empId: 'E001',
            phone: '13800138000',
            note: '测试'
          }
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.person.name).toBe('张三');
      expect(res.body.data.person.dept).toBe('供应链');
    });

    describe('⭐ 可选工位编号功能', () => {
      it('应该允许设置 seatNo 为 null', async () => {
        const res = await request(app)
          .put(`/api/floors/${floorId}/seats/${seatId}`)
          .send({ seatNo: null })
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.seatNo).toBeNull();
      });

      it('应该验证 seatNo 格式（3位数字或null）', async () => {
        const res = await request(app)
          .put(`/api/floors/${floorId}/seats/${seatId}`)
          .send({ seatNo: 'INVALID' })
          .expect(400);

        expect(res.body.success).toBe(false);
      });

      it('应该通过 PATCH 端点清空工位编号', async () => {
        // 先设置一个工位号
        await request(app)
          .put(`/api/floors/${floorId}/seats/${seatId}`)
          .send({ seatNo: '099' });

        // 清空编号
        const res = await request(app)
          .patch(`/api/floors/${floorId}/seats/${seatId}/clear-number`)
          .expect(200);

        expect(res.body.success).toBe(true);
        expect(res.body.data.seatNo).toBeNull();
        expect(res.body.message).toContain('清空');
      });

      it('应该接受有效的 seatNo 格式', async () => {
        const res = await request(app)
          .put(`/api/floors/${floorId}/seats/${seatId}`)
          .send({ seatNo: '123' })
          .expect(200);

        expect(res.body.data.seatNo).toBe('123');
      });
    });

    it('应该获取区域内的工位', async () => {
      const res = await request(app)
        .get(`/api/floors/${floorId}/seats/zone/${zoneId}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(10);
    });

    it('应该删除工位', async () => {
      const res = await request(app)
        .delete(`/api/floors/${floorId}/seats/${seatId}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // 验证已删除
      const deletedSeat = await Seat.findById(seatId);
      expect(deletedSeat).toBeNull();
    });
  });

  describe('错误处理', () => {
    it('应该返回 404 当资源不存在', async () => {
      const res = await request(app)
        .get('/api/floors/nonexistent')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('应该返回 404 当路由不存在', async () => {
      const res = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('应该验证必填字段', async () => {
      const res = await request(app)
        .post('/api/floors')
        .send({
          // 缺少 id 和 name
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
