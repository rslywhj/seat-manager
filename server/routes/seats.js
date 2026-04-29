/**
 * Seats API Routes
 * ⭐ 关键文件：支持工位编号可选化（seatNo 可以为 null）
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const Seat = require('../models/Seat');
const Zone = require('../models/Zone');
const { AppError } = require('../middleware/errorHandler');
const websocketService = require('../services/websocketService');

/**
 * GET /api/floors/:floorId/seats
 * 获取楼层的所有工位
 */
router.get('/', async (req, res, next) => {
  try {
    const { floorId } = req.params;

    // 支持分页
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip = (page - 1) * limit;

    const seats = await Seat.find({ floorId })
      .skip(skip)
      .limit(limit)
      .sort({ globalIdx: 1 });

    const total = await Seat.countDocuments({ floorId });

    res.json({
      success: true,
      data: {
        seats,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/floors/:floorId/zones/:zoneId/seats
 * 获取指定区域的工位
 */
router.get('/zone/:zoneId', async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;

    // 验证 zone 存在
    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    const seats = await Seat.find({ zoneId }).sort({ localIdx: 1 });

    res.json({
      success: true,
      data: seats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/floors/:floorId/seats/:seatId
 * 获取指定工位的详细信息
 */
router.get('/:seatId', async (req, res, next) => {
  try {
    const { floorId, seatId } = req.params;

    const seat = await Seat.findById(seatId);
    if (!seat || seat.floorId !== floorId) {
      throw new AppError('工位不存在', 404);
    }

    res.json({
      success: true,
      data: seat
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/floors/:floorId/seats/:seatId
 * 更新工位信息
 * ⭐ 支持更新工位号（包括清空：seatNo: null）
 */
router.put('/:seatId', async (req, res, next) => {
  try {
    const { floorId, seatId } = req.params;
    const {
      seatNo,  // ⭐ 可以是 null 或 "001" 格式的字符串
      person = {},
      network = {}  // ⭐ 新增：网络接口信息
    } = req.body;

    const seat = await Seat.findById(seatId);
    if (!seat || seat.floorId !== floorId) {
      throw new AppError('工位不存在', 404);
    }

    // 更新字段
    const updates = {};

    // ⭐ 更新工位号（支持清空和修改）
    if (seatNo !== undefined) {
      const newSeatNo = seatNo || null;

      // 更新 globalIdx 以匹配新编号（如果有编号）
      if (newSeatNo) {
        updates.globalIdx = parseInt(newSeatNo);
      }

      updates.seatNo = newSeatNo;
    }

    // 更新人员信息
    if (person && Object.keys(person).length > 0) {
      updates.person = {
        ...seat.person.toObject(),
        ...person
      };
    }

    // ⭐ 更新网络接口信息
    if (network && Object.keys(network).length > 0) {
      updates.network = {
        ...(seat.network ? seat.network.toObject() : {}),
        ...network
      };
    }

    const updatedSeat = await Seat.findByIdAndUpdate(
      seatId,
      updates,
      { new: true, runValidators: true }
    );

    // 发送 WebSocket 通知
    websocketService.notifySeatUpdate(updatedSeat);

    res.json({
      success: true,
      data: updatedSeat,
      message: updatedSeat.seatNo
        ? `工位 ${updatedSeat.seatNo} 已更新`
        : '工位已更新（未分配编号）'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/floors/:floorId/seats/:seatId/clear-number
 * 清空工位编号
 * ⭐ 便捷方法：一键清空工位号
 */
router.patch('/:seatId/clear-number', async (req, res, next) => {
  try {
    const { floorId, seatId } = req.params;

    const seat = await Seat.findById(seatId);
    if (!seat || seat.floorId !== floorId) {
      throw new AppError('工位不存在', 404);
    }

    seat.seatNo = null;
    await seat.save();

    // 发送 WebSocket 通知
    websocketService.notifySeatUpdate(seat);

    res.json({
      success: true,
      data: seat,
      message: '工位编号已清空'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/floors/:floorId/zones/:zoneId/seats/bulk
 * 批量创建工位（用于迁移和初始化）
 */
router.post('/zone/:zoneId/bulk', async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;
    const { seats: seatsData } = req.body;

    if (!Array.isArray(seatsData)) {
      throw new AppError('seats 必须是数组', 400);
    }

    // 验证 zone 存在
    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    // 删除旧工位
    await Seat.deleteMany({ zoneId });

    // 创建新工位
    const seats = await Seat.insertMany(
      seatsData.map(s => ({
        floorId,
        zoneId,
        ...s
      }))
    );

    res.status(201).json({
      success: true,
      data: seats,
      message: `批量创建了 ${seats.length} 个工位`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/floors/:floorId/seats/:seatId
 * 删除指定工位
 */
router.delete('/:seatId', async (req, res, next) => {
  try {
    const { floorId, seatId } = req.params;

    const seat = await Seat.findById(seatId);
    if (!seat || seat.floorId !== floorId) {
      throw new AppError('工位不存在', 404);
    }

    const seatNo = seat.seatNo || '(未编号)';
    await Seat.findByIdAndDelete(seatId);

    res.json({
      success: true,
      message: `工位 ${seatNo} 已删除`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
