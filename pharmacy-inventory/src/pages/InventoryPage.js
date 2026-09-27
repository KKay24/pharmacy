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

export default function InventoryPage() {
  const { inventory, updateInventoryItem, deleteInventoryItem, userRole } = useContext(DataContext);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const LOW_STOCK_THRESHOLD = 10;

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
    
    let outOfStock = 0;
    let expiringSoon = 0;
    let lowStock = 0;

    inventory.forEach(med => {
      const total = med.Batches ? med.Batches.reduce((acc, b) => acc + b.quantity, 0) : 0;
      if (total === 0) outOfStock++;
      else if (total < (med.lowStockThreshold || LOW_STOCK_THRESHOLD)) lowStock++;

      if (med.Batches) {
        const hasExpiring = med.Batches.some(b => {
          const d = new Date(b.expiryDate);
          return d > now && d <= thirtyDays;
        });
        if (hasExpiring) expiringSoon++;
      }
    });

    return { total: inventory.length, outOfStock, expiringSoon, lowStock };
  }, [inventory]);

  // --- Filtering Logic ---
  const filteredInventory = useMemo(() => {
    let result = inventory;

    if (activeTab === "low") {
      result = result.filter(med => {
        const total = med.Batches ? med.Batches.reduce((acc, b) => acc + b.quantity, 0) : 0;
        return total > 0 && total < (med.lowStockThreshold || LOW_STOCK_THRESHOLD);
      });
    } else if (activeTab === "expired") {
      result = result.filter(med => {
        return med.Batches && med.Batches.some(b => new Date(b.expiryDate) < new Date());
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(med => 
        med.name.toLowerCase().includes(q) || 
        (med.genericName && med.genericName.toLowerCase().includes(q)) ||
        (med.category && med.category.toLowerCase().includes(q))
      );
    }

    return result;
  }, [inventory, activeTab, searchQuery]);

  return (
    <div className="inv-container">
      {/* Header Row */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
        <div style={{display:'flex', gap:'1rem'}}>
          <button className="asm-btn asm-btn-secondary" disabled title="Export data is unavailable"><Download size={18} /> Export Data (Unavailable)</button>
          <button className="asm-btn asm-btn-primary" onClick={() => navigate('/add-stock')}>
            <Plus size={18} /> Add New Stock
          </button>
        </div>
      </div>

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
      </div>

      {/* Filter Bar */}
      <div className="inv-filter-bar">
        <div className="inv-tabs">
          <button 
            className={`inv-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >All Inventory</button>
          <button 
            className={`inv-tab ${activeTab === "low" ? "active" : ""}`}
            onClick={() => setActiveTab("low")}
          >Low Stock Items</button>
          <button 
            className={`inv-tab ${activeTab === "expired" ? "active" : ""}`}
            onClick={() => setActiveTab("expired")}
          >Expired Batches</button>
        </div>
        <div style={{position:'relative'}}>
          <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
          <input 
            type="text" 
            className="asm-input" 
            style={{paddingLeft:'38px', width:'320px'}}
            placeholder="Search by name, generic, or SKU..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
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
      />
    </div>
  );
}
