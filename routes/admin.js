const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { requireManager } = require('../middleware/auth');

// Bảo vệ toàn bộ khu vực Quản trị: Chỉ DUY NHẤT 1 email Manager được cấp quyền truy cập
router.use(requireManager);

// Helper kiểm tra ID hợp lệ
function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /admin - Trang chủ quản trị, tự động chuyển về /admin/dishes
router.get('/', (req, res) => {
  res.redirect('/admin/dishes');
});

// ============================================================================
// 1. QUẢN LÝ MÓN ĂN (DISHES)
// ============================================================================

// GET /admin/dishes - Danh sách món ăn
router.get('/dishes', async (req, res, next) => {
  try {
    const dishes = await prisma.dish.findMany({
      orderBy: { id: 'asc' }
    });
    res.render('admin/dishes/index', {
      title: 'Quản Lý Món Ăn',
      dishes
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/dishes/new - Form thêm món mới
router.get('/dishes/new', async (req, res, next) => {
  try {
    const chefs = await prisma.chef.findMany({ orderBy: { id: 'asc' } });
    const ingredients = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });

    res.render('admin/dishes/new', {
      title: 'Thêm Món Ăn Mới',
      errors: [],
      chefs,
      ingredients,
      formData: {
        name: '',
        description: '',
        price: '',
        category: '',
        imageUrl: '',
        chefId: '',
        ingredientIds: [],
        available: true
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /admin/dishes - Xử lý thêm món mới (PRG pattern -> 303)
router.post('/dishes', async (req, res, next) => {
  try {
    const { name, description, price, category, imageUrl, chefId, ingredientIds, available } = req.body;
    const errors = [];

    // Validation
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      errors.push('Tên món ăn không được để trống.');
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      errors.push('Giá món ăn phải là một số lớn hơn hoặc bằng 0.');
    }

    const parsedChefId = chefId ? Number(chefId) : null;
    const rawIngIds = Array.isArray(ingredientIds) ? ingredientIds : (ingredientIds ? [ingredientIds] : []);
    const selectedIngIds = rawIngIds.map(Number).filter(n => Number.isInteger(n) && n > 0);

    // Nếu có lỗi nhập liệu: Trả về status 400 và render lại form cùng dữ liệu đã nhập
    if (errors.length > 0) {
      const chefs = await prisma.chef.findMany({ orderBy: { id: 'asc' } });
      const ingredients = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });

      return res.status(400).render('admin/dishes/new', {
        title: 'Thêm Món Ăn Mới',
        errors,
        chefs,
        ingredients,
        formData: {
          name: trimmedName,
          description: (description || '').trim(),
          price: price,
          category: (category || '').trim(),
          imageUrl: (imageUrl || '').trim(),
          chefId: parsedChefId,
          ingredientIds: selectedIngIds,
          available: available === 'on' || available === true || available === 'true'
        }
      });
    }

    // Ghi vào database với dữ liệu đã chuẩn hóa (chống mass-assignment)
    const newDish = await prisma.dish.create({
      data: {
        name: trimmedName,
        description: (description || '').trim() || null,
        price: Math.round(numPrice),
        category: (category || '').trim() || null,
        imageUrl: (imageUrl || '').trim() || null,
        available: available === 'on' || available === true || available === 'true',
        ...(parsedChefId ? { chef: { connect: { id: parsedChefId } } } : {}),
        ...(selectedIngIds.length > 0 ? { ingredients: { connect: selectedIngIds.map(id => ({ id })) } } : {})
      }
    });

    // PRG: Chuyển hướng 303 sang trang chi tiết hoặc danh sách quản trị
    res.redirect(303, `/dishes/${newDish.id}`);
  } catch (err) {
    next(err);
  }
});

// GET /admin/dishes/:id/edit - Form sửa món ăn
router.get('/dishes/:id/edit', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const dish = await prisma.dish.findUnique({
      where: { id },
      include: { ingredients: true }
    });
    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: `Không tìm thấy món ăn mang mã số #${id}.`
      });
    }

    const chefs = await prisma.chef.findMany({ orderBy: { id: 'asc' } });
    const ingredients = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });

    res.render('admin/dishes/edit', {
      title: `Chỉnh Sửa Món: ${dish.name}`,
      dish,
      chefs,
      ingredients,
      errors: [],
      formData: {
        ...dish,
        ingredientIds: dish.ingredients ? dish.ingredients.map(i => i.id) : []
      }
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/dishes/:id - Xử lý cập nhật món ăn qua method-override (PRG -> 303)
router.patch('/dishes/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const existingDish = await prisma.dish.findUnique({
      where: { id },
      include: { ingredients: true }
    });
    if (!existingDish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: `Món ăn #${id} không tồn tại để cập nhật.`
      });
    }

    const { name, description, price, category, imageUrl, chefId, ingredientIds, available } = req.body;
    const errors = [];

    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      errors.push('Tên món ăn không được để trống.');
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      errors.push('Giá món ăn phải là một số lớn hơn hoặc bằng 0.');
    }

    const parsedChefId = chefId ? Number(chefId) : null;
    const rawIngIds = Array.isArray(ingredientIds) ? ingredientIds : (ingredientIds ? [ingredientIds] : []);
    const selectedIngIds = rawIngIds.map(Number).filter(n => Number.isInteger(n) && n > 0);

    if (errors.length > 0) {
      const chefs = await prisma.chef.findMany({ orderBy: { id: 'asc' } });
      const ingredients = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });

      return res.status(400).render('admin/dishes/edit', {
        title: `Chỉnh Sửa Món: ${existingDish.name}`,
        dish: existingDish,
        chefs,
        ingredients,
        errors,
        formData: {
          id,
          name: trimmedName,
          description: (description || '').trim(),
          price: price,
          category: (category || '').trim(),
          imageUrl: (imageUrl || '').trim(),
          chefId: parsedChefId,
          ingredientIds: selectedIngIds,
          available: available === 'on' || available === true || available === 'true'
        }
      });
    }

    await prisma.dish.update({
      where: { id },
      data: {
        name: trimmedName,
        description: (description || '').trim() || null,
        price: Math.round(numPrice),
        category: (category || '').trim() || null,
        imageUrl: (imageUrl || '').trim() || null,
        available: available === 'on' || available === true || available === 'true',
        chef: parsedChefId ? { connect: { id: parsedChefId } } : { disconnect: true },
        ingredients: {
          set: selectedIngIds.map(ingId => ({ id: ingId }))
        }
      }
    });

    res.redirect(303, `/dishes/${id}`);
  } catch (err) {
    next(err);
  }
});

// GET /admin/dishes/:id/delete - Trang xác nhận xóa món ăn
router.get('/dishes/:id/delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: `Món ăn #${id} không tồn tại để xóa.`
      });
    }

    res.render('admin/dishes/delete', {
      title: `Xác Nhận Xóa Món: ${dish.name}`,
      dish
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/dishes/:id - Xử lý xóa món ăn qua method-override (PRG -> 303)
router.delete('/dishes/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: 'Mã món ăn không hợp lệ.'
      });
    }

    const dish = await prisma.dish.findUnique({ where: { id } });
    if (!dish) {
      return res.status(404).render('404', {
        title: '404 - Không tìm thấy',
        message: `Món ăn #${id} không tồn tại để xóa.`
      });
    }

    await prisma.dish.delete({ where: { id } });

    res.redirect(303, '/admin/dishes');
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. QUẢN LÝ ĐẦU BẾP (CHEFS)
// ============================================================================

// GET /admin/chefs - Danh sách đầu bếp
router.get('/chefs', async (req, res, next) => {
  try {
    const chefs = await prisma.chef.findMany({
      orderBy: { id: 'asc' }
    });
    res.render('admin/chefs/index', {
      title: 'Quản Lý Đầu Bếp',
      chefs
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/chefs/new - Form thêm đầu bếp
router.get('/chefs/new', (req, res) => {
  res.render('admin/chefs/new', {
    title: 'Thêm Đầu Bếp Mới',
    errors: [],
    formData: { name: '', specialty: '' }
  });
});

// POST /admin/chefs - Thêm đầu bếp mới
router.post('/chefs', async (req, res, next) => {
  try {
    const { name, specialty } = req.body;
    const errors = [];

    const trimmedName = (name || '').trim();
    const trimmedSpecialty = (specialty || '').trim();

    if (!trimmedName) errors.push('Tên đầu bếp không được để trống.');
    if (!trimmedSpecialty) errors.push('Sở trường / Chuyên môn không được để trống.');

    if (errors.length > 0) {
      return res.status(400).render('admin/chefs/new', {
        title: 'Thêm Đầu Bếp Mới',
        errors,
        formData: { name: trimmedName, specialty: trimmedSpecialty }
      });
    }

    await prisma.chef.create({
      data: {
        name: trimmedName,
        specialty: trimmedSpecialty
      }
    });

    res.redirect(303, '/admin/chefs');
  } catch (err) {
    next(err);
  }
});

// GET /admin/chefs/:id/edit - Form sửa đầu bếp
router.get('/chefs/:id/edit', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã đầu bếp không hợp lệ.' });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render('404', { title: '404', message: `Không tìm thấy đầu bếp #${id}.` });
    }

    res.render('admin/chefs/edit', {
      title: `Chỉnh Sửa Đầu Bếp: ${chef.name}`,
      chef,
      errors: [],
      formData: chef
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/chefs/:id - Cập nhật đầu bếp
router.patch('/chefs/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã đầu bếp không hợp lệ.' });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render('404', { title: '404', message: `Đầu bếp #${id} không tồn tại.` });
    }

    const { name, specialty } = req.body;
    const errors = [];
    const trimmedName = (name || '').trim();
    const trimmedSpecialty = (specialty || '').trim();

    if (!trimmedName) errors.push('Tên đầu bếp không được để trống.');
    if (!trimmedSpecialty) errors.push('Sở trường / Chuyên môn không được để trống.');

    if (errors.length > 0) {
      return res.status(400).render('admin/chefs/edit', {
        title: `Chỉnh Sửa Đầu Bếp: ${chef.name}`,
        chef,
        errors,
        formData: { id, name: trimmedName, specialty: trimmedSpecialty }
      });
    }

    await prisma.chef.update({
      where: { id },
      data: { name: trimmedName, specialty: trimmedSpecialty }
    });

    res.redirect(303, '/admin/chefs');
  } catch (err) {
    next(err);
  }
});

// GET /admin/chefs/:id/delete - Xác nhận xóa đầu bếp
router.get('/chefs/:id/delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã đầu bếp không hợp lệ.' });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render('404', { title: '404', message: `Không tìm thấy đầu bếp #${id} để xóa.` });
    }

    res.render('admin/chefs/delete', {
      title: `Xác Nhận Xóa Đầu Bếp: ${chef.name}`,
      chef
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/chefs/:id - Xóa đầu bếp
router.delete('/chefs/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã đầu bếp không hợp lệ.' });
    }

    const chef = await prisma.chef.findUnique({ where: { id } });
    if (!chef) {
      return res.status(404).render('404', { title: '404', message: `Đầu bếp #${id} không tồn tại để xóa.` });
    }

    await prisma.chef.delete({ where: { id } });
    res.redirect(303, '/admin/chefs');
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. QUẢN LÝ NGUYÊN LIỆU (INGREDIENTS)
// ============================================================================

// GET /admin/ingredients - Danh sách nguyên liệu
router.get('/ingredients', async (req, res, next) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { id: 'asc' }
    });
    res.render('admin/ingredients/index', {
      title: 'Quản Lý Nguyên Liệu',
      ingredients
    });
  } catch (err) {
    next(err);
  }
});

// GET /admin/ingredients/new - Form thêm nguyên liệu
router.get('/ingredients/new', (req, res) => {
  res.render('admin/ingredients/new', {
    title: 'Thêm Nguyên Liệu Mới',
    errors: [],
    formData: { name: '', unit: '' }
  });
});

// POST /admin/ingredients - Thêm nguyên liệu mới
router.post('/ingredients', async (req, res, next) => {
  try {
    const { name, unit } = req.body;
    const errors = [];

    const trimmedName = (name || '').trim();
    const trimmedUnit = (unit || '').trim();

    if (!trimmedName) errors.push('Tên nguyên liệu không được để trống.');
    if (!trimmedUnit) errors.push('Đơn vị tính không được để trống.');

    if (errors.length > 0) {
      return res.status(400).render('admin/ingredients/new', {
        title: 'Thêm Nguyên Liệu Mới',
        errors,
        formData: { name: trimmedName, unit: trimmedUnit }
      });
    }

    await prisma.ingredient.create({
      data: {
        name: trimmedName,
        unit: trimmedUnit
      }
    });

    res.redirect(303, '/admin/ingredients');
  } catch (err) {
    next(err);
  }
});

// GET /admin/ingredients/:id/edit - Form sửa nguyên liệu
router.get('/ingredients/:id/edit', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã nguyên liệu không hợp lệ.' });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render('404', { title: '404', message: `Không tìm thấy nguyên liệu #${id}.` });
    }

    res.render('admin/ingredients/edit', {
      title: `Chỉnh Sửa Nguyên Liệu: ${ingredient.name}`,
      ingredient,
      errors: [],
      formData: ingredient
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /admin/ingredients/:id - Cập nhật nguyên liệu
router.patch('/ingredients/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã nguyên liệu không hợp lệ.' });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render('404', { title: '404', message: `Nguyên liệu #${id} không tồn tại.` });
    }

    const { name, unit } = req.body;
    const errors = [];
    const trimmedName = (name || '').trim();
    const trimmedUnit = (unit || '').trim();

    if (!trimmedName) errors.push('Tên nguyên liệu không được để trống.');
    if (!trimmedUnit) errors.push('Đơn vị tính không được để trống.');

    if (errors.length > 0) {
      return res.status(400).render('admin/ingredients/edit', {
        title: `Chỉnh Sửa Nguyên Liệu: ${ingredient.name}`,
        ingredient,
        errors,
        formData: { id, name: trimmedName, unit: trimmedUnit }
      });
    }

    await prisma.ingredient.update({
      where: { id },
      data: { name: trimmedName, unit: trimmedUnit }
    });

    res.redirect(303, '/admin/ingredients');
  } catch (err) {
    next(err);
  }
});

// GET /admin/ingredients/:id/delete - Xác nhận xóa nguyên liệu
router.get('/ingredients/:id/delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã nguyên liệu không hợp lệ.' });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render('404', { title: '404', message: `Không tìm thấy nguyên liệu #${id} để xóa.` });
    }

    res.render('admin/ingredients/delete', {
      title: `Xác Nhận Xóa Nguyên Liệu: ${ingredient.name}`,
      ingredient
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /admin/ingredients/:id - Xóa nguyên liệu
router.delete('/ingredients/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).render('404', { title: '404', message: 'Mã nguyên liệu không hợp lệ.' });
    }

    const ingredient = await prisma.ingredient.findUnique({ where: { id } });
    if (!ingredient) {
      return res.status(404).render('404', { title: '404', message: `Nguyên liệu #${id} không tồn tại để xóa.` });
    }

    await prisma.ingredient.delete({ where: { id } });
    res.redirect(303, '/admin/ingredients');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
