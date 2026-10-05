const { InventoryCategory, Medicine } = require('../models');
const { TAXONOMY, taxonomyPath, taxonomySlug } = require('../lib/inventory-taxonomy');

async function ensureColumns(queryInterface, tableName, columns, transaction) {
  const existingColumns = await queryInterface.describeTable(tableName, { transaction });
  for (const [name, definition] of Object.entries(columns)) {
    if (!existingColumns[name]) {
      await queryInterface.addColumn(tableName, name, definition, { transaction });
    }
  }
}

async function ensureIndex(queryInterface, tableName, fields, name, transaction) {
  const indexes = await queryInterface.showIndex(tableName, { transaction });
  if (!indexes.some((index) => index.name === name)) {
    await queryInterface.addIndex(tableName, fields, { name, transaction });
  }
}

async function ensureCategory({ name, slug, path, level, parentId }, transaction) {
  const [category] = await InventoryCategory.findOrCreate({
    where: { path },
    defaults: { name, slug, path, level, parentId },
    transaction,
  });
  return category;
}

async function seedTaxonomy(transaction) {
  const paths = new Map();
  for (const main of TAXONOMY) {
    const mainSlug = main.slug || taxonomySlug(main.name);
    const mainPath = taxonomyPath('', mainSlug);
    const mainCategory = await ensureCategory({
      name: main.name,
      slug: mainSlug,
      path: mainPath,
      level: 1,
      parentId: null,
    }, transaction);
    paths.set(mainPath, mainCategory);

    for (const subcategoryValue of main.subcategories) {
      const subcategory = typeof subcategoryValue === 'string'
        ? { name: subcategoryValue, forms: [] }
        : subcategoryValue;
      const subcategorySlug = taxonomySlug(subcategory.name);
      const subcategoryPath = taxonomyPath(mainPath, subcategorySlug);
      const subcategoryRecord = await ensureCategory({
        name: subcategory.name,
        slug: subcategorySlug,
        path: subcategoryPath,
        level: 2,
        parentId: mainCategory.id,
      }, transaction);
      paths.set(subcategoryPath, subcategoryRecord);

      for (const formName of subcategory.forms || []) {
        const formSlug = taxonomySlug(formName);
        const formPath = taxonomyPath(subcategoryPath, formSlug);
        const formRecord = await ensureCategory({
          name: formName,
          slug: formSlug,
          path: formPath,
          level: 3,
          parentId: subcategoryRecord.id,
        }, transaction);
        paths.set(formPath, formRecord);
      }
    }
  }
  return paths;
}

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function legacyCategoryKey(value) {
  const key = normalized(value);
  if (key.endsWith('ies')) return `${key.slice(0, -3)}y`;
  return key.endsWith('s') ? key.slice(0, -1) : key;
}

async function classifyLegacyProducts(paths, transaction) {
  const medicineMain = paths.get('medicines');
  const medicineOther = paths.get('medicines/other');
  const vitaminMain = paths.get('vitamins-supplements');
  const deviceMain = paths.get('medical-devices');
  const deviceOther = paths.get('medical-devices/other');
  const allCategories = await InventoryCategory.findAll({ transaction });
  const byParentAndName = new Map(
    allCategories.map((category) => [`${category.parentId || 0}:${normalized(category.name)}`, category])
  );
  const categoriesById = new Map(allCategories.map((category) => [Number(category.id), category]));
  const formsByName = new Map();
  for (const category of allCategories.filter((item) => item.level === 3)) {
    const key = legacyCategoryKey(category.name);
    formsByName.set(key, [...(formsByName.get(key) || []), category]);
  }
  const medicines = await Medicine.findAll({
    attributes: ['id', 'category', 'dosage'],
    where: { mainCategoryId: null },
    transaction,
  });

  for (const medicine of medicines) {
    const oldCategory = normalized(medicine.category);
    const oldDosage = normalized(medicine.dosage);
    let mainCategory = null;
    let subcategory = null;
    let productForm = null;

    if (oldCategory === normalized('Vitamins & Supplements') || oldCategory === 'supplements') {
      mainCategory = vitaminMain;
      subcategory = byParentAndName.get(`${mainCategory.id}:${normalized('Vitamins')}`) ||
        byParentAndName.get(`${mainCategory.id}:${normalized('Other')}`);
    } else if (oldCategory === normalized('Medical Devices') || oldCategory === 'diagnostics') {
      mainCategory = deviceMain;
      subcategory = deviceOther;
    } else if (oldCategory === normalized('Medical Supplies')) {
      mainCategory = paths.get('medical-supplies');
      subcategory = byParentAndName.get(`${mainCategory.id}:${normalized('Other')}`);
    } else if (oldCategory === normalized('Personal Care')) {
      mainCategory = paths.get('personal-care');
      subcategory = byParentAndName.get(`${mainCategory.id}:${normalized('Other')}`);
    } else if (oldCategory === normalized('Baby Products')) {
      mainCategory = paths.get('baby-products');
      subcategory = byParentAndName.get(`${mainCategory.id}:${normalized('Other')}`);
    } else if (oldCategory === normalized('Medicines')) {
      mainCategory = medicineMain;
      subcategory = medicineOther;
    } else if (oldCategory) {
      const medicineSubcategory = byParentAndName.get(`${medicineMain.id}:${oldCategory}`);
      if (medicineSubcategory) {
        mainCategory = medicineMain;
        subcategory = medicineSubcategory;
      } else {
        const matchingForms = formsByName.get(legacyCategoryKey(medicine.category)) || [];
        if (matchingForms.length === 1) {
          productForm = matchingForms[0];
          subcategory = categoriesById.get(Number(productForm.parentId));
          mainCategory = categoriesById.get(Number(subcategory?.parentId));
        }
      }
    }

    if (!productForm && subcategory && oldDosage) {
      productForm = byParentAndName.get(`${subcategory.id}:${legacyCategoryKey(medicine.dosage)}`) || null;
    }

    const classification = {
      mainCategoryId: mainCategory?.id || null,
      subcategoryId: subcategory?.id || null,
      productFormId: productForm?.id || null,
    };
    if (classification.mainCategoryId || classification.subcategoryId || classification.productFormId) {
      await medicine.update(classification, { transaction });
    }
  }
}

module.exports = {
  version: '011',
  description: 'Add hierarchical inventory categories and product classification fields',
  async up({ queryInterface, sequelize, DataTypes }) {
    const transaction = await sequelize.transaction();
    try {
      await queryInterface.createTable('InventoryCategories', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        parentId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'InventoryCategories', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: { type: DataTypes.STRING, allowNull: false },
        slug: { type: DataTypes.STRING, allowNull: false },
        path: { type: DataTypes.STRING, allowNull: false, unique: true },
        level: { type: DataTypes.INTEGER, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      }, { transaction });

      await ensureColumns(queryInterface, 'Medicines', {
        mainCategoryId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'InventoryCategories', key: 'id' },
          onDelete: 'SET NULL',
        },
        subcategoryId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'InventoryCategories', key: 'id' },
          onDelete: 'SET NULL',
        },
        productFormId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'InventoryCategories', key: 'id' },
          onDelete: 'SET NULL',
        },
        brandName: { type: DataTypes.STRING, allowNull: true },
        packSize: { type: DataTypes.STRING, allowNull: true },
        unitOfMeasure: { type: DataTypes.STRING, allowNull: true },
      }, transaction);

      await ensureIndex(queryInterface, 'InventoryCategories', ['parentId', 'level'], 'inventory_categories_parent_level_idx', transaction);
      await ensureIndex(queryInterface, 'Medicines', ['mainCategoryId'], 'medicines_main_category_idx', transaction);
      await ensureIndex(queryInterface, 'Medicines', ['subcategoryId'], 'medicines_subcategory_idx', transaction);
      await ensureIndex(queryInterface, 'Medicines', ['productFormId'], 'medicines_product_form_idx', transaction);
      await ensureIndex(queryInterface, 'Medicines', ['brandName'], 'medicines_brand_name_idx', transaction);

      const paths = await seedTaxonomy(transaction);
      await classifyLegacyProducts(paths, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
