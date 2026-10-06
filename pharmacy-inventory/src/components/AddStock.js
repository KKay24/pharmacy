import React, { useState, useMemo } from "react";
import { 
    Plus, 
    Trash2, 
    ScanLine, 
    ChevronRight, 
    Package, 
    Loader,
    FileText
} from "lucide-react";
import Tesseract from "tesseract.js";
import * as pdfjsLib from 'pdfjs-dist';
import { parseInvoiceText } from "../utils/invoiceParser";
import "../styles/add-stock-modern.css";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const WAREHOUSES = ["Warehouse A", "Warehouse B", "Head Office", "Satellite Stacker"];

export default function AddStock({
    items,
    setItems,
    metadata,
    setMetadata,
    onNext,
    onCancel,
    inventory,
    categories = [],
    categoriesError,
    suppliers = [],
    onFastCapture,
    isSubmitting = false,
}) {
    const [activeTab, setActiveTab] = useState("details");
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState("");
    const [rawText, setRawText] = useState("");
    const [showDebug, setShowDebug] = useState(false);

    // --- Math Calculations ---
    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.costPrice || 0) * parseInt(item.quantity || 0)), 0);
        return { subtotal, total: subtotal };
    }, [items]);

    // --- Row Management ---
    const addRow = () => {
        setItems([...items, { 
            id: Date.now(), 
            name: "", 
            genericName: "",
            brandName: "",
            strength: "",
            packSize: "",
            unitOfMeasure: "",
            reorderLevel: "",
            mainCategoryId: "",
            subcategoryId: "",
            productFormId: "",
            dosage: "",
            sku: "", 
            costPrice: "", 
            quantity: "", 
            sellingPrice: "",
            expiryDate: "", 
            batchNumber: "" 
        }]);
    };

    const removeRow = (id) => {
        if (items.length === 1) return;
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id, field, value) => {
        setItems(items.map(i => {
            if (i.id !== id) return i;
            return {
                ...i,
                [field]: value,
                ...(field === "mainCategoryId" ? { subcategoryId: "", productFormId: "", dosage: "" } : {}),
                ...(field === "subcategoryId" ? { productFormId: "", dosage: "" } : {}),
            };
        }));
    };

    // --- OCR & PDF Logic ---
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsScanning(true);
        setScanProgress("Reading file...");

        if (file.type === "application/pdf") {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                
                let fullText = "";
                let hasText = false;

                // 1. Try Digital Text Extraction first
                for (let i = 1; i <= pdf.numPages; i++) {
                    setScanProgress(`Extracting Text (Page ${i}/${pdf.numPages})...`);
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    if (pageText.trim().length > 10) {
                        fullText += pageText + "\n";
                        hasText = true;
                    }
                }

                // 2. Fallback to OCR if no text found (Scanned PDF)
                if (!hasText) {
                    setScanProgress("Scanned PDF detected. Starting OCR...");
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement("canvas");
                        const context = canvas.getContext("2d");
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;

                        await page.render({ canvasContext: context, viewport }).promise;
                        
                        const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
                            logger: m => m.status === 'recognizing text' && setScanProgress(`OCR Page ${i}: ${Math.round(m.progress * 100)}%`)
                        });
                        fullText += text + "\n";
                    }
                }

                console.log("DEBUG: Raw Extracted Text:\n", fullText);
                setRawText(fullText);
                parseInvoice(fullText);
            } catch (err) {
                console.error("PDF Extraction Error:", err);
                setScanProgress("Error parsing PDF");
            } finally {
                setIsScanning(false);
            }
        } else {
            // Standard Image OCR
            setScanProgress("Starting OCR...");
            Tesseract.recognize(file, 'eng', {
                logger: m => m.status === 'recognizing text' && setScanProgress(`Scanning ${Math.round(m.progress * 100)}%`)
            }).then(({ data: { text } }) => {
                console.log("DEBUG: Raw OCR Text:\n", text);
                setRawText(text);
                parseInvoice(text);
                setIsScanning(false);
            }).catch(err => {
                setScanProgress("OCR failed");
                setIsScanning(false);
            });
        }
    };

    const parseInvoice = (text) => {
        const result = parseInvoiceText(text, inventory, suppliers);
        const { items: extractedItems, metadata: extractedMeta } = result;

        if (extractedItems.length > 0) {
            import("react-hot-toast").then(({ default: toast }) => {
                toast.success(`Successfully extracted ${extractedItems.length} items!`);
            });

            // 1. Update Items
            if (items.length === 1 && !items[0].name) {
                setItems(extractedItems);
            } else {
                setItems([...items, ...extractedItems]);
            }

            // 2. Update Metadata if found
            const newMeta = { ...metadata };
            let metaUpdated = false;

            if (extractedMeta.invoiceNumber && !metadata.invoiceNumber) {
                newMeta.invoiceNumber = extractedMeta.invoiceNumber;
                metaUpdated = true;
            }
            if (extractedMeta.orderDate && (!metadata.orderDate || metadata.orderDate === new Date().toISOString().split('T')[0])) {
                newMeta.orderDate = extractedMeta.orderDate;
                metaUpdated = true;
            }
            if (extractedMeta.supplierId && !metadata.supplierId) {
                newMeta.supplierId = extractedMeta.supplierId;
                metaUpdated = true;
            }

            if (metaUpdated) {
                setMetadata(newMeta);
            }
        } else {
            import("react-hot-toast").then(({ default: toast }) => {
                toast.error("No items detected. Please ensure the invoice is clear.");
            });
        }
    };

    return (
        <div className="asm-container">
            {/* Header */}
            <div className="asm-header">
                <button 
                    className="asm-upload-card" 
                    onClick={() => document.getElementById('invoice-up').click()}
                    style={{border: isScanning ? 'none' : ''}}
                >
                    <input 
                        type="file" 
                        id="invoice-up" 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload} 
                        accept="image/*,application/pdf"
                    />
                    {isScanning ? (
                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem'}}>
                            <Loader className="spin" size={32} color="var(--primary)" />
                            <span style={{fontWeight:600}}>{scanProgress}</span>
                        </div>
                    ) : (
                        <>
                            <ScanLine size={32} color="var(--primary)" />
                            <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                <span style={{fontWeight:600}}>Upload Invoice (PDF/Img)</span>
                                <span style={{fontSize:'0.8rem', color:'#64748B'}}>Auto-extract products and batches</span>
                            </div>
                        </>
                    )}
                </button>

                {rawText && (
                    <button 
                        onClick={() => setShowDebug(true)}
                        style={{marginTop:'0.5rem', background:'none', border:'none', color:'var(--primary)', cursor:'pointer', fontSize:'0.85rem', textDecoration:'underline', display:'flex', alignItems:'center', gap:'4px', margin:'0 auto'}}
                    >
                        <FileText size={14} /> View Raw Scan Log
                    </button>
                )}
                <div className="asm-header-copy">
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                        <Package size={24} color="var(--primary)" />
                        <h1>Add New Stock</h1>
                    </div>
                    <p>Enter details or scan invoice to add products.</p>
                    {categoriesError && <p role="alert" style={{ color: "#b91c1c" }}>Category options could not be loaded: {categoriesError}. Refresh and try again.</p>}
                </div>
                
            </div>

            {/* Tabs */}
            <div className="asm-tabs">
                <button 
                    className={`asm-tab ${activeTab === "details" ? "active" : ""}`}
                    onClick={() => setActiveTab("details")}
                >
                    Stock Details
                </button>
                <button 
                    className={`asm-tab ${activeTab === "review" ? "active" : ""}`}
                    onClick={() => setActiveTab("review")}
                >
                    Review & Confirm
                </button>
            </div>

            {/* Settings Card */}
            <div className="asm-settings-card">
                <div className="asm-field">
                    <label>Assigned Supplier</label>
                    <select 
                        className="asm-input" 
                        value={metadata.supplierId} 
                        onChange={e => setMetadata({...metadata, supplierId: e.target.value})}
                    >
                        <option value="">Select a verified partner...</option>
                        {suppliers.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                    </select>
                </div>
                <div className="asm-field">
                    <label>Destination Warehouse</label>
                    <select 
                        className="asm-input"
                        value={metadata.warehouse}
                        onChange={e => setMetadata({...metadata, warehouse: e.target.value})}
                    >
                        {WAREHOUSES.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                </div>
                <div className="asm-field">
                    <label>Invoice Date</label>
                    <input 
                        type="date" 
                        className="asm-input"
                        value={metadata.orderDate}
                        onChange={e => setMetadata({...metadata, orderDate: e.target.value})}
                    />
                </div>
            </div>

            {/* Grid Area */}
            {activeTab === "details" ? (
                <div className="asm-grid-card">
                    <div className="asm-grid-scroll" role="region" aria-label="Stock items" tabIndex={0}>
                        <table className="asm-grid-table">
                            <colgroup>
                                <col style={{ width: 40 }} />
                                <col className="asm-product-column" />
                                <col style={{ width: 140 }} />
                                <col style={{ width: 120 }} />
                                <col style={{ width: 110 }} />
                                <col style={{ width: 150 }} />
                                <col style={{ width: 145 }} />
                                <col style={{ width: 145 }} />
                                <col style={{ width: 110 }} />
                                <col style={{ width: 130 }} />
                                <col style={{ width: 64 }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th><input type="checkbox" /></th>
                                    <th className="asm-product-column">Product</th>
                                    <th>Form</th>
                                    <th>Status</th>
                                    <th>SKU</th>
                                    <th>Expiry Date</th>
                                    <th>Purchase Cost</th>
                                    <th>Current Price</th>
                                    <th>Quantity</th>
                                    <th>Total Cost</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const isInvalid = !item.name || !item.quantity || item.quantity === "0" || !item.costPrice || item.costPrice === "0";
                                    const selectedCategory = categories.find((category) => String(category.id) === String(item.mainCategoryId));
                                    const selectedSubcategory = selectedCategory?.subcategories.find(
                                        (subcategory) => String(subcategory.id) === String(item.subcategoryId)
                                    );
                                    const selectedForm = selectedSubcategory?.forms.find(
                                        (form) => String(form.id) === String(item.productFormId)
                                    );
                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr className={`asm-product-row${isInvalid ? " asm-row-invalid" : ""}`}>
                                                <td><input type="checkbox" /></td>
                                                <td className="asm-product-column asm-product-cell">
                                                    <div className="asm-product-entry">
                                                        <div className="asm-product-icon">
                                                            <Package size={16} color="#94a3b8" />
                                                        </div>
                                                        <input
                                                            className="asm-product-input"
                                                            type="text"
                                                            aria-label="Product name"
                                                            placeholder="Product name"
                                                            value={item.name}
                                                            onChange={e => updateItem(item.id, "name", e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                                <td>
                                                    <select
                                                        className="asm-row-input asm-select-input"
                                                        aria-label="Product form"
                                                        disabled={!selectedSubcategory}
                                                        value={item.productFormId || ""}
                                                        onChange={e => updateItem(item.id, "productFormId", e.target.value)}
                                                    >
                                                        <option value="">{selectedForm?.name || item.dosage || "Select form"}</option>
                                                        {selectedSubcategory?.forms.map(form => (
                                                            <option key={form.id} value={form.id}>{form.name}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="asm-status-cell">
                                                    {item.isExisting ? (
                                                        <span className="asm-status-badge asm-status-matched">Matched</span>
                                                    ) : (
                                                        <span className="asm-status-badge asm-status-new">⚠ New item</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <input
                                                        className="asm-row-input"
                                                        aria-label="SKU"
                                                        placeholder="P-00X"
                                                        value={item.sku}
                                                        onChange={e => updateItem(item.id, "sku", e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="asm-date-picker"
                                                        type="date"
                                                        aria-label="Expiry date"
                                                        value={item.expiryDate || ""}
                                                        onChange={e => updateItem(item.id, "expiryDate", e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <label className="asm-currency-input">
                                                        <span aria-hidden="true">K</span>
                                                        <input
                                                            className="asm-row-input"
                                                            aria-label="Purchase cost"
                                                            type="number"
                                                            value={item.costPrice}
                                                            onChange={e => updateItem(item.id, "costPrice", e.target.value)}
                                                        />
                                                    </label>
                                                </td>
                                                <td>
                                                    <label className="asm-currency-input">
                                                        <span aria-hidden="true">K</span>
                                                        <input
                                                            className="asm-row-input"
                                                            aria-label="Current price"
                                                            type="number"
                                                            value={item.sellingPrice}
                                                            onChange={e => updateItem(item.id, "sellingPrice", e.target.value)}
                                                        />
                                                    </label>
                                                </td>
                                                <td>
                                                    <input
                                                        className="asm-row-input asm-quantity-input"
                                                        aria-label="Quantity"
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={e => updateItem(item.id, "quantity", e.target.value)}
                                                    />
                                                </td>
                                                <td className="asm-total-cell">
                                                    K{(parseFloat(item.costPrice || 0) * parseInt(item.quantity || 0)).toLocaleString()}
                                                </td>
                                                <td className="asm-action-cell">
                                                    <button
                                                        aria-label={`Remove ${item.name || "product"} row`}
                                                        onClick={() => removeRow(item.id)}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                            <tr className="asm-product-details-row">
                                                <td colSpan={11}>
                                                    <div className="asm-product-details">
                                                        <select className="asm-row-input asm-select-input" aria-label="Main category" required value={item.mainCategoryId || ""} onChange={e => updateItem(item.id, "mainCategoryId", e.target.value)}>
                                                            <option value="">Main category *</option>
                                                            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                                        </select>
                                                        <select className="asm-row-input asm-select-input" aria-label="Subcategory" disabled={!selectedCategory} value={item.subcategoryId || ""} onChange={e => updateItem(item.id, "subcategoryId", e.target.value)}>
                                                            <option value="">Subcategory (optional)</option>
                                                            {selectedCategory?.subcategories.map(subcategory => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                                                        </select>
                                                        <input className="asm-row-input" aria-label="Generic name" placeholder="Generic name" value={item.genericName || ""} onChange={e => updateItem(item.id, "genericName", e.target.value)} />
                                                        <input className="asm-row-input" aria-label="Brand name" placeholder="Brand name" value={item.brandName || ""} onChange={e => updateItem(item.id, "brandName", e.target.value)} />
                                                        <input className="asm-row-input" aria-label="Strength" placeholder="Strength" value={item.strength || ""} onChange={e => updateItem(item.id, "strength", e.target.value)} />
                                                        <input className="asm-row-input" aria-label="Pack size" placeholder="Pack size" value={item.packSize || ""} onChange={e => updateItem(item.id, "packSize", e.target.value)} />
                                                        <input className="asm-row-input" aria-label="Unit of measure" placeholder="Unit of measure" value={item.unitOfMeasure || ""} onChange={e => updateItem(item.id, "unitOfMeasure", e.target.value)} />
                                                        <input className="asm-row-input" aria-label="Reorder level" placeholder="Reorder level" type="number" min="0" value={item.reorderLevel || ""} onChange={e => updateItem(item.id, "reorderLevel", e.target.value)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid #f1f5f9'}}>
                        <button className="asm-tab" style={{color:'var(--primary)', padding:0}} onClick={addRow}>
                            <Plus size={16} /> Add Product
                        </button>
                    </div>

                    <div className="asm-totals-panel">
                        <div className="asm-total-row">
                            <span className="asm-total-label">Subtotal</span>
                            <span className="asm-total-value">K{totals.subtotal.toLocaleString()}</span>
                        </div>

                        <div className="asm-total-row asm-total-grand">
                            <span className="asm-total-label" style={{color:'#1e293b', fontWeight:700}}>Total Amount</span>
                            <span className="asm-total-value">K{totals.total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="asm-grid-card" style={{padding:'2rem'}}>
                    <h3 style={{marginTop:0}}>Batch Summary</h3>
                    <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                        {items.filter(i => i.name).map(item => (
                            <div key={item.id} style={{display:'flex', justifyContent:'space-between', paddingBottom:'0.5rem', borderBottom:'1px solid #f1f5f9'}}>
                                <div>
                                    <div style={{fontWeight:700}}>{item.name}</div>
                                    <div style={{fontSize:'0.8rem', color:'#64748b'}}>
                                        {[categories.find(category => String(category.id) === String(item.mainCategoryId))?.name,
                                          categories.flatMap(category => category.subcategories).find(subcategory => String(subcategory.id) === String(item.subcategoryId))?.name,
                                          categories.flatMap(category => category.subcategories).flatMap(subcategory => subcategory.forms).find(form => String(form.id) === String(item.productFormId))?.name].filter(Boolean).join(' › ')}
                                    </div>
                                    <div style={{fontSize:'0.8rem', color:'#64748b'}}>Qty: {item.quantity} | Batch: {item.batchNumber}</div>
                                </div>
                                <div style={{fontWeight:700}}>K{(parseFloat(item.costPrice || 0) * parseInt(item.quantity || 0)).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showDebug && (
                <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
                    <div style={{background:'white', width:'80%', height:'80%', borderRadius:12, padding:'2rem', display:'flex', flexDirection:'column'}}>
                        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'1rem'}}>
                            <h3>Raw Scanner Output</h3>
                            <button className="asm-btn asm-btn-secondary" onClick={() => setShowDebug(false)}>Close</button>
                        </div>
                        <p style={{color:'#64748b', fontSize:'0.9rem', marginBottom:'1rem'}}>Use this text to verify what the computer read from your image. If items are missing, it's often because the text here is too messy.</p>
                        <textarea 
                            readOnly 
                            value={rawText} 
                            style={{flex:1, borderRadius:8, border:'1px solid #e2e8f0', padding:'1rem', fontFamily:'monospace', fontSize:'0.85rem', background:'#f8fafc'}}
                        />
                    </div>
                </div>
            )}

            {/* Additional Notes */}
            <div className="asm-grid-card" style={{padding:'1.5rem'}}>
                <label style={{fontSize:'0.85rem', fontWeight:600, color:'#475569', display:'block', marginBottom:'0.75rem'}}>Additional Notes</label>
                <textarea 
                    className="asm-input" 
                    style={{width:'100%', minHeight:'80px', resize:'none'}}
                    placeholder="Enter any additional notes..."
                    value={metadata.notes}
                    onChange={e => setMetadata({...metadata, notes: e.target.value})}
                ></textarea>
            </div>

            {/* Footer */}
            <div className="asm-footer">
                <button className="asm-btn asm-btn-secondary" onClick={onCancel}>Cancel</button>
                <div style={{display:'flex', gap:'1rem'}}>
                    {activeTab === "details" ? (
                        <button className="asm-btn asm-btn-primary" onClick={() => setActiveTab("review")}>
                            Review Batch <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button className="asm-btn asm-btn-primary" onClick={onNext} disabled={isSubmitting} style={{background: 'var(--primary)'}}>
                            {isSubmitting ? "Saving Stock…" : "Confirm & Save Stock"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
