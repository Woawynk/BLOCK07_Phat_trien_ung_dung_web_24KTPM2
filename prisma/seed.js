const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu nạp dữ liệu mẫu (Seed Data) ---');

  // Xóa sạch dữ liệu cũ và reset ID tự tăng (autoincrement) về 1 trong PostgreSQL / Supabase
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "dishes", "chefs", "ingredients", "_DishToIngredient" RESTART IDENTITY CASCADE;`);
  } catch (err) {
    // Dự phòng nếu không đủ quyền TRUNCATE: Dùng deleteMany và ALTER SEQUENCE
    await prisma.dish.deleteMany({});
    await prisma.chef.deleteMany({});
    await prisma.ingredient.deleteMany({});
    try {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "dishes_id_seq" RESTART WITH 1;`);
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "chefs_id_seq" RESTART WITH 1;`);
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "ingredients_id_seq" RESTART WITH 1;`);
    } catch (seqErr) {
      console.warn('Không thể reset sequence:', seqErr.message);
    }
  }

  // 1. Nạp Đầu bếp trước
  const chef1 = await prisma.chef.create({
    data: {
      name: 'Nguyễn Văn Hùng',
      specialty: 'Bếp trưởng - Chuyên gia phở truyền thống & các món nước Bắc Bộ'
    }
  });

  const chef2 = await prisma.chef.create({
    data: {
      name: 'Trần Thị Mai',
      specialty: 'Bếp phó - Chuyên gia món nướng & ẩm thực đậm đà Nam Bộ'
    }
  });

  const chef3 = await prisma.chef.create({
    data: {
      name: 'Lê Hoàng Long',
      specialty: 'Đầu bếp chính - Chuyên món khai vị, bánh mì & đồ ăn nhanh đường phố'
    }
  });

  console.log('Đã nạp thành công 3 đầu bếp.');

  // 2. Nạp Nguyên liệu thực phẩm
  const ingBo = await prisma.ingredient.create({ data: { name: 'Thịt thăn bò tươi', unit: 'kg' } });
  const ingXuong = await prisma.ingredient.create({ data: { name: 'Xương ống bò ninh', unit: 'kg' } });
  const ingBanhPho = await prisma.ingredient.create({ data: { name: 'Bánh phở tươi Hà Nội', unit: 'kg' } });
  const ingSuon = await prisma.ingredient.create({ data: { name: 'Sườn cốt lết heo tươi', unit: 'kg' } });
  const ingGaoTam = await prisma.ingredient.create({ data: { name: 'Gạo tấm thơm dẻo', unit: 'kg' } });
  const ingHanhNgo = await prisma.ingredient.create({ data: { name: 'Hành hoa & ngò gai thơm', unit: 'bó' } });
  const ingNuocMam = await prisma.ingredient.create({ data: { name: 'Nước mắm truyền thống Phú Quốc', unit: 'chai (500ml)' } });
  const ingBanhMi = await prisma.ingredient.create({ data: { name: 'Bánh mì giòn vỏ mỏng', unit: 'ổ' } });
  const ingTom = await prisma.ingredient.create({ data: { name: 'Tôm sú tươi sống', unit: 'kg' } });
  const ingHatSen = await prisma.ingredient.create({ data: { name: 'Hạt sen tươi hồ Tịnh Tâm Huế', unit: 'kg' } });

  console.log('Đã nạp thành công 10 nguyên liệu.');

  // 3. Nạp Món ăn có liên kết Đầu bếp và Nguyên liệu
  const dishes = [
    {
      name: 'Phở Bò Tái Lăn Hà Nội',
      description: 'Bánh phở tươi, thịt bò xào lăn tỏi gừng thơm nức mũi, nước dùng ninh từ xương ống bò 12 tiếng cùng hoa hồi, quế chi thảo quả.',
      price: 65000,
      category: 'Món nước',
      imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80',
      available: true,
      chefId: chef1.id,
      ingredients: {
        connect: [{ id: ingBo.id }, { id: ingXuong.id }, { id: ingBanhPho.id }, { id: ingHanhNgo.id }, { id: ingNuocMam.id }]
      }
    },
    {
      name: 'Bún Chả Nem Hà Nội',
      description: 'Chả miếng và chả băm nướng than hoa vàng ruộm, ăn kèm nem cua bể giòn tan, bún sợi nhỏ và nước mắm đu đủ cà rốt chua ngọt.',
      price: 60000,
      category: 'Món chính',
      imageUrl: 'https://images.unsplash.com/photo-1576577445504-6af96477db52?auto=format&fit=crop&w=800&q=80',
      available: true,
      chefId: chef2.id,
      ingredients: {
        connect: [{ id: ingSuon.id }, { id: ingHanhNgo.id }, { id: ingNuocMam.id }]
      }
    },
    {
      name: 'Cơm Tấm Sườn Bì Chả Đặc Biệt',
      description: 'Hạt cơm tấm thơm dẻo, sườn cốt lết ướp mật ong nướng than hồng mềm mọng, bì sợi thính thơm và chả trứng hấp béo ngậy.',
      price: 55000,
      category: 'Món chính',
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
      available: true,
      chefId: chef2.id,
      ingredients: {
        connect: [{ id: ingGaoTam.id }, { id: ingSuon.id }, { id: ingNuocMam.id }, { id: ingHanhNgo.id }]
      }
    },
    {
      name: 'Bánh Mì Kẹp Thịt Nướng Xá Xíu',
      description: 'Vỏ bánh mì giòn rụm nướng nóng hổi, pate gan béo ngậy, thịt xá xíu đậm đà, đồ chua giòn giòn và sốt bơ béo ngậy đặc trưng.',
      price: 35000,
      category: 'Món ăn nhanh',
      imageUrl: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?auto=format&fit=crop&w=800&q=80',
      available: true,
      chefId: chef3.id,
      ingredients: {
        connect: [{ id: ingBanhMi.id }, { id: ingSuon.id }, { id: ingNuocMam.id }]
      }
    },
    {
      name: 'Gỏi Cuốn Tôm Thịt Sài Gòn',
      description: 'Tôm sú tươi luộc, thịt ba chỉ, bún tươi và rau thơm cuộn trong bánh tráng dẻo mềm, chấm cùng tương đen pha đậu phộng rang giòn.',
      price: 40000,
      category: 'Món khai vị',
      imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
      available: true,
      chefId: chef3.id,
      ingredients: {
        connect: [{ id: ingTom.id }, { id: ingHanhNgo.id }, { id: ingNuocMam.id }]
      }
    },
    {
      name: 'Chè Hạt Sen Long Nhãn Băng Đường',
      description: 'Hạt sen Huế ninh mềm bùi ngọt bọc trong lớp cùi nhãn lồng giòn ngọt, nước đường phèn thanh mát giải nhiệt mùa hè.',
      price: 30000,
      category: 'Tráng miệng',
      imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80',
      available: false,
      chefId: chef1.id,
      ingredients: {
        connect: [{ id: ingHatSen.id }]
      }
    }
  ];

  for (const dish of dishes) {
    await prisma.dish.create({ data: dish });
  }
  console.log(`Đã nạp thành công ${dishes.length} món ăn kèm thông tin Đầu bếp và Nguyên liệu.`);

  console.log('--- Hoàn tất nạp dữ liệu mẫu! ---');
}

main()
  .catch((e) => {
    console.error('Lỗi seed data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
