const DEFAULT_SYNONYMS = [
  {
    term: 'painkiller',
    synonyms: JSON.stringify(['paracetamol', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'tramadol', 'pain relief', 'analgesic']),
    category: 'Pain & Fever',
  },
  {
    term: 'painkillers',
    synonyms: JSON.stringify(['paracetamol', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'tramadol', 'pain relief', 'analgesic']),
    category: 'Pain & Fever',
  },
  {
    term: 'pain relief',
    synonyms: JSON.stringify(['paracetamol', 'ibuprofen', 'diclofenac', 'naproxen', 'aspirin', 'pain rub', 'analgesic']),
    category: 'Pain & Fever',
  },
  {
    term: 'headache',
    synonyms: JSON.stringify(['paracetamol', 'ibuprofen', 'aspirin', 'pain relief', 'panadol']),
    category: 'Pain & Fever',
  },
  {
    term: 'headache medicine',
    synonyms: JSON.stringify(['paracetamol', 'ibuprofen', 'aspirin', 'pain relief', 'panadol']),
    category: 'Pain & Fever',
  },
  {
    term: 'fever',
    synonyms: JSON.stringify(['paracetamol', 'ibuprofen', 'acetaminophen', 'antipyretic']),
    category: 'Pain & Fever',
  },
  {
    term: 'vitamin c',
    synonyms: JSON.stringify(['ascorbic acid', 'vit c', 'vit c plus', 'zinc']),
    category: 'Vitamins & Supplements',
  },
  {
    term: 'vit c',
    synonyms: JSON.stringify(['ascorbic acid', 'vitamin c', 'vit c plus']),
    category: 'Vitamins & Supplements',
  },
  {
    term: 'ascorbic acid',
    synonyms: JSON.stringify(['vitamin c', 'vit c', 'vit c plus']),
    category: 'Vitamins & Supplements',
  },
  {
    term: 'ors',
    synonyms: JSON.stringify(['oral rehydration salts', 'oral rehydration', 'rehydration', 'electrolytes']),
    category: 'Gastrointestinal',
  },
  {
    term: 'oral rehydration salts',
    synonyms: JSON.stringify(['ors', 'oral rehydration', 'rehydration', 'electrolytes']),
    category: 'Gastrointestinal',
  },
  {
    term: 'rehydration',
    synonyms: JSON.stringify(['ors', 'oral rehydration salts', 'electrolytes']),
    category: 'Gastrointestinal',
  },
  {
    term: 'antibiotic',
    synonyms: JSON.stringify(['amoxicillin', 'azithromycin', 'ciprofloxacin', 'cefuroxime', 'doxycycline', 'metronidazole']),
    category: 'Antibiotics',
  },
  {
    term: 'antibiotics',
    synonyms: JSON.stringify(['amoxicillin', 'azithromycin', 'ciprofloxacin', 'cefuroxime', 'doxycycline', 'metronidazole']),
    category: 'Antibiotics',
  },
  {
    term: 'cough',
    synonyms: JSON.stringify(['cough syrup', 'expectorant', 'lozenges', 'dextromethorphan', 'guaifenesin']),
    category: 'Respiratory',
  },
  {
    term: 'cold',
    synonyms: JSON.stringify(['decongestant', 'vapour rub', 'nasal inhaler', 'flu', 'coldrid']),
    category: 'Respiratory',
  },
  {
    term: 'flu',
    synonyms: JSON.stringify(['cold', 'paracetamol', 'decongestant', 'vapour rub']),
    category: 'Respiratory',
  },
  {
    term: 'heartburn',
    synonyms: JSON.stringify(['omeprazole', 'antacid', 'magnesium trisilicate', 'pantoprazole', 'acid reflux']),
    category: 'Gastrointestinal',
  },
  {
    term: 'acid reflux',
    synonyms: JSON.stringify(['omeprazole', 'antacid', 'pantoprazole', 'heartburn']),
    category: 'Gastrointestinal',
  },
  {
    term: 'antacid',
    synonyms: JSON.stringify(['omeprazole', 'magnesium trisilicate', 'heartburn', 'acid reflux']),
    category: 'Gastrointestinal',
  },
  {
    term: 'allergy',
    synonyms: JSON.stringify(['cetirizine', 'cetrizine', 'loratadine', 'chlorpheniramine', 'antihistamine']),
    category: 'Medicines',
  },
  {
    term: 'allergies',
    synonyms: JSON.stringify(['cetirizine', 'cetrizine', 'loratadine', 'chlorpheniramine', 'antihistamine']),
    category: 'Medicines',
  },
  {
    term: 'diaper',
    synonyms: JSON.stringify(['diapers', 'nappy', 'nappies']),
    category: 'Baby Products',
  },
  {
    term: 'diapers',
    synonyms: JSON.stringify(['diaper', 'nappy', 'nappies']),
    category: 'Baby Products',
  },
  {
    term: 'eye drops',
    synonyms: JSON.stringify(['hypromellose', 'artificial tears', 'ophthalmic']),
    category: 'Medicines',
  },
];

async function addIndexIfMissing(queryInterface, tableName, fields, options = {}) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    const name = options.name || `${tableName}_${fields.join('_')}_idx`;
    if (indexes.some((index) => index.name === name)) return;
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  } catch (err) {
    // Gracefully handle dialect differences or already-existing index
  }
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some(
    (t) => (typeof t === 'string' ? t : t.tableName || t.name).toLowerCase() === tableName.toLowerCase()
  );
}

module.exports = {
  version: '019',
  description: 'Add SearchSynonyms and SearchAnalytics tables with dialect-aware search optimization indexes',
  async up({ queryInterface, DataTypes, sequelize }) {
    // 1. SearchSynonyms table
    if (!(await tableExists(queryInterface, 'SearchSynonyms'))) {
      await queryInterface.createTable('SearchSynonyms', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        term: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        synonyms: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        category: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });
    }

    // Seed default pharmacy synonyms idempotently without touching existing product records
    const existingRows = await sequelize.query('SELECT term FROM "SearchSynonyms"', {
      type: sequelize.QueryTypes.SELECT,
    });
    const existingTerms = new Set(existingRows.map((r) => String(r.term || '').toLowerCase()));
    const now = new Date();
    const missingSynonyms = DEFAULT_SYNONYMS
      .filter((row) => !existingTerms.has(row.term.toLowerCase()))
      .map((row) => ({
        term: row.term,
        synonyms: row.synonyms,
        category: row.category,
        createdAt: now,
        updatedAt: now,
      }));
    if (missingSynonyms.length > 0) {
      await queryInterface.bulkInsert('SearchSynonyms', missingSynonyms);
    }

    // 2. SearchAnalytics table
    if (!(await tableExists(queryInterface, 'SearchAnalytics'))) {
      await queryInterface.createTable('SearchAnalytics', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        query: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        normalizedQuery: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        resultsCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        hasResults: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        clickedProductId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Medicines', key: 'id' },
          onDelete: 'SET NULL',
        },
        sessionId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      });
    }

    // 3. Standard B-tree search performance indexes (both PostgreSQL and SQLite)
    await addIndexIfMissing(queryInterface, 'SearchSynonyms', ['term'], { name: 'search_synonyms_term_idx' });
    await addIndexIfMissing(queryInterface, 'SearchAnalytics', ['normalizedQuery'], { name: 'search_analytics_norm_query_idx' });
    await addIndexIfMissing(queryInterface, 'SearchAnalytics', ['hasResults'], { name: 'search_analytics_has_results_idx' });
    await addIndexIfMissing(queryInterface, 'SearchAnalytics', ['createdAt'], { name: 'search_analytics_created_at_idx' });
    await addIndexIfMissing(queryInterface, 'SearchAnalytics', ['clickedProductId'], { name: 'search_analytics_clicked_product_idx' });

    await addIndexIfMissing(queryInterface, 'Medicines', ['name'], { name: 'medicines_name_search_idx' });
    await addIndexIfMissing(queryInterface, 'Medicines', ['brandName'], { name: 'medicines_brand_name_search_idx' });
    await addIndexIfMissing(queryInterface, 'Medicines', ['genericName'], { name: 'medicines_generic_name_idx' });
    await addIndexIfMissing(queryInterface, 'Medicines', ['category'], { name: 'medicines_category_search_idx' });
    await addIndexIfMissing(queryInterface, 'Medicines', ['isCustomerVisible'], { name: 'medicines_customer_visible_idx' });

    // 4. PostgreSQL-specific pg_trgm trigram & full-text search indexes (non-blocking if extension unavailable)
    if (sequelize.getDialect() === 'postgres') {
      try {
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
        await sequelize.query(
          'CREATE INDEX IF NOT EXISTS medicines_name_trgm_idx ON "Medicines" USING gin ("name" gin_trgm_ops);'
        );
        await sequelize.query(
          'CREATE INDEX IF NOT EXISTS medicines_brand_trgm_idx ON "Medicines" USING gin ("brandName" gin_trgm_ops);'
        );
        await sequelize.query(
          'CREATE INDEX IF NOT EXISTS medicines_generic_trgm_idx ON "Medicines" USING gin ("genericName" gin_trgm_ops);'
        );
      } catch (err) {
        // Fallback to B-tree / LOWER() indexes if pg_trgm extension cannot be created by DB role
      }
    }
  },
};
