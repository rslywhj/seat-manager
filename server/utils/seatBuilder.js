/**
 * Seat Builder Utility
 *
 * 复制前端座位编号算法到 Node.js
 * 确保前后端座位编号算法完全一致
 */

/**
 * 补零到 3 位数
 * @param {number} n - 数字
 * @returns {string} 补零后的字符串
 */
function pad3(n) {
  return String(n).padStart(3, '0');
}

/**
 * 为指定区域生成座位列表
 * @param {Object} zone - 区域配置对象
 * @param {number} startIdx - 全局索引起始值（默认为 1）
 * @returns {Array} 座位数组
 */
function buildSeatsForZone(zone, startIdx = 1) {
  const seats = [];
  const total = Math.max(1, Number(zone.count) || 1);
  const rows = Math.max(1, Number(zone.rows) || 1);
  const cols = Math.max(1, Number(zone.cols) || 1);

  // 根据排序方式生成 [row, col] 位置对
  const positions = [];

  const orderType = (zone.order || 'row').replace(/-desc$/, '');
  const isDescending = (zone.order || '').endsWith('-desc');

  if (orderType === 'row') {
    // 从左到右，从上到下
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        positions.push([r, c]);
      }
    }
  } else if (orderType === 'row-reverse') {
    // 从右到左，从上到下
    for (let r = 1; r <= rows; r++) {
      for (let c = cols; c >= 1; c--) {
        positions.push([r, c]);
      }
    }
  } else if (orderType === 'snake') {
    // 蛇形：奇数行从左到右，偶数行从右到左
    for (let r = 1; r <= rows; r++) {
      if (r % 2 === 1) {
        // 奇数行：从左到右
        for (let c = 1; c <= cols; c++) {
          positions.push([r, c]);
        }
      } else {
        // 偶数行：从右到左
        for (let c = cols; c >= 1; c--) {
          positions.push([r, c]);
        }
      }
    }
  } else if (orderType === 'snake-reverse') {
    // 蛇形倒排：奇数行从右到左，偶数行从左到右
    for (let r = 1; r <= rows; r++) {
      if (r % 2 === 1) {
        // 奇数行：从右到左
        for (let c = cols; c >= 1; c--) {
          positions.push([r, c]);
        }
      } else {
        // 偶数行：从左到右
        for (let c = 1; c <= cols; c++) {
          positions.push([r, c]);
        }
      }
    }
  } else if (orderType === 'col') {
    // 从上到下，从左到右（按列）
    for (let c = 1; c <= cols; c++) {
      for (let r = 1; r <= rows; r++) {
        positions.push([r, c]);
      }
    }
  } else if (orderType === 'col-reverse') {
    // 从下到上，从左到右（按列倒排）
    for (let c = 1; c <= cols; c++) {
      for (let r = rows; r >= 1; r--) {
        positions.push([r, c]);
      }
    }
  } else if (orderType === 'col-snake') {
    // 列蛇形：奇数列从上到下，偶数列从下到上
    for (let c = 1; c <= cols; c++) {
      if (c % 2 === 1) {
        // 奇数列：从上到下
        for (let r = 1; r <= rows; r++) {
          positions.push([r, c]);
        }
      } else {
        // 偶数列：从下到上
        for (let r = rows; r >= 1; r--) {
          positions.push([r, c]);
        }
      }
    }
  }

  // 如果设置为递减，反转位置列表
  if (isDescending) {
    positions.reverse();
  }

  // 根据位置分配座位编号
  let localIdx = 1;
  let globalIdx = startIdx;

  for (const [r, c] of positions) {
    if (localIdx > total) break;

    const seatNo = pad3(globalIdx);

    seats.push({
      seatNo,
      globalIdx,
      localIdx,
      r,
      c,
      person: {
        name: '',
        dept: '',
        empId: '',
        phone: '',
        note: ''
      }
    });

    localIdx++;
    globalIdx++;
  }

  return seats;
}

/**
 * 构建所有区域的座位（使用全局编号）
 * @param {Array} zones - 区域数组
 * @returns {Array} 全部座位数组
 */
function buildAllSeats(zones) {
  const allSeats = [];
  let globalIdx = 1;

  for (const zone of zones) {
    const seatsInZone = buildSeatsForZone(zone, globalIdx);
    allSeats.push(...seatsInZone);
    globalIdx += zone.count;
  }

  return allSeats;
}

module.exports = {
  pad3,
  buildSeatsForZone,
  buildAllSeats
};
