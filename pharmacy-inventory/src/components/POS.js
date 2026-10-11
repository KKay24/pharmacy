import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { 
  Search, ShoppingCart, Trash2, CreditCard, Plus, Minus, 
  ArrowRight, Pause, Tag, Banknote, Smartphone
} from "lucide-react";
import "../styles/posStyles.css";

const PAYMENT_METHODS = ["Cash", "Airtel Money", "MTN Mobile Money", "Card"];

function formatZmw(minorUnits) {
  return `K${(minorUnits / 100).toFixed(2)}`;
}

function parseAmountMinor(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value).trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

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
  categories = [],
  handleSale, 
  customers = [],
  addCustomer,
  cashierName,
  checkoutPending = false,
  clearCartToken,
  checkoutResetToken,
  pendingNotice,
  retryPendingSync
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [activeSubcategoryId, setActiveSubcategoryId] = useState("");
  const [activeFormId, setActiveFormId] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutRetry, setCheckoutRetry] = useState(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState("single");
  const [paymentEntries, setPaymentEntries] = useState([]);
  const submissionLock = useRef(false);
  const checkoutKey = useRef(null);
  const lastCartSignature = useRef(null);

  useEffect(() => {
    if (clearCartToken === undefined) return;
    setSelectedItems([]);
    setSelectedCustomer(null);
    setPaymentEntries([]);
    setPaymentMode("single");
    setPaymentDialogOpen(false);
    checkoutKey.current = null;
    lastCartSignature.current = null;
    setCheckoutRetry(null);
  }, [clearCartToken]);

  useEffect(() => {
    if (checkoutResetToken === undefined) return;
    checkoutKey.current = null;
    lastCartSignature.current = null;
    setCheckoutRetry(null);
  }, [checkoutResetToken]);

  const selectedCategory = categories.find((category) => String(category.id) === activeCategoryId);
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (subcategory) => String(subcategory.id) === activeSubcategoryId
  );
  
  const filteredInventory = inventory.filter(item => {
    const qty = item.Batches ? item.Batches.reduce((acc,b) => acc+b.quantity, 0) : (item.quantity || 0);
    const search = searchText.toLowerCase();
    const matchesSearch = (item.name || "").toLowerCase().includes(search) ||
      (item.genericName || "").toLowerCase().includes(search) ||
      (item.brandName || "").toLowerCase().includes(search);
    const matchesCategory = !activeCategoryId ||
      String(item.mainCategoryId ?? item.MainCategory?.id ?? "") === activeCategoryId ||
      (!item.mainCategoryId && !item.MainCategory && item.category === selectedCategory?.name);
    const matchesSubcategory = !activeSubcategoryId ||
      String(item.subcategoryId ?? item.Subcategory?.id ?? "") === activeSubcategoryId;
    const matchesForm = !activeFormId ||
      String(item.productFormId ?? item.ProductForm?.id ?? "") === activeFormId;
    return matchesSearch && matchesCategory && matchesSubcategory && matchesForm && qty > 0;
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
  const subTotalMinor = selectedItems.reduce(
    (sum, item) => sum + Math.round(Number(item.quantity) * Number(item.price) * 100),
    0,
  );
  const subTotal = subTotalMinor / 100;
  const totalToPay = subTotal;
  const paymentEntryMinor = paymentEntries.map((entry) => parseAmountMinor(entry.amount));
  const allocatedMinor = paymentEntryMinor.reduce((sum, amount) => sum + (amount || 0), 0);
  const remainingMinor = subTotalMinor - allocatedMinor;
  const paymentEntriesValid = paymentEntries.length >= (paymentMode === "split" ? 2 : 1)
    && paymentEntryMinor.every((amount) => amount !== null && amount > 0)
    && remainingMinor === 0
    && paymentEntries.every((entry) => (
      !PAYMENT_METHODS.slice(1).includes(entry.method)
      || (entry.transactionReference.trim().length > 0 && entry.cashierConfirmed)
    ));

  const selectPaymentMethod = (method) => {
    if (method === "Split Payment") {
      const firstAmount = Math.floor(subTotalMinor / 2);
      setPaymentMode("split");
      setPaymentEntries([
        { method: "Cash", amount: formatZmw(firstAmount).slice(1), transactionReference: "", cashierConfirmed: false },
        { method: "Cash", amount: formatZmw(subTotalMinor - firstAmount).slice(1), transactionReference: "", cashierConfirmed: false },
      ]);
      return;
    }
    setPaymentMode("single");
    setPaymentEntries([{
      method,
      amount: (subTotalMinor / 100).toFixed(2),
      transactionReference: "",
      cashierConfirmed: false,
    }]);
  };

  const updatePaymentEntry = (index, changes) => {
    setPaymentEntries((entries) => entries.map((entry, entryIndex) => (
      entryIndex === index ? { ...entry, ...changes } : entry
    )));
  };

  const handlePayment = async () => {
    if (selectedItems.length === 0 || checkoutPending || submissionLock.current) return;
    if (!paymentEntriesValid) return;
    const payments = paymentEntries.map(({ method, amount, transactionReference, cashierConfirmed }) => ({
      method,
      amount: Number(amount),
      ...(transactionReference.trim() ? { transactionReference: transactionReference.trim() } : {}),
      ...(cashierConfirmed ? { cashierConfirmed: true } : {}),
    }));
    const method = payments.length > 1 ? "Split Payment" : payments[0].method;
    const signature = JSON.stringify({
      items: selectedItems.map(({ id, quantity, price }) => [id, quantity, price]),
      payments,
      customerId: selectedCustomer?.id || null,
    });
    if (checkoutRetry && checkoutRetry.signature !== signature) return;
    submissionLock.current = true;
    setIsSubmitting(true);
    try {
      if (!checkoutKey.current || lastCartSignature.current !== signature) {
        const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
        checkoutKey.current = `pos_${Date.now()}_${randomPart}`.slice(0, 128);
        lastCartSignature.current = signature;
      }
      const result = await handleSale({
        items: selectedItems,
        paymentMethod: method,
        payments,
        subTotal,
        totalToPay,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || "Walk-in Customer",
        customerPhone: selectedCustomer?.phone || "",
        customerEmail: selectedCustomer?.email || "",
        clientTransactionId: checkoutKey.current,
      });
      if (result?.success) {
        setSelectedItems([]);
        setSelectedCustomer(null);
        checkoutKey.current = null;
        lastCartSignature.current = null;
        setCheckoutRetry(null);
        setPaymentDialogOpen(false);
      } else if (result?.pending) {
        setCheckoutRetry({ signature, queued: true });
      } else if (result?.retryWithSameId) {
        setCheckoutRetry({ signature, queued: false });
      } else {
        setCheckoutRetry(null);
        checkoutKey.current = null;
        lastCartSignature.current = null;
      }
    } catch (error) {
      toast.error(error.message || "Checkout could not be completed. Your cart has been preserved.");
    } finally {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };

  const cartLocked = checkoutPending || Boolean(checkoutRetry);
  const checkoutDisabled = selectedItems.length === 0 || isSubmitting || checkoutPending;

  return (
    <div className="pos-wrapper">
      <div className="pos-container">
        
        {/* LEFT: Product Selection */}
        <div className="pos-product-section">
          <div className="pos-header">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem', color: '#475569', fontSize: '0.85rem' }}>
              Sold By: <strong style={{ marginLeft: '0.35rem' }}>{cashierName || 'Current cashier'}</strong>
            </div>
            <div className="pos-search-wrapper">
              <Search size={20} color="#64748b" />
              <input 
                type="text" 
                placeholder="Search for medicines or products..." 
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            {categories.length > 0 ? (
              <div className="pos-taxonomy-filters">
                <div className="pos-category-tabs" role="group" aria-label="Main category">
                  <button
                    type="button"
                    className={`pos-category-tab ${activeCategoryId === '' ? 'active' : ''}`}
                    aria-pressed={activeCategoryId === ''}
                    onClick={() => {
                      setActiveCategoryId("");
                      setActiveSubcategoryId("");
                      setActiveFormId("");
                    }}
                  >
                    All
                  </button>
                  {categories.map((category) => (
                    <button
                      type="button"
                      key={category.id}
                      className={`pos-category-tab ${activeCategoryId === String(category.id) ? 'active' : ''}`}
                      aria-pressed={activeCategoryId === String(category.id)}
                      onClick={() => {
                        setActiveCategoryId(String(category.id));
                        setActiveSubcategoryId("");
                        setActiveFormId("");
                      }}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                {selectedCategory && (
                  <div className="pos-category-tabs pos-subcategory-tabs" role="group" aria-label="Subcategory">
                    <button
                      type="button"
                      className={`pos-category-tab ${activeSubcategoryId === '' ? 'active' : ''}`}
                      aria-pressed={activeSubcategoryId === ''}
                      onClick={() => {
                        setActiveSubcategoryId("");
                        setActiveFormId("");
                      }}
                    >
                      All subcategories
                    </button>
                    {selectedCategory.subcategories.map((subcategory) => (
                      <button
                        type="button"
                        key={subcategory.id}
                        className={`pos-category-tab ${activeSubcategoryId === String(subcategory.id) ? 'active' : ''}`}
                        aria-pressed={activeSubcategoryId === String(subcategory.id)}
                        onClick={() => {
                          setActiveSubcategoryId(String(subcategory.id));
                          setActiveFormId("");
                        }}
                      >
                        {subcategory.name}
                      </button>
                    ))}
                  </div>
                )}
                {selectedSubcategory && (
                  <div className="pos-category-tabs pos-form-tabs" role="group" aria-label="Product form">
                    <button
                      type="button"
                      className={`pos-category-tab ${activeFormId === '' ? 'active' : ''}`}
                      aria-pressed={activeFormId === ''}
                      onClick={() => setActiveFormId("")}
                    >
                      All forms
                    </button>
                    {selectedSubcategory.forms.map((form) => (
                      <button
                        type="button"
                        key={form.id}
                        className={`pos-category-tab ${activeFormId === String(form.id) ? 'active' : ''}`}
                        aria-pressed={activeFormId === String(form.id)}
                        onClick={() => setActiveFormId(String(form.id))}
                      >
                        {form.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="pos-taxonomy-error" role="status">
                Product categories are unavailable. Refresh inventory to load category filters.
              </p>
            )}
          </div>

          <div className="pos-grid">
            {filteredInventory.map((item) => {
              const img = getProductImage(item);
              return (
                <div key={item.id} className="pos-product-card" onClick={() => !cartLocked && !isSubmitting && addToCart(item)}>
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
            <button className="pos-qty-btn" onClick={() => setSelectedItems([])} title="Clear Cart" disabled={isSubmitting || cartLocked}>
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
                    <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.quantity - 1)} disabled={isSubmitting || cartLocked}><Minus size={12} /></button>
                    <span className="pos-qty-val">{item.quantity}</span>
                    <button className="pos-qty-btn" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={isSubmitting || cartLocked}><Plus size={12} /></button>
                  </div>
                  <div className="pos-cart-item-total">K{((item.price || 0) * (item.quantity || 0)).toLocaleString()}</div>
                  <button style={{background:'none', border:'none', color:'#cbd5e1', cursor:'pointer'}} onClick={() => removeItem(item.id)} disabled={isSubmitting || cartLocked}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="pos-checkout-footer">
            <div className="pos-summary-row">
              <span>Subtotal</span>
              <span>{formatZmw(subTotalMinor)}</span>
            </div>
            <div className="pos-summary-total">
              <span>Total</span>
              <span>{formatZmw(subTotalMinor)}</span>
            </div>
            {pendingNotice && (
              <div role="status" style={{ color: checkoutPending ? '#b45309' : '#b91c1c', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                <p>{pendingNotice}</p>
                {checkoutPending && (
                  <button type="button" className="pos-tool-btn" onClick={retryPendingSync}>
                    Retry syncing sale
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="pos-payment-trigger"
              disabled={checkoutDisabled || Boolean(checkoutRetry?.queued)}
              onClick={() => setPaymentDialogOpen(true)}
            >
              <CreditCard size={18} />
              Payment Method
            </button>
            {paymentDialogOpen && (
              <div className="pos-payment-backdrop" onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSubmitting) setPaymentDialogOpen(false);
              }}>
                <section className="pos-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="pos-payment-title">
                  <div className="pos-payment-dialog-heading">
                    <h3 id="pos-payment-title">Choose payment method</h3>
                    <button type="button" onClick={() => setPaymentDialogOpen(false)} disabled={isSubmitting} aria-label="Close payment dialog">×</button>
                  </div>
                  {!paymentEntries.length ? (
                    <div className="pos-payment-options">
                      {PAYMENT_METHODS.map((method) => (
                        <button type="button" key={method} onClick={() => selectPaymentMethod(method)}>
                          {method === "Cash" ? <Banknote size={18} /> : <Smartphone size={18} />}
                          {method}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={subTotalMinor < 2}
                        title={subTotalMinor < 2 ? "A split payment requires at least K0.02" : undefined}
                        onClick={() => selectPaymentMethod("Split Payment")}
                      >
                        <CreditCard size={18} /> Split Payment
                      </button>
                    </div>
                  ) : (
                    <div className="pos-payment-form">
                      <p className="pos-payment-total">Sale total: <strong>{formatZmw(subTotalMinor)}</strong></p>
                      <p className="pos-payment-guidance">
                        Complete mobile money or card payment with the provider first. Enter its reference and confirm only after verifying that it succeeded.
                      </p>
                      {paymentEntries.map((entry, index) => (
                        <fieldset className="pos-payment-entry" key={index}>
                          <legend>Payment {index + 1}</legend>
                          <label>
                            Method
                            <select
                              aria-label={`Payment method ${index + 1}`}
                              value={entry.method}
                              disabled={isSubmitting}
                              onChange={(event) => updatePaymentEntry(index, {
                                method: event.target.value,
                                transactionReference: "",
                                cashierConfirmed: false,
                              })}
                            >
                              {PAYMENT_METHODS.map((methodName) => <option key={methodName} value={methodName}>{methodName}</option>)}
                            </select>
                          </label>
                          <label>
                            Amount (ZMW)
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              aria-label={`Payment amount ${index + 1}`}
                              value={entry.amount}
                              disabled={isSubmitting}
                              onChange={(event) => updatePaymentEntry(index, { amount: event.target.value })}
                            />
                          </label>
                          {PAYMENT_METHODS.slice(1).includes(entry.method) && (
                            <>
                              <label>
                                Transaction reference
                                <input
                                  type="text"
                                  maxLength={120}
                                  value={entry.transactionReference}
                                  disabled={isSubmitting}
                                  onChange={(event) => updatePaymentEntry(index, { transactionReference: event.target.value })}
                                  required
                                />
                              </label>
                              <label className="pos-payment-confirmation">
                                <input
                                  type="checkbox"
                                  checked={entry.cashierConfirmed}
                                  disabled={isSubmitting}
                                  onChange={(event) => updatePaymentEntry(index, { cashierConfirmed: event.target.checked })}
                                />
                                I verified this payment succeeded
                              </label>
                            </>
                          )}
                          {paymentMode === "split" && paymentEntries.length > 2 && (
                            <button
                              type="button"
                              className="pos-payment-remove"
                              disabled={isSubmitting}
                              onClick={() => setPaymentEntries((entries) => entries.filter((_, entryIndex) => entryIndex !== index))}
                            >
                              Remove payment
                            </button>
                          )}
                        </fieldset>
                      ))}
                      {paymentMode === "split" && (
                        <button
                          type="button"
                          className="pos-payment-add"
                          disabled={isSubmitting || paymentEntries.length >= 10}
                          onClick={() => setPaymentEntries((entries) => [...entries, {
                            method: "Cash",
                            amount: "0.00",
                            transactionReference: "",
                            cashierConfirmed: false,
                          }])}
                        >
                          <Plus size={15} /> Add payment
                        </button>
                      )}
                      <div className="pos-payment-balance" aria-live="polite">
                        <span>Allocated: {formatZmw(allocatedMinor)}</span>
                        <span className={remainingMinor < 0 ? "is-overpaid" : ""}>
                          {remainingMinor >= 0 ? "Remaining" : "Over by"}: {formatZmw(Math.abs(remainingMinor))}
                        </span>
                      </div>
                      {!paymentEntriesValid && (
                        <p className="pos-payment-validation" role="alert">
                          Enter valid payment amounts that exactly equal the sale total. Electronic payments need a reference and cashier confirmation.
                        </p>
                      )}
                      <div className="pos-payment-dialog-actions">
                        <button type="button" onClick={() => {
                          setPaymentEntries([]);
                          setPaymentMode("single");
                        }} disabled={isSubmitting}>Back</button>
                        <button
                          type="button"
                          className="pos-payment-confirm"
                          onClick={handlePayment}
                          disabled={checkoutDisabled || !paymentEntriesValid}
                        >
                          {isSubmitting ? "Recording…" : "Confirm Payment"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}
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
