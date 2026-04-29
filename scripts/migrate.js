/**
 * 数据迁移脚本
 * 从 localStorage JSON 导出文件迁移到 MongoDB
 *
 * 使用方法：
 *   node scripts/migrate.js <json-file-path>
 *
 * 示例：
 *   node scripts/migrate.js ./floor-data.json
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const Floor = require('../server/models/Floor');
const Zone = require('../server/models/Zone');
const Seat = require('../server/models/Seat');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/floor-db';

/**
 * 主迁移函数
 */
async function migrate(jsonFilePath) {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   工位管理系统数据迁移工具                    ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  try {
    // 1. 连接数据库
    console.log('⏳ 正在连接 MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✓ MongoDB 连接成功\n');

    // 2. 读取 JSON 文件
    console.log(`⏳ 正在读取文件: ${jsonFilePath}`);
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`文件不存在: ${jsonFilePath}`);
    }

    const raw = fs.readFileSync(jsonFilePath, 'utf-8');
    const data = JSON.parse(raw);
    console.log('✓ JSON 文件读取成功\n');

    // 验证数据格式
    if (!data.floor || !data.zones || !data.seats) {
      throw new Error('数据格式错误：必须包含 floor, zones, seats');
    }

    console.log('📊 数据统计:');
    console.log(`   楼层: ${data.floor.name}`);
    console.log(`   区域数量: ${data.zones.length}`);
    console.log(`   工位数量: ${Object.keys(data.seats).length}\n`);

    // 3. 创建 Floor
    console.log('⏳ 正在创建楼层...');
    const existingFloor = await Floor.findOne({ id: data.floor.id });
    if (existingFloor) {
      console.log(`⚠  楼层 "${data.floor.id}" 已存在，将被覆盖`);
      await Floor.deleteOne({ id: data.floor.id });
      await Zone.deleteMany({ floorId: data.floor.id });
      await Seat.deleteMany({ floorId: data.floor.id });
    }

    const floor = await Floor.create({
      id: data.floor.id,
      name: data.floor.name,
      canvasWidth: data.floor.canvasWidth || 1200,
      canvasHeight: data.floor.canvasHeight || 800
    });
    console.log(`✓ 楼层创建成功: ${floor.name}\n`);

    // 4. 创建 Zones 并记录 ID 映射
    console.log('⏳ 正在创建区域...');
    const zoneMap = {}; // old ID -> new ObjectId

    for (const oldZone of data.zones) {
      const newZone = await Zone.create({
        floorId: floor.id,
        name: oldZone.name,
        code: oldZone.code || oldZone.name.substring(0, 3).toUpperCase(),
        x: oldZone.x || 0,
        y: oldZone.y || 0,
        width: oldZone.width || 300,
        height: oldZone.height || 400,
        count: oldZone.count || 100,
        rows: oldZone.rows || 10,
        cols: oldZone.cols || 10,
        order: oldZone.order || 'row',
        color: oldZone.color || '#6366f1'
      });

      zoneMap[oldZone.id] = newZone._id;
      console.log(`   ✓ ${newZone.name} (${oldZone.id} -> ${newZone._id})`);
    }
    console.log(`✓ ${data.zones.length} 个区域创建成功\n`);

    // 5. 创建 Seats
    console.log('⏳ 正在迁移工位...');
    let seatCount = 0;
    let nullSeatNoCount = 0;

    const seatsToInsert = [];

    for (const [oldSeatId, oldSeat] of Object.entries(data.seats)) {
      // 获取对应的新 zoneId
      const newZoneId = zoneMap[oldSeat.zoneId];

      if (!newZoneId) {
        console.warn(`   ⚠  工位 ${oldSeatId} 引用了未知区域 ${oldSeat.zoneId}，已跳过`);
        continue;
      }

      // ⭐ 关键：保留 seatNo 为 null 的工位
      const seatNo = oldSeat.seatNo || null;
      if (seatNo === null) {
        nullSeatNoCount++;
      }

      seatsToInsert.push({
        floorId: floor.id,
        zoneId: newZoneId,
        seatNo: seatNo,
        globalIdx: oldSeat.globalIdx || 0,
        localIdx: oldSeat.localIdx || 0,
        r: oldSeat.r || 0,
        c: oldSeat.c || 0,
        person: {
          name: oldSeat.person?.name || '',
          dept: oldSeat.person?.dept || '',
          empId: oldSeat.person?.empId || '',
          phone: oldSeat.person?.phone || '',
          note: oldSeat.person?.note || ''
        }
      });

      seatCount++;

      // 每 100 条显示进度
      if (seatCount % 100 === 0) {
        process.stdout.write(`\r   进度: ${seatCount} / ${Object.keys(data.seats).length}`);
      }
    }

    // 批量插入工位
    await Seat.insertMany(seatsToInsert);

    console.log(`\n✓ ${seatCount} 个工位迁移成功`);
    if (nullSeatNoCount > 0) {
      console.log(`   ⭐ 其中 ${nullSeatNoCount} 个工位没有编号（seatNo = null）`);
    }

    // 6. 数据验证
    console.log('\n⏳ 正在验证数据...');
    const zoneCount = await Zone.countDocuments({ floorId: floor.id });
    const totalSeats = await Seat.countDocuments({ floorId: floor.id });

    console.log(`   ✓ 区域数量: ${zoneCount}`);
    console.log(`   ✓ 工位数量: ${totalSeats}`);

    // 7. 完成
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║   ✅ 迁移成功完成！                          ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    console.log('下一步：');
    console.log('  1. 启动后端服务: npm run dev');
    console.log('  2. 在浏览器中打开 index.html');
    console.log('  3. 验证数据是否正确加载\n');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ MongoDB 连接已关闭');
  }
}

// ==================== 命令行入口 ====================

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('错误: 请提供 JSON 文件路径');
  console.log('\n用法:');
  console.log('  node scripts/migrate.js <json-file-path>');
  console.log('\n示例:');
  console.log('  node scripts/migrate.js ./floor-data.json');
  process.exit(1);
}

const jsonFilePath = path.resolve(args[0]);

// 运行迁移
migrate(jsonFilePath);
