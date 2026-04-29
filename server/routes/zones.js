/**
 * Zones API Routes
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Zone = require('../models/Zone');
const Seat = require('../models/Seat');
const { buildSeatsForZone } = require('../utils/seatBuilder');
const { AppError } = require('../middleware/errorHandler');
const websocketService = require('../services/websocketService');

// 配置multer用于图片上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/zones');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'zone-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只支持图片格式 (jpeg, jpg, png, gif, webp)'));
    }
  }
});

/**
 * GET /api/floors/:floorId/zones
 * 获取楼层的所有区域
 */
router.get('/', async (req, res, next) => {
  try {
    const { floorId } = req.params;

    const zones = await Zone.find({ floorId }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: zones
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/floors/:floorId/zones/:zoneId
 * 获取指定区域的详细信息
 */
router.get('/:zoneId', async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;

    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    const seats = await Seat.find({ zoneId });

    res.json({
      success: true,
      data: {
        zone,
        seats
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/floors/:floorId/zones
 * 创建新区域（自动生成工位）
 */
router.post('/', async (req, res, next) => {
  try {
    const { floorId } = req.params;
    const {
      name,
      code,
      type, // 区域类型
      x,
      y,
      width,
      height,
      count,
      rows,
      cols,
      order,
      color
    } = req.body;

    console.log('[Zone Create] 接收到的数据:', { name, code, type, count, rows, cols });

    if (!name || !code) {
      throw new AppError('区域名称和代码不能为空', 400);
    }

    // 创建区域
    const zone = new Zone({
      floorId,
      name,
      code: code.toUpperCase(),
      type: type || 'seat', // 使用传入的type，默认为seat
      x: x || 0,
      y: y || 0,
      width: width || 300,
      height: height || 400,
      count, // 不设默认值，保留null
      rows,  // 不设默认值，保留null
      cols,  // 不设默认值，保留null
      order: order || 'row',
      color: color || '#6366f1'
    });

    await zone.save();

    // 发送 WebSocket 通知（区域创建）
    websocketService.notifyZoneUpdate(zone);

    // ⭐ 只有座位区域才生成工位
    if (zone.type === 'seat') {
      // ⭐ 智能编号分配：重新利用已清除的编号
    // 1. 获取所有已占用的编号（seatNo 不为 null 的工位）
    const occupiedSeats = await Seat.find({
      floorId,
      seatNo: { $ne: null }
    }).select('seatNo globalIdx').sort({ globalIdx: 1 });

    // 2. 提取已占用的编号列表（转为数字）
    const occupiedNumbers = new Set(
      occupiedSeats.map(s => parseInt(s.seatNo))
    );

    // 3. 找出需要分配的编号（填补空洞 + 必要时扩展）
    const neededCount = count;
    const assignedNumbers = [];
    let currentNumber = 1;

    while (assignedNumbers.length < neededCount) {
      if (!occupiedNumbers.has(currentNumber)) {
        // 该编号空闲，可以使用
        assignedNumbers.push(currentNumber);
      }
      currentNumber++;
    }

    console.log(`[Zone Create] 楼层 ${floorId} 分配编号: ${assignedNumbers[0]}-${assignedNumbers[assignedNumbers.length - 1]}`);
    console.log(`[Zone Create] 重用的编号: ${assignedNumbers.filter(n => n <= Math.max(...occupiedNumbers, 0)).join(', ') || '无'}`);

    // 4. 生成工位数据，使用分配的编号
    const seatsData = buildSeatsForZone(
      {
        count,
        rows,
        cols,
        order
      },
      1  // startIdx 参数，这里传 1，但实际编号由下面覆盖
    );

    // 5. 覆盖 seatNo 和 globalIdx，使用分配的编号
    seatsData.forEach((seat, idx) => {
      const assignedNumber = assignedNumbers[idx];
      seat.seatNo = String(assignedNumber).padStart(3, '0');
      seat.globalIdx = assignedNumber;
    });

    const seats = await Seat.insertMany(
      seatsData.map(seat => ({
        floorId,
        zoneId: zone._id,
        ...seat
      }))
    );

    // 发送 WebSocket 通知（工位创建）
    seats.forEach(seat => {
      websocketService.notifySeatUpdate(seat);
    });

    res.status(201).json({
      success: true,
      data: {
        zone,
        seats,
        message: `区域已创建，自动生成 ${seats.length} 个工位`
      }
    });
    } else {
      // 功能区域，不生成工位
      res.status(201).json({
        success: true,
        data: {
          zone,
          seats: [],
          message: `功能区域已创建`
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/floors/:floorId/zones/:zoneId
 * 更新区域信息（可能需要重建工位）
 */
router.put('/:zoneId', async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;
    const {
      name,
      code,
      type, // 区域类型
      x,
      y,
      width,
      height,
      count,
      rows,
      cols,
      order,
      color,
      image, // 图片URL
      rebuildSeats = false, // 是否重建工位
      startNumber // 起始编号（重建工位时使用）
    } = req.body;

    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    // 检测配置是否改变
    const configChanged = count !== zone.count ||
                         rows !== zone.rows ||
                         cols !== zone.cols ||
                         order !== zone.order;

    // 更新区域
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code.toUpperCase();
    if (type !== undefined) updates.type = type; // 支持区域类型更新
    if (x !== undefined) updates.x = x;
    if (y !== undefined) updates.y = y;
    if (width !== undefined) updates.width = width;
    if (height !== undefined) updates.height = height;
    if (count !== undefined) updates.count = count;
    if (rows !== undefined) updates.rows = rows;
    if (cols !== undefined) updates.cols = cols;
    if (order !== undefined) updates.order = order;
    if (color !== undefined) updates.color = color;
    if (image !== undefined) updates.image = image; // 支持图片URL更新

    const updatedZone = await Zone.findByIdAndUpdate(zoneId, updates, {
      new: true,
      runValidators: true
    });

    // 发送 WebSocket 通知
    websocketService.notifyZoneUpdate(updatedZone);

    let message = '区域已更新';

    // 如果配置改变且启用重建，删除旧工位并创建新工位（仅对座位区域）
    if (configChanged && rebuildSeats && updatedZone.type === 'seat') {
      // 删除旧工位前，先获取工位ID列表用于发送删除通知
      const oldSeats = await Seat.find({ zoneId });
      const oldSeatIds = oldSeats.map(s => s._id);

      // 删除旧工位
      await Seat.deleteMany({ zoneId });

      // 发送 WebSocket 通知（工位删除）
      oldSeatIds.forEach(seatId => {
        websocketService.notifySeatDelete(seatId, floorId);
      });

      // ⭐ 编号分配策略
      const neededCount = updates.count || zone.count;
      let assignedNumbers = [];

      if (startNumber !== undefined && startNumber > 0) {
        // 用户指定了起始编号，从该编号开始连续分配
        console.log(`[Zone Update] 使用用户指定的起始编号: ${startNumber}`);
        for (let i = 0; i < neededCount; i++) {
          assignedNumbers.push(startNumber + i);
        }
      } else {
        // 未指定起始编号，智能填补空洞
        console.log('[Zone Update] 使用智能编号分配（填补空洞）');
        const occupiedSeats = await Seat.find({
          floorId,
          seatNo: { $ne: null }
        }).select('seatNo globalIdx').sort({ globalIdx: 1 });

        const occupiedNumbers = new Set(
          occupiedSeats.map(s => parseInt(s.seatNo))
        );

        let currentNumber = 1;
        while (assignedNumbers.length < neededCount) {
          if (!occupiedNumbers.has(currentNumber)) {
            assignedNumbers.push(currentNumber);
          }
          currentNumber++;
        }
      }

      // 生成新工位，使用新的排序方式
      const seatsData = buildSeatsForZone(
        {
          count: updates.count || zone.count,
          rows: updates.rows || zone.rows,
          cols: updates.cols || zone.cols,
          order: updates.order || zone.order
        },
        1  // startIdx 参数，但实际编号由下面覆盖
      );

      // 覆盖 seatNo 和 globalIdx，使用分配的编号
      seatsData.forEach((seat, idx) => {
        const assignedNumber = assignedNumbers[idx];
        seat.seatNo = String(assignedNumber).padStart(3, '0');
        seat.globalIdx = assignedNumber;
      });

      const newSeats = await Seat.insertMany(
        seatsData.map(seat => ({
          floorId,
          zoneId,
          ...seat
        }))
      );

      // 发送 WebSocket 通知（工位重建）
      newSeats.forEach(seat => {
        websocketService.notifySeatUpdate(seat);
      });

      console.log(`[Zone Update] 区域 ${zoneId} 重建工位，分配编号: ${assignedNumbers[0]}-${assignedNumbers[assignedNumbers.length - 1]}`);
      message = `区域已更新，重建了 ${seatsData.length} 个工位（应用了新的排序方式）`;
    }

    res.json({
      success: true,
      data: {
        zone: updatedZone,
        message
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/floors/:floorId/zones/:zoneId
 * 删除区域（级联删除工位）
 */
router.delete('/:zoneId', async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;

    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    // 级联删除所有工位前，先获取工位ID列表
    const oldSeats = await Seat.find({ zoneId });
    const oldSeatIds = oldSeats.map(s => s._id);

    // 级联删除所有工位
    const deletedSeats = await Seat.deleteMany({ zoneId });

    // 发送 WebSocket 通知（工位删除）
    oldSeatIds.forEach(seatId => {
      websocketService.notifySeatDelete(seatId, floorId);
    });

    // 删除区域
    await Zone.findByIdAndDelete(zoneId);

    // 发送 WebSocket 通知（区域删除）
    websocketService.notifyZoneDelete(zoneId, floorId);

    res.json({
      success: true,
      message: `区域 "${zone.name}" 已删除，同时删除了 ${deletedSeats.deletedCount} 个工位`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/floors/:floorId/zones/:zoneId/upload-image
 * 上传区域图片
 */
router.post('/:zoneId/upload-image', upload.single('image'), async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;

    if (!req.file) {
      throw new AppError('未提供图片文件', 400);
    }

    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    // 删除旧图片（如果存在）
    if (zone.image && zone.image.startsWith('/uploads/')) {
      const oldImagePath = path.join(__dirname, '../..', zone.image);
      try {
        await fs.unlink(oldImagePath);
      } catch (error) {
        console.warn('删除旧图片失败:', error.message);
      }
    }

    // 更新图片URL
    const imageUrl = `/uploads/zones/${req.file.filename}`;
    zone.image = imageUrl;
    await zone.save();

    // 发送 WebSocket 通知
    websocketService.notifyZoneUpdate(zone);

    res.json({
      success: true,
      data: {
        zone,
        imageUrl
      },
      message: '图片上传成功'
    });
  } catch (error) {
    // 如果出错，删除已上传的文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('删除临时文件失败:', unlinkError);
      }
    }
    next(error);
  }
});

/**
 * DELETE /api/floors/:floorId/zones/:zoneId/image
 * 删除区域图片
 */
router.delete('/:zoneId/image', async (req, res, next) => {
  try {
    const { floorId, zoneId } = req.params;

    const zone = await Zone.findById(zoneId);
    if (!zone || zone.floorId !== floorId) {
      throw new AppError('区域不存在', 404);
    }

    // 删除图片文件
    if (zone.image && zone.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '../..', zone.image);
      try {
        await fs.unlink(imagePath);
      } catch (error) {
        console.warn('删除图片文件失败:', error.message);
      }
    }

    // 清除数据库中的图片引用
    zone.image = null;
    await zone.save();

    // 发送 WebSocket 通知
    websocketService.notifyZoneUpdate(zone);

    res.json({
      success: true,
      data: zone,
      message: '图片已删除'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
