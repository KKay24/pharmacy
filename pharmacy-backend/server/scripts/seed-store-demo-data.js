const { Medicine, Batch, InventoryCategory, sequelize } = require('../models');

const CATALOG_DATA = [
  { name: 'SHAULTOX LOZENGES', price: 35, cost: 20, qty: 80, rx: false, category: 'Pain Relief & Cough', desc: 'Soothing throat lozenges for relief of sore throat, cough, and minor mouth irritation.' },
  { name: 'VARDVIT MULTIVITAMIN', price: 95, cost: 55, qty: 45, rx: false, category: 'Vitamins & Supplements', desc: 'Comprehensive daily multivitamin with essential micronutrients for energy and immune support.' },
  { name: 'softcare diappers', price: 165, cost: 110, qty: 30, rx: false, category: 'Baby Products', desc: 'Premium soft and absorbent baby diapers designed for leak protection and day-long comfort.' },
  { name: 'NAT B', price: 110, cost: 70, qty: 40, rx: false, category: 'Vitamins & Supplements', desc: 'High potency Vitamin B complex formulation to support neurological health and combat fatigue.' },
  { name: 'Novalyn', price: 45, cost: 25, qty: 60, rx: false, category: 'Cough & Cold', desc: 'Effective cough syrup providing fast relief from dry and chesty coughs.' },
  { name: 'Vit C plus', price: 55, cost: 30, qty: 90, rx: false, category: 'Vitamins & Supplements', desc: 'Effervescent Vitamin C plus Zinc tablets for daily immune defence and antioxidant support.' },
  { name: 'Cadiphen syrup', price: 40, cost: 22, qty: 50, rx: false, category: 'Cough & Cold', desc: 'Expectorant cough syrup for loosening phlegm and relieving respiratory congestion.' },
  { name: 'Medizox', price: 65, cost: 38, qty: 35, rx: true, category: 'Antibiotics', desc: 'Broad-spectrum antibiotic capsule. Prescription required for dispensing.' },
  { name: 'Cefuroxime', price: 130, cost: 80, qty: 25, rx: true, category: 'Antibiotics', desc: 'Second-generation cephalosporin antibiotic for bacterial infections. Prescription required.' },
  { name: 'Hypromellose eye drops', price: 48, cost: 28, qty: 40, rx: false, category: 'Eye Care', desc: 'Artificial tears lubricant eye drops for relief of dry, irritated, and burning eyes.' },
  { name: 'Face mask', price: 20, cost: 8, qty: 200, rx: false, category: 'Medical Supplies', desc: 'Pack of 3-ply protective medical surgical face masks with soft elastic ear loops.' },
  { name: 'Triphen 4 Flu', price: 42, cost: 24, qty: 75, rx: false, category: 'Cough & Cold', desc: 'Multi-action cold and flu formulation for headache, runny nose, and fever relief.' },
  { name: 'Omeprazole', price: 58, cost: 32, rx: false, qty: 60, category: 'Gastrointestinal', desc: 'Proton pump inhibitor (20mg) for heartburn, acid reflux, and stomach ulcer protection.' },
  { name: 'Tramadol', price: 90, cost: 50, rx: true, qty: 30, category: 'Pain & Fever', desc: 'Centrally acting analgesic for moderate to severe pain. Controlled prescription medicine.' },
  { name: 'Doxycycline', price: 70, cost: 40, rx: true, qty: 40, category: 'Antibiotics', desc: 'Tetracycline antibiotic used for various bacterial and skin infections. Prescription required.' },
  { name: 'Hydrogen peroxide', price: 25, cost: 12, rx: false, qty: 50, category: 'Medical Supplies', desc: 'Antiseptic 3% solution for minor cuts, scrapes, and skin cleansing.' },
  { name: 'Deep heat spray', price: 85, cost: 50, rx: false, qty: 35, category: 'Pain & Fever', desc: 'Targeted warming relief spray for muscular aches, pains, stiffness, and back strain.' },
  { name: 'Lofnac Spray', price: 78, cost: 45, rx: false, qty: 30, category: 'Pain & Fever', desc: 'Diclofenac topical anti-inflammatory spray for targeted joint and muscle pain.' },
  { name: 'Vapour rub', price: 32, cost: 18, rx: false, qty: 65, category: 'Cough & Cold', desc: 'Medicated menthol and eucalyptus chest rub for clear breathing and decongestion.' },
  { name: 'Pain rub', price: 30, cost: 16, rx: false, qty: 70, category: 'Pain & Fever', desc: 'Topical analgesic herbal balm for head, neck, and muscular pain.' },
  { name: 'Coldrid', price: 38, cost: 20, rx: false, qty: 85, category: 'Cough & Cold', desc: 'Non-drowsy daytime cold relief tablets for sneezing, nasal congestion, and body aches.' },
  { name: 'Zinc Sulphate', price: 35, cost: 18, rx: false, qty: 100, category: 'Vitamins & Supplements', desc: 'Zinc 20mg dispersible tablets for immunity and acute diarrhoea recovery.' },
  { name: 'Wellman tabs', price: 185, cost: 120, rx: false, qty: 25, category: 'Vitamins & Supplements', desc: 'Advanced micronutrient formula designed specifically to support men’s health and vitality.' },
  { name: 'Osteocare tabs', price: 175, cost: 115, rx: false, qty: 25, category: 'Vitamins & Supplements', desc: 'Calcium, magnesium, vitamin D3, and zinc supplement for optimal bone health.' },
  { name: 'Praganacare tabs', price: 195, cost: 130, rx: false, qty: 20, category: 'Vitamins & Supplements', desc: 'Comprehensive nutritional care before conception and throughout pregnancy.' },
  { name: 'Cetrizine syrup', price: 45, cost: 24, rx: false, qty: 45, category: 'Allergy & Antihistamines', desc: 'Non-sedating antihistamine syrup for relief of hay fever, allergies, and itchy skin.' },
  { name: 'Brustan', price: 35, cost: 18, rx: false, qty: 80, category: 'Pain & Fever', desc: 'Combination ibuprofen and paracetamol tablet for fast dual-action pain and fever relief.' },
];

async function seedStoreData() {
  await sequelize.authenticate();
  console.log('Connected to database.');

  const medicines = await Medicine.findAll();
  console.log(`Processing ${medicines.length} medicines...`);

  let batchesCreated = 0;
  let medicinesUpdated = 0;

  for (const med of medicines) {
    const catalogMatch = CATALOG_DATA.find(
      (c) => med.name.toLowerCase().includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(med.name.toLowerCase().trim())
    );

    const price = catalogMatch ? catalogMatch.price : (med.basePrice > 0 ? med.basePrice : 45.0);
    const cost = catalogMatch ? catalogMatch.cost : Math.round(price * 0.6);
    const qty = catalogMatch ? catalogMatch.qty : 35;
    const isRx = catalogMatch ? catalogMatch.rx : (med.prescriptionRequired || false);
    const desc = catalogMatch ? catalogMatch.desc : (med.description || `${med.name} - Quality healthcare product available for order.`);

    // Check if batches already exist
    const existingBatches = await Batch.findAll({ where: { medicineId: med.id } });

    if (existingBatches.length === 0) {
      const expiryYear = 2027 + Math.floor(Math.random() * 2);
      const expiryMonth = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
      const expiryDay = '28';
      const expiryDate = `${expiryYear}-${expiryMonth}-${expiryDay}`;

      await Batch.create({
        medicineId: med.id,
        batchNumber: `BATCH-${expiryYear}-${String(med.id).padStart(4, '0')}`,
        quantity: qty,
        expiryDate,
        costPrice: cost,
        sellingPrice: price,
        warehouse: 'Main Pharmacy Dispensary',
      });
      batchesCreated++;
    }

    // Update medicine attributes
    med.basePrice = price;
    med.totalQuantity = existingBatches.length > 0
      ? existingBatches.reduce((sum, b) => sum + Number(b.quantity || 0), 0)
      : qty;
    med.isCustomerVisible = true;
    med.prescriptionRequired = isRx;
    if (!med.description || med.description.length < 10) {
      med.description = desc;
    }
    await med.save();
    medicinesUpdated++;
  }

  console.log(`Seed complete: ${batchesCreated} batches created, ${medicinesUpdated} medicines updated.`);
  process.exit(0);
}

seedStoreData().catch((err) => {
  console.error('Error seeding store data:', err);
  process.exit(1);
});
