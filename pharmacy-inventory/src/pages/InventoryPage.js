import React, { useContext, useState, useMemo } from "react";
import { 
    Boxes, 
    AlertTriangle, 
    Search, 
    Plus,
    Download,
    TrendingDown,
    Activity
} from "lucide-react";
import { DataContext } from "../context/DataContext";
import InventoryTable from "../components/InventoryTable";
import StockCardSidebar from "../components/StockCardSidebar";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "../styles/inventory-modern.css";
import { getInventoryStockValue } from "../utils/inventoryValuation";

export default function InventoryPage() {
  const { inventory, inventoryCategories = [], updateInventoryItem, deleteInventoryItem, userRole } = useContext(DataContext);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [filters, setFilters] = useState({
    mainCategoryId: "",
    subcategoryId: "",
    productFormId: "",
    genericName: "",
    brandName: "",
    supplier: "",
    stockStatus: "",
    expiryStatus: "",
  });
  const LOW_STOCK_THRESHOLD = 10;
  const selectedCategory = inventoryCategories.find((category) =>
    String(category.id) === filters.mainCategoryId
  );
  const selectedSubcategory = selectedCategory?.subcategories.find((subcategory) =>
    String(subcategory.id) === filters.subcategoryId
  );

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    let outOfStock = 0;
    let expiringSoon = 0;
    let expired = 0;
    let lowStock = 0;
    let stockValue = 0;

    inventory.forEach(med => {
      const total = med.Batches ? med.Batches.reduce((acc, b) => acc + b.quantity, 0) : 0;
      if (total === 0) outOfStock++;
      else if (total <= (med.lowStockThreshold || LOW_STOCK_THRESHOLD)) lowStock++;
      const batches = med.Batches || [];
      stockValue += getInventoryStockValue(med);

      if (batches.some(batch => Number(batch.quantity) > 0 && batch.expiryDate && new Date(batch.expiryDate) < now)) expired++;
      if (batches.some(batch => Number(batch.quantity) > 0 && batch.expiryDate && new Date(batch.expiryDate) >= now && new Date(batch.expiryDate) <= thirtyDays)) expiringSoon++;
    });

    const totalBatches = inventory.reduce((sum, medicine) => sum + (medicine.Batches?.length || 0), 0);
    return { total: inventory.length, totalBatches, outOfStock, expiringSoon, expired, lowStock, stockValue };
  }, [inventory]);

  // --- Filtering Logic ---
  const filteredInventory = useMemo(() => {
    let result = inventory;

    if (filters.mainCategoryId) result = result.filter(med => String(med.mainCategoryId) === filters.mainCategoryId);
    if (filters.subcategoryId) result = result.filter(med => String(med.subcategoryId) === filters.subcategoryId);
    if (filters.productFormId) result = result.filter(med => String(med.productFormId) === filters.productFormId);
    if (filters.genericName) result = result.filter(med => (med.genericName || "").toLowerCase().includes(filters.genericName.toLowerCase()));
    if (filters.brandName) result = result.filter(med => (med.brandName || "").toLowerCase().includes(filters.brandName.toLowerCase()));
    if (filters.supplier) result = result.filter(med => (med.supplier || "").toLowerCase().includes(filters.supplier.toLowerCase()));
    if (filters.stockStatus) {
      result = result.filter(med => {
        const total = (med.Batches || []).reduce((sum, batch) => sum + Number(batch.quantity || 0), 0);
        const threshold = Number(med.lowStockThreshold || LOW_STOCK_THRESHOLD);
        if (filters.stockStatus === "out") return total === 0;
        if (filters.stockStatus === "low") return total > 0 && total <= threshold;
        return total > threshold;
      });
    }
    if (filters.expiryStatus) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const warningDate = new Date(today);
      warningDate.setDate(warningDate.getDate() + 30);
      result = result.filter(med => (med.Batches || []).some(batch => {
        if (Number(batch.quantity) <= 0 || !batch.expiryDate) return false;
        const expiry = new Date(batch.expiryDate);
        if (filters.expiryStatus === "expired") return expiry < today;
        if (filters.expiryStatus === "near-expiry") return expiry >= today && expiry <= warningDate;
        return expiry > warningDate;
      }));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(med => 
        med.name.toLowerCase().includes(q) || 
        (med.genericName && med.genericName.toLowerCase().includes(q)) ||
        (med.brandName && med.brandName.toLowerCase().includes(q)) ||
        (med.supplier && med.supplier.toLowerCase().includes(q)) ||
        (med.barcode && med.barcode.toLowerCase().includes(q))
      );
    }

    return result;
  }, [inventory, filters, searchQuery]);

  return (
    <div className="inv-container">
      {/* Health Stats */}
      <div className="inv-health-row">
        <div className="inv-health-card">
          <div className="inv-health-icon" style={{background:'#dbeafe'}}>
            <Boxes size={24} color="#1e40af" />
          </div>
          <div className="inv-health-copy">
            <span className="inv-health-label">Total SKUs</span>
            <span className="inv-health-value">{stats.total}</span>
          </div>
        </div>
        <div className="inv-health-card">
          <div className="inv-health-icon" style={{background:'#fee2e2'}}>
            <AlertTriangle size={24} color="#b91c1c" />
          </div>
          <div className="inv-health-copy">
            <span className="inv-health-label">Out of Stock</span>
            <span className="inv-health-value">{stats.outOfStock}</span>
          </div>
        </div>
        <div className="inv-health-card">
          <div className="inv-health-icon" style={{background:'#ffedd5'}}>
            <TrendingDown size={24} color="#c2410c" />
          </div>
          <div className="inv-health-copy">
            <span className="inv-health-label">Low Stock</span>
            <span className="inv-health-value">{stats.lowStock}</span>
          </div>
        </div>
        <div className="inv-health-card">
          <div className="inv-health-icon" style={{background:'#f1f5f9'}}>
            <Activity size={24} color="#475569" />
          </div>
          <div className="inv-health-copy">
            <span className="inv-health-label">Shelf Monitoring</span>
            <span className="inv-health-value">{stats.expiringSoon}</span>
          </div>
        </div>
        <div className="inv-health-card">
          <div className="inv-health-icon" style={{background:'#fee2e2'}}>
            <AlertTriangle size={24} color="#b91c1c" />
          </div>
          <div className="inv-health-copy">
            <span className="inv-health-label">Expired Products</span>
            <span className="inv-health-value">{stats.expired}</span>
          </div>
        </div>
        <div className="inv-health-card">
          <div className="inv-health-copy">
            <span className="inv-health-label">Stock Value</span>
            <span className="inv-health-value">K{stats.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
        <div className="inv-health-actions-card" aria-label="Inventory actions">
          <button className="asm-btn asm-btn-secondary" disabled title="Export data is unavailable">
            <Download size={18} /> Export Data (Unavailable)
          </button>
          <button className="asm-btn asm-btn-primary" onClick={() => navigate('/add-stock')}>
            <Plus size={18} /> Add New Stock
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="inv-filter-bar inv-inventory-filters">
        <select className="asm-input" aria-label="Filter main category" value={filters.mainCategoryId} onChange={e => setFilters(current => ({ ...current, mainCategoryId: e.target.value, subcategoryId: "", productFormId: "" }))}>
          <option value="">All main categories</option>
          {inventoryCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="asm-input" aria-label="Filter subcategory" disabled={!selectedCategory} value={filters.subcategoryId} onChange={e => setFilters(current => ({ ...current, subcategoryId: e.target.value, productFormId: "" }))}>
          <option value="">All subcategories</option>
          {selectedCategory?.subcategories.map(subcategory => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
        </select>
        <select className="asm-input" aria-label="Filter product form" disabled={!selectedSubcategory} value={filters.productFormId} onChange={e => setFilters(current => ({ ...current, productFormId: e.target.value }))}>
          <option value="">All product forms</option>
          {selectedSubcategory?.forms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}
        </select>
        <input className="asm-input" aria-label="Filter generic name" placeholder="Generic name" value={filters.genericName} onChange={e => setFilters(current => ({ ...current, genericName: e.target.value }))} />
        <input className="asm-input" aria-label="Filter brand" placeholder="Brand" value={filters.brandName} onChange={e => setFilters(current => ({ ...current, brandName: e.target.value }))} />
        <input className="asm-input" aria-label="Filter supplier" placeholder="Supplier" value={filters.supplier} onChange={e => setFilters(current => ({ ...current, supplier: e.target.value }))} />
        <select className="asm-input" aria-label="Filter stock status" value={filters.stockStatus} onChange={e => setFilters(current => ({ ...current, stockStatus: e.target.value }))}>
          <option value="">All stock statuses</option>
          <option value="in">In stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
        </select>
        <select className="asm-input" aria-label="Filter expiry status" value={filters.expiryStatus} onChange={e => setFilters(current => ({ ...current, expiryStatus: e.target.value }))}>
          <option value="">All expiry statuses</option>
          <option value="valid">Not near expiry</option>
          <option value="near-expiry">Near expiry (30 days)</option>
          <option value="expired">Expired</option>
        </select>
        <div className="inv-search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="text"
            className="asm-input"
            aria-label="Search inventory"
            placeholder="Search name, generic, brand, supplier, or SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ margin: "0 0 1rem", color: "#64748b", fontSize: "0.85rem" }}>
        Showing <strong style={{ color: "#1e293b" }}>{stats.total}</strong> unique products across{" "}
        <strong style={{ color: "#1e293b" }}>{stats.totalBatches}</strong> stock batches. Expand a product row to view every batch.
      </div>

      {/* Table Section */}
      <div className="inv-table-card">
        <InventoryTable 
          inventory={filteredInventory}
          userRole={userRole}
          updateMedicine={updateInventoryItem}
          deleteMedicine={async (id) => { 
            if(window.confirm("Are you sure you want to completely delete this item from inventory?")) { 
                const result = await deleteInventoryItem(id);
                if (result.success) toast.success('Item deleted successfully.');
                else toast.error(result.error || 'Failed to delete item.');
            } 
          }}
          onOpenCard={setSelectedMedicine}
        />
      </div>

      {/* Product Stock Card Sidebar */}
      <StockCardSidebar 
        medicine={selectedMedicine}
        onClose={() => setSelectedMedicine(null)}
        onUpdate={updateInventoryItem}
        categories={inventoryCategories}
      />
    </div>
  );
}
