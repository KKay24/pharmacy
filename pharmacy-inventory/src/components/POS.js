import React, { useState } from "react";
import { 
  Search, ShoppingCart, Trash2, CreditCard, Plus, Minus, 
  ArrowRight, Pause, Tag, Layers, Banknote, Split
} from "lucide-react";
import "../styles/posStyles.css";

const PRODUCT_IMAGES = {
  pill: { label: "TAB", background: "#dbeafe", foreground: "#1d4ed8" },
  syrup: { label: "SYP", background: "#fee2e2", foreground: "#b91c1c" },
  kit: { label: "KIT", background: "#dcfce7", foreground: "#15803d" },
  inhaler: { label: "AIR", background: "#ede9fe", foreground: "#6d28d9" },
  vitamins: { label: "VIT", background: "#fef3c7", foreground: "#b45309" }
};

const renderPlaceholderImage = ({ label, background, foreground }) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="110" height="60" viewBox="0 0 110 60">
      <rect width="110" height="60" rx="8" fill="${background}" />
      <circle cx="55" cy="22" r="14" fill="${foreground}" opacity="0.15" />
      <text x="55" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${foreground}">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const getProductImage = (item) => {
  if (item.imageUrl) return item.imageUrl;
  
  const name = item.name || "";
  const n = name.toLowerCase();
  if (n.includes('pill') || n.includes('tablet') || n.includes('capsule')) return renderPlaceholderImage(PRODUCT_IMAGES.pill);
  if (n.includes('syrup') || n.includes('solution') || n.includes('liquid') || n.includes('suspension')) return renderPlaceholderImage(PRODUCT_IMAGES.syrup);
  if (n.includes('kit') || n.includes('aid') || n.includes('emergency')) return renderPlaceholderImage(PRODUCT_IMAGES.kit);
  if (n.includes('inhaler') || n.includes('spray') || n.includes('breath')) return renderPlaceholderImage(PRODUCT_IMAGES.inhaler);
  if (n.includes('vitamin') || n.includes('supplement')) return renderPlaceholderImage(PRODUCT_IMAGES.vitamins);
  return null;
};

function Pos({ 
  inventory = [], 
  handleSale, 
  customers = [],
  addCustomer
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // 1. Filtering Logic
  const categories = ["All", "Tablets", "Syrups", "Antibiotics", "Supplements", "Equipment"];
  
  const filteredInventory = inventory.filter(item => {
    const qty = item.Batches ? item.Batches.reduce((acc,b) => acc+b.quantity, 0) : (item.quantity || 0);
    const matchesSearch = item.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesCategory = activeCategory === "All" || (item.category && item.category === activeCategory);
    return matchesSearch && matchesCategory && qty > 0;
  });

  // 2. Cart Helpers
  const getStock = (item) => item.Batches ? item.Batches.reduce((acc,b) => acc+b.quantity, 0) : (item.quantity || 0);
  const getPrice = (item) => {
    if (item.Batches && item.Batches.length > 0) return item.Batches[item.Batches.length-1].sellingPrice || 0;
    return item.price || 0;
  };

  const addToCart = (medicine) => {
    const existing = selectedItems.find(i => i.id === medicine.id);
    const stock = getStock(medicine);
    const price = getPrice(medicine);
    
    if (existing) {
      if (existing.quantity < stock) {
        updateQuantity(medicine.id, existing.quantity + 1);
      }
    } else {
      setSelectedItems([...selectedItems, {
        id: medicine.id,
        name: medicine.name,
        price: price,
        quantity: 1,
        stock: stock,
      }]);
    }
  };

  const updateQuantity = (id, newQty) => {
    setSelectedItems(selectedItems.map(item => {
      if (item.id === id) {
        const validQty = Math.max(1, Math.min(newQty, item.stock));
        return { ...item, quantity: validQty };
      }
      return item;
    }));
  };

  const removeItem = (id) => setSelectedItems(selectedItems.filter(item => item.id !== id));

  // 3. Totals
  const subTotal = selectedItems.reduce((acc, item) => acc + item.quantity * item.price, 0);
  const totalToPay = subTotal;

  const handlePayment = async (method) => {
    if (selectedItems.length === 0) return;
    const saleData = {
      items: selectedItems,
      paymentMethod: method,
      subTotal,
      totalToPay,
      customerId: selectedCustomer?.id || null,
      customerName: selectedCustomer?.name || "Walk-in Customer"
    };
    const result = await handleSale(saleData);
    if (result?.success) {
      setSelectedItems([]);
      setSelectedCustomer(null);
    }
  };

  return (
    <div className="pos-wrapper">
      <div className="pos-container">
        
        {/* LEFT: Product Selection */}
        <div className="pos-product-section">
          <div className="pos-header">
            <div className="pos-search-wrapper">
              <Search size={20} color="#64748b" />
              <input 
                type="text" 
                placeholder="Search for medicines or products..." 
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <div className="pos-category-tabs">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  className={`pos-category-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="pos-grid">
            {filteredInventory.map((item) => {
              const img = getProductImage(item);
              return (
                <div key={item.id} className="pos-product-card" onClick={() => addToCart(item)}>
                  <div className="pos-product-image">
                    {img ? (
                      <img src={img} alt={item.name} />
                    ) : (
                      <div className="pos-product-placeholder">{item.name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="pos-product-info">
                    <span className="pos-product-name">{item.name}</span>
                    <span className="pos-product-price">K{(getPrice(item) || 0).toLocaleString()}</span>
                    <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>Stock: {getStock(item)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Cart Sidebar */}
        <div className="pos-cart-section">
          <div className="pos-cart-header">
            <h2>Shopping Cart</h2>
            <button className="pos-qty-btn" onClick={() => setSelectedItems([])} title="Clear Cart">
              <Trash2 size={16} color="#ef4444" />
            </button>
          </div>

          <div className="pos-cart-list">
            {selectedItems.length === 0 ? (
              <div style={{height: '100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#94a3b8', gap:'1rem'}}>
                <ShoppingCart size={64} opacity={0.2} />
                <p>Cart is currently empty</p>
              </div>
            ) : (
              selectedItems.map(item => (
                <div key={item.id} className="pos-cart-item">
                  <div className="pos-cart-item-info">
                    <span className="pos-cart-item-name">{item.name}</span>
                    <span className="pos-cart-item-price">K{(item.price || 0).toLocaleString()}</span>
                  </div>
                  <div className="pos-cart-controls">
                    <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)}><Minus size={12} /></button>
                    <span className="pos-qty-val">{item.quantity}</span>
                    <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)}><Plus size={12} /></button>
                  </div>
                  <div className="pos-cart-item-total">K{((item.price || 0) * (item.quantity || 0)).toLocaleString()}</div>
                  <button style={{background:'none', border:'none', color:'#cbd5e1', cursor:'pointer'}} onClick={() => removeItem(item.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pos-checkout-footer">
            <div className="pos-summary-row">
              <span>Subtotal</span>
              <span>K{(subTotal || 0).toLocaleString()}</span>
            </div>
            <div className="pos-summary-total">
              <span>Total</span>
              <span>K{(totalToPay || 0).toLocaleString()}</span>
            </div>

            <div className="pos-payment-methods">
              <button className="pos-pay-btn cash" onClick={() => handlePayment('Cash')}>
                <Banknote size={20} />
                Cash
              </button>
              <button className="pos-pay-btn card" onClick={() => handlePayment('Card')}>
                <CreditCard size={20} />
                Credit Card
              </button>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem'}}>
                <button className="pos-category-tab" style={{width:'100%', padding:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}} disabled title="Split payments are unavailable">
                  <Split size={16} /> Split Payment (Unavailable)
                </button>
                <button className="pos-category-tab" style={{width:'100%', padding:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}} disabled title="Additional payment methods are unavailable">
                  <Layers size={16} /> More Methods (Unavailable)
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM TOOLBAR */}
      <div className="pos-bottom-bar">
        <div className="pos-toolbar-group">
          <button className="pos-tool-btn" disabled title="Discounts are unavailable"><Tag size={16} /> Apply Discount (Unavailable)</button>
          <button className="pos-tool-btn"><Plus size={16} /> New Item</button>
        </div>
        <div className="pos-toolbar-group">
          <button className="pos-tool-btn" disabled title="Held orders are unavailable"><Pause size={16} /> Hold Order (Unavailable)</button>
          <button className="pos-tool-btn" style={{background:'var(--primary)'}} disabled title="Checkout all is unavailable"><ArrowRight size={16} /> Checkout All (Unavailable)</button>
        </div>
      </div>
    </div>
  );
}

export default Pos;
