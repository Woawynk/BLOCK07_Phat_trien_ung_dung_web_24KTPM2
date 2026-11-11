const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /dishes - Danh sách thực đơn món ăn cho người dùng, hỗ trợ tìm kiếm bằng query 'q'
router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const whereClause = q
      ? {
          name: {
            contains: q,
            mode: 'insensitive' // Tìm kiếm không phân biệt hoa thường (PostgreSQL)
          }
        }
      : {};

    const dishes = await prisma.dish.findMany({
      where: whereClause,
      include: {
        chef: true,
        ingredients: true
      },
      orderBy: { id: 'asc' }
    });

    res.render('dishes/index', {
      title: 'Thực Đơn Món Ăn Việt Nam',
      dishes,
      q
    });
  } catch (err) {
    next(err);
  }
});

// GET /dishes/:id - Chi tiết một món ăn theo ID (Path param)
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    // Kiểm tra tính hợp lệ của id
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ hoặc không đúng định dạng.'
      });
    }

    const dish = await prisma.dish.findUnique({
      where: { id },
      include: {
        chef: true,
        ingredients: true
      }
    });

    // Nếu không tìm thấy món ăn trong database -> trả về 404
    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: `Món ăn mang mã số #${id} không tồn tại trong thực đơn.`
      });
    }

    res.render('dishes/show', {
      title: `${dish.name} - Chi Tiết Món Ăn`,
      dish
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
