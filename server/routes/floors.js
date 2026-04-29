/**
 * Floors API Routes
 */

const express = require('express');
const router = express.Router();
const Floor = require('../models/Floor');
const Zone = require('../models/Zone');
const Seat = require('../models/Seat');
const { AppError } = require('../middleware/errorHandler');

/**
 * GET /api/floors/:floorId
 * 获取楼层及所有区域/工位数据（完整数据包）
 */
router.get('/:floorId', async (req, res, next) => {
  try {
    const { floorId } = req.params;

    // 获取楼层信息
    const floor = await Floor.findOne({ id: floorId });
    if (!floor) {
      throw new AppError(`楼层 "${floorId}" 不存在`, 404);
    }

    // 获取所有区域（按创建时间排序，保持用户创建的顺序）
    const zones = await Zone.find({ floorId }).sort({ createdAt: 1 });

    // 获取所有工位
    const seats = await Seat.find({ floorId });

    // 按区域分组工位
    const seatsByZone = {};
    for (const zone of zones) {
      seatsByZone[zone._id.toString()] = seats.filter(
        s => s.zoneId.toString() === zone._id.toString()
      );
    }

    res.json({
      success: true,
      data: {
        floor: {
          id: floor.id,
          name: floor.name,
          canvasWidth: floor.canvasWidth,
          canvasHeight: floor.canvasHeight
        },
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
          image: z.image // 区域图片
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
          network: s.network // 网络接口信息
        })),
        seatsByZone
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/floors
 * 创建新楼层
 */
router.post('/', async (req, res, next) => {
  try {
    const { id, name, canvasWidth = 1200, canvasHeight = 800 } = req.body;

    if (!id || !name) {
      throw new AppError('楼层 ID 和名称不能为空', 400);
    }

    const floor = new Floor({
      id,
      name,
      canvasWidth,
      canvasHeight
    });

    await floor.save();

    res.status(201).json({
      success: true,
      data: floor
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/floors/:floorId
 * 更新楼层信息
 */
router.put('/:floorId', async (req, res, next) => {
  try {
    const { floorId } = req.params;
    const { name, canvasWidth, canvasHeight } = req.body;

    const floor = await Floor.findOneAndUpdate(
      { id: floorId },
      { name, canvasWidth, canvasHeight },
      { new: true, runValidators: true }
    );

    if (!floor) {
      throw new AppError(`楼层 "${floorId}" 不存在`, 404);
    }

    res.json({
      success: true,
      data: floor
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/floors/:floorId
 * 删除楼层（级联删除区域和工位）
 */
router.delete('/:floorId', async (req, res, next) => {
  try {
    const { floorId } = req.params;

    const floor = await Floor.findOne({ id: floorId });
    if (!floor) {
      throw new AppError(`楼层 "${floorId}" 不存在`, 404);
    }

    // 级联删除所有工位
    await Seat.deleteMany({ floorId });

    // 级联删除所有区域
    await Zone.deleteMany({ floorId });

    // 删除楼层
    await Floor.deleteOne({ id: floorId });

    res.json({
      success: true,
      message: `楼层 "${floorId}" 已删除`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
