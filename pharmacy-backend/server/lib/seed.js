const { Batch, Customer, Expense, InventoryCategory, Medicine, Prescription, Sales, Supplier } = require('../models');

async function seedSuppliers() {
  const count = await Supplier.count();
  if (count > 0) {
    return;
  }

  await Supplier.bulkCreate([
    {
      name: 'MediGlobe Distribution',
      contactPerson: 'Robert Chen',
      email: 'supply@mediglobe.com',
      phone: '+1-555-0192',
      address: '88 Pharma Way, New Jersey',
      paymentTerms: 'Net 30',
      balanceOwed: 4500.0,
      rating: 5,
    },
    {
      name: 'OmniHealth Logistics',
      contactPerson: 'Sarah Jenkins',
      email: 'orders@omnihealth.net',
      phone: '+1-555-8821',
      address: '42 Logistics Circle, Texas',
      paymentTerms: 'Net 15',
      balanceOwed: 1200.5,
      rating: 4,
    },
  ]);
}

async function seedInventory() {
  const count = await Medicine.count();
  if (count > 0) {
    return;
  }

  const firstSupplier = await Supplier.findOne({ order: [['id', 'ASC']] });
  const taxonomyId = async (path) => {
    const category = await InventoryCategory.findOne({ where: { path } });
    if (!category) throw new Error(`Missing inventory taxonomy seed: ${path}`);
    return category.id;
  };
  const medicinesCategoryId = await taxonomyId('medicines');
  const painCategoryId = await taxonomyId('medicines/pain-and-fever');
  const tabletFormId = await taxonomyId('medicines/pain-and-fever/tablet');
  const antibioticsCategoryId = await taxonomyId('medicines/antibiotics');
  const capsuleFormId = await taxonomyId('medicines/antibiotics/capsule');
  const supplementsCategoryId = await taxonomyId('vitamins-supplements');
  const vitaminsCategoryId = await taxonomyId('vitamins-supplements/vitamins');
  const syrupFormId = await taxonomyId('vitamins-supplements/vitamins/syrup');
  const medicines = await Medicine.bulkCreate(
    [
      {
        name: 'Paracetamol',
        genericName: 'Acetaminophen',
        category: 'Medicines',
        mainCategoryId: medicinesCategoryId,
        subcategoryId: painCategoryId,
        productFormId: tabletFormId,
        strength: '500mg',
        dosage: 'Tablet',
        supplier: firstSupplier?.name || 'Internal',
        manufacturer: 'MediQuick Labs',
        barcode: '1111111111111',
        lowStockThreshold: 20,
      },
      {
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        category: 'Medicines',
        mainCategoryId: medicinesCategoryId,
        subcategoryId: antibioticsCategoryId,
        productFormId: capsuleFormId,
        strength: '250mg',
        dosage: 'Capsule',
        supplier: firstSupplier?.name || 'Internal',
        manufacturer: 'CarePharm',
        barcode: '2222222222222',
        lowStockThreshold: 15,
      },
      {
        name: 'Vitamin C Syrup',
        genericName: 'Ascorbic Acid',
        category: 'Vitamins & Supplements',
        mainCategoryId: supplementsCategoryId,
        subcategoryId: vitaminsCategoryId,
        productFormId: syrupFormId,
        strength: '100ml',
        dosage: 'Syrup',
        supplier: firstSupplier?.name || 'Internal',
        manufacturer: 'NutraCare',
        barcode: '3333333333333',
        lowStockThreshold: 10,
      },
    ],
    { returning: true }
  );

  const batchData = [
    {
      medicineId: medicines[0].id,
      supplierId: firstSupplier?.id || null,
      batchNumber: 'PARA-001',
      quantity: 120,
      expiryDate: '2027-12-31',
      costPrice: 1.2,
      sellingPrice: 2.5,
      warehouse: 'Main Pharmacy',
      invoiceNumber: 'INV-1001',
    },
    {
      medicineId: medicines[1].id,
      supplierId: firstSupplier?.id || null,
      batchNumber: 'AMOX-001',
      quantity: 80,
      expiryDate: '2027-09-30',
      costPrice: 2.1,
      sellingPrice: 4.25,
      warehouse: 'Main Pharmacy',
      invoiceNumber: 'INV-1002',
    },
    {
      medicineId: medicines[2].id,
      supplierId: firstSupplier?.id || null,
      batchNumber: 'VITC-001',
      quantity: 40,
      expiryDate: '2027-06-30',
      costPrice: 3.5,
      sellingPrice: 6.0,
      warehouse: 'Main Pharmacy',
      invoiceNumber: 'INV-1003',
    },
  ];

  await Batch.bulkCreate(batchData);

  for (const medicine of medicines) {
    const batches = await Batch.findAll({ where: { medicineId: medicine.id } });
    const totalQuantity = batches.reduce((sum, batch) => sum + batch.quantity, 0);
    await medicine.update({ totalQuantity });
  }
}

async function seedExpenses() {
  const count = await Expense.count();
  if (count > 0) {
    return;
  }

  const now = new Date();
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  await Expense.bulkCreate([
    { category: 'Payroll', amount: 7350, description: 'Staff salaries', date: now },
    { category: 'Rent', amount: 3000, description: 'Pharmacy lease', date: now },
    { category: 'Utilities', amount: 1450, description: 'Power and water', date: now },
    { category: 'Payroll', amount: 7150, description: 'Staff salaries', date: lastMonth },
    { category: 'Rent', amount: 3000, description: 'Pharmacy lease', date: lastMonth },
  ]);
}

async function seedCustomers() {
  const count = await Customer.count();
  if (count > 0) {
    return;
  }

  await Customer.bulkCreate([
    {
      name: 'Sarah Connor',
      phone: '555-0101',
      email: 's.connor@cyber.net',
      address: '123 Resistance Way, LA',
      loyaltyPoints: 1250,
      allergies: 'Penicillin, Shellfish',
      chronicConditions: 'Type 1 Diabetes',
      insuranceProvider: 'Blue Shield',
      insuranceNumber: 'BS-99182',
      notes: 'Frequent visitor. Prefers generic medications.',
    },
    {
      name: 'Arthur Dent',
      phone: '555-4242',
      email: 'arthur@galaxy.org',
      address: '42 Hitchhiker Circle, London',
      loyaltyPoints: 42,
      allergies: 'None',
      chronicConditions: 'Hypertension',
      insuranceProvider: 'NHS Global',
      insuranceNumber: 'NHS-0042',
      notes: 'Needs tea with his medication.',
    },
  ]);
}

async function seedPrescriptions() {
  const count = await Prescription.count();
  if (count > 0) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  await Prescription.bulkCreate([
    {
      patientName: 'Donald Brooks',
      medications: 'Atorvastatin 20 mg',
      status: 'Pending',
      prescriber: 'Dr. Lisa Nguyen',
      insurance: 'BlueCross',
      dueDate: today,
    },
    {
      patientName: 'Angela Williams',
      medications: 'Losartan 50 mg',
      status: 'Ready for Pickup',
      prescriber: 'Dr. David Patel',
      insurance: 'Aetna',
      dueDate: today,
    },
  ]);
}

async function seedSales() {
  const count = await Sales.count();
  if (count > 0) {
    return;
  }

  const firstMedicine = await Medicine.findOne({
    include: [Batch],
    order: [['id', 'ASC']],
  });
  if (!firstMedicine || !firstMedicine.Batches?.length) {
    return;
  }

  const batch = firstMedicine.Batches[0];

  await Sales.create({
    batchId: batch.id,
    medicineId: firstMedicine.id,
    name: firstMedicine.name,
    quantity: 3,
    pricePerUnit: batch.sellingPrice,
    totalPrice: batch.sellingPrice * 3,
    totalCost: batch.costPrice * 3,
    paymentMethod: 'Cash',
    receiptNumber: 'REC-DEMO-001',
    date: new Date(),
  });

  await batch.update({ quantity: Math.max(0, batch.quantity - 3) });
  await firstMedicine.update({ totalQuantity: Math.max(0, firstMedicine.totalQuantity - 3) });
}

async function seedDemoData() {
  await seedSuppliers();
  await seedInventory();
  await seedExpenses();
  await seedCustomers();
  await seedPrescriptions();
  await seedSales();
}

module.exports = {
  seedDemoData,
};
