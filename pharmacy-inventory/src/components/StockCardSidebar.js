import React, { useState, useEffect } from "react";
import { 
    X, 
    Info, 
    History, 
    MapPin, 
    Truck, 
    ShieldCheck, 
    BarChart3,
    ArrowRightLeft,
    Printer,
    Edit,
    Save,
    ImagePlus,
    Trash2
} from "lucide-react";
import { useRef } from "react";
import toast from "react-hot-toast";

// Safe date formatter to prevent RangeError: 'Invalid time value' on bad data
const safeFormatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString).substring(0, 10);
    return d.toISOString().split('T')[0];
};

export default function StockCardSidebar({ medicine, onClose, onUpdate, categories = [] }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (medicine) {
            const currentTotal = medicine.Batches ? medicine.Batches.reduce((acc, b) => acc + b.quantity, 0) : 0;
            const currentPrice = (medicine.Batches && medicine.Batches.length > 0) ? medicine.Batches[0].sellingPrice : 0;
            const currentCost = (medicine.Batches && medicine.Batches.length > 0) ? medicine.Batches[0].costPrice : 0;
            setEditedData({ 
                ...medicine,
                totalQuantity: currentTotal,
                sellingPrice: currentPrice,
                costPrice: currentCost
            });
            setIsEditing(false);
        }
    }, [medicine]);

    if (!medicine || !editedData) return null;

    const totalQty = medicine.Batches ? medicine.Batches.reduce((acc, b) => acc + b.quantity, 0) : 0;
    const batches = medicine.Batches || [];
    const selectedCategory = categories.find((category) =>
        Number(category.id) === Number(editedData.mainCategoryId)
    );
    const selectedSubcategory = selectedCategory?.subcategories.find((subcategory) =>
        Number(subcategory.id) === Number(editedData.subcategoryId)
    );
    const changeClassification = (field, value) => {
        setEditedData((current) => ({
            ...current,
            [field]: value,
            ...(field === 'mainCategoryId' ? { subcategoryId: '', productFormId: '' } : {}),
            ...(field === 'subcategoryId' ? { productFormId: '' } : {}),
        }));
    };

    const handleSave = async () => {
        if (onUpdate) {
            const result = await onUpdate(medicine.id, editedData);
            if (result?.success) {
                toast.success("Inventory changes saved.");
                setIsEditing(false);
            } else {
                toast.error(result?.error || "Failed to save inventory changes.");
            }
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedData({ ...editedData, imageUrl: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setEditedData({ ...editedData, imageUrl: null });
    };

    return (
        <div className="inv-sidebar-overlay" onClick={onClose}>
            <div className="inv-sidebar" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="inv-sidebar-header">
                    <div>
                        <span className="warehouse-tag" style={{marginBottom:'0.5rem', display:'inline-block'}}>PRODUCT STOCK CARD</span>
                        {isEditing ? (
                            <input 
                                className="asm-input"
                                value={editedData.name || ""}
                                onChange={e => setEditedData({...editedData, name: e.target.value})}
                                style={{fontSize:'1.25rem', fontWeight:800, width:'100%'}}
                            />
                        ) : (
                            <h2 style={{margin:0, fontSize:'1.25rem', fontWeight:800}}>{medicine.name}</h2>
                        )}
                        
                        {isEditing ? (
                            <div style={{display:'flex', gap:'0.5rem', marginTop:'0.5rem'}}>
                                <input 
                                    className="asm-input" placeholder="Generic Name"
                                    value={editedData.genericName || ""}
                                    onChange={e => setEditedData({...editedData, genericName: e.target.value})}
                                    style={{fontSize:'0.85rem'}}
                                />
                                <input 
                                    className="asm-input" placeholder="Strength/Dosage"
                                    value={editedData.strength || ""}
                                    onChange={e => setEditedData({...editedData, strength: e.target.value})}
                                    style={{fontSize:'0.85rem'}}
                                />
                            </div>
                        ) : (
                            <p style={{margin:'0.25rem 0 0 0', color:'#64748b', fontSize:'0.85rem'}}>{medicine.genericName} • {medicine.strength || medicine.dosage}</p>
                        )}
                    </div>
                    <button onClick={onClose} style={{border:'none', background:'#f1f5f9', padding:'0.5rem', borderRadius:'8px', cursor:'pointer', color:'#64748b'}}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="inv-sidebar-content">
                    {/* Overview Stats */}
                    <div className="inv-sidebar-section">
                        <h3><BarChart3 size={16} color="var(--primary)" /> Inventory Overview</h3>
                        <div className="inv-detail-grid" style={{background:'#f8fafc', padding:'1rem', borderRadius:'12px'}}>
                            {/* Product Image Section */}
                            <div className="inv-product-image-container">
                                {editedData.imageUrl ? (
                                    <>
                                        <img src={editedData.imageUrl} alt={medicine.name} className="inv-image-preview" />
                                        {isEditing && (
                                            <div className="inv-image-overlay">
                                                <button className="inv-image-action-btn" onClick={removeImage} title="Remove Image">
                                                    <Trash2 size={16} color="#ef4444" />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="inv-image-placeholder" onClick={() => isEditing && fileInputRef.current.click()} style={{cursor: isEditing ? 'pointer' : 'default'}}>
                                        <ImagePlus size={24} />
                                        <span>{isEditing ? 'Upload Image' : 'No Image'}</span>
                                    </div>
                                )}
                                {isEditing && (
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        style={{display: 'none'}} 
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                )}
                            </div>

                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Current Stock</span>
                                {isEditing ? (
                                    <input 
                                        type="number" className="asm-input"
                                        value={editedData.totalQuantity ?? 0}
                                        onChange={e => setEditedData({...editedData, totalQuantity: parseInt(e.target.value) || 0})}
                                        style={{height:'24px', padding:'2px 8px', width: '80px', fontSize: '1.1rem'}}
                                    />
                                ) : (
                                    <span className="inv-detail-value" style={{fontSize:'1.2rem', color:'var(--primary)'}}>{totalQty} Units</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Avg. Selling Price</span>
                                {isEditing ? (
                                    <div style={{display:'flex', alignItems:'center', gap:'0.25rem'}}>
                                        <span style={{color: '#64748b'}}>K</span>
                                        <input 
                                            type="number" className="asm-input"
                                            value={editedData.sellingPrice ?? 0}
                                            onChange={e => setEditedData({...editedData, sellingPrice: parseFloat(e.target.value) || 0})}
                                            style={{height:'24px', padding:'2px 8px', width: '80px'}}
                                        />
                                    </div>
                                ) : (
                                    <span className="inv-detail-value">K{batches.length > 0 ? batches[0].sellingPrice : '0.00'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Cost Price (Supplier)</span>
                                {isEditing ? (
                                    <div style={{display:'flex', alignItems:'center', gap:'0.25rem'}}>
                                        <span style={{color: '#64748b'}}>K</span>
                                        <input 
                                            type="number" className="asm-input"
                                            value={editedData.costPrice ?? 0}
                                            onChange={e => setEditedData({...editedData, costPrice: parseFloat(e.target.value) || 0})}
                                            style={{height:'24px', padding:'2px 8px', width: '80px'}}
                                        />
                                    </div>
                                ) : (
                                    <span className="inv-detail-value">K{batches.length > 0 ? batches[0].costPrice : '0.00'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Stock Status</span>
                                <span className="inv-detail-value" style={{color: totalQty > 10 ? '#166534' : '#b91c1c'}}>
                                    {totalQty > 10 ? 'Stable' : 'Critical'}
                                </span>
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Threshold</span>
                                {isEditing ? (
                                    <input 
                                        type="number" className="asm-input"
                                        value={editedData.lowStockThreshold}
                                        onChange={e => setEditedData({...editedData, lowStockThreshold: parseInt(e.target.value)})}
                                        style={{height:'24px', padding:'2px 8px'}}
                                    />
                                ) : (
                                    <span className="inv-detail-value">{medicine.lowStockThreshold || 10} Units</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Metadata */}
                     <div className="inv-sidebar-section">
                        <h3><Info size={16} color="var(--primary)" /> Product Metadata</h3>
                        <div className="inv-detail-grid">
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Main Category</span>
                                {isEditing ? (
                                    <select className="asm-input" required value={editedData.mainCategoryId || ""} onChange={e => changeClassification('mainCategoryId', e.target.value)}>
                                        <option value="">Select main category...</option>
                                        {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                ) : (
                                    <span className="inv-detail-value">{medicine.MainCategory?.name || medicine.category || 'Unclassified'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Subcategory</span>
                                {isEditing ? (
                                    <select className="asm-input" disabled={!selectedCategory} value={editedData.subcategoryId || ""} onChange={e => changeClassification('subcategoryId', e.target.value)}>
                                        <option value="">Select subcategory...</option>
                                        {selectedCategory?.subcategories.map(subcategory => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                                    </select>
                                ) : (
                                    <span className="inv-detail-value">{medicine.Subcategory?.name || '—'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Product Form</span>
                                {isEditing ? (
                                    <select className="asm-input" disabled={!selectedSubcategory} value={editedData.productFormId || ""} onChange={e => changeClassification('productFormId', e.target.value)}>
                                        <option value="">Select product form...</option>
                                        {selectedSubcategory?.forms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}
                                    </select>
                                ) : (
                                    <span className="inv-detail-value">{medicine.ProductForm?.name || medicine.dosage || '—'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Brand Name</span>
                                {isEditing ? (
                                    <input className="asm-input" value={editedData.brandName || ""} onChange={e => setEditedData({...editedData, brandName: e.target.value})} />
                                ) : (
                                    <span className="inv-detail-value">{medicine.brandName || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Pack Size / Unit</span>
                                {isEditing ? (
                                    <div style={{display:'flex', gap:'0.35rem'}}>
                                        <input className="asm-input" aria-label="Pack size" placeholder="Pack size" value={editedData.packSize || ""} onChange={e => setEditedData({...editedData, packSize: e.target.value})} />
                                        <input className="asm-input" aria-label="Unit of measure" placeholder="Unit" value={editedData.unitOfMeasure || ""} onChange={e => setEditedData({...editedData, unitOfMeasure: e.target.value})} />
                                    </div>
                                ) : (
                                    <span className="inv-detail-value">{[medicine.packSize, medicine.unitOfMeasure].filter(Boolean).join(' ') || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Manufacturer</span>
                                {isEditing ? (
                                    <input 
                                        className="asm-input"
                                        value={editedData.manufacturer || ""}
                                        onChange={e => setEditedData({...editedData, manufacturer: e.target.value})}
                                    />
                                ) : (
                                    <span className="inv-detail-value">{medicine.manufacturer || 'Not Specified'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Preferred Supplier</span>
                                {isEditing ? (
                                    <input 
                                        className="asm-input"
                                        value={editedData.supplier || ""}
                                        onChange={e => setEditedData({...editedData, supplier: e.target.value})}
                                    />
                                ) : (
                                    <span className="inv-detail-value">
                                        <div style={{display:'flex', alignItems:'center', gap:'0.25rem'}}>
                                            <Truck size={12} /> {medicine.supplier || 'Standard'}
                                        </div>
                                    </span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Prescription</span>
                                <span className="inv-detail-value">
                                    {isEditing ? (
                                        <select
                                            className="asm-input"
                                            value={editedData.prescriptionRequired}
                                            onChange={e => setEditedData({...editedData, prescriptionRequired: e.target.value === 'true'})}
                                        >
                                            <option value="false">Not Required</option>
                                            <option value="true">Required</option>
                                        </select>
                                    ) : (
                                        medicine.prescriptionRequired ? 
                                            <span style={{color:'#b91c1c'}}><ShieldCheck size={12} /> Required</span> : 
                                            <span style={{color:'#64748b'}}>Not Required</span>
                                    )}
                                </span>
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Online Store</span>
                                <span className="inv-detail-value">
                                    {isEditing ? (
                                        <select
                                            className="asm-input"
                                            value={editedData.isCustomerVisible !== false}
                                            onChange={e => setEditedData({...editedData, isCustomerVisible: e.target.value === 'true'})}
                                        >
                                            <option value="true">Visible to Customers</option>
                                            <option value="false">Hidden from Store</option>
                                        </select>
                                    ) : (
                                        medicine.isCustomerVisible !== false ?
                                            <span style={{color:'#166534'}}>Visible</span> :
                                            <span style={{color:'#64748b'}}>Hidden</span>
                                    )}
                                </span>
                            </div>
                            <div className="inv-detail-item" style={{gridColumn: '1 / -1'}}>
                                <span className="inv-detail-label">Store Description</span>
                                {isEditing ? (
                                    <textarea
                                        className="asm-input"
                                        rows="2"
                                        value={editedData.description || ""}
                                        onChange={e => setEditedData({...editedData, description: e.target.value})}
                                        placeholder="Customer-facing description for the online store..."
                                        style={{width: '100%', resize: 'vertical', marginTop: '4px'}}
                                    />
                                ) : (
                                    <span className="inv-detail-value" style={{fontSize: '0.85rem', color: medicine.description ? 'inherit' : '#94a3b8'}}>
                                        {medicine.description || 'No description provided'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Batch Log */}
                    <div className="inv-sidebar-section">
                        <h3><History size={16} color="var(--primary)" /> Batch Logs & Provenance</h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                            {(editedData.Batches || []).map((batch, index) => (
                                <div key={batch.id} style={{padding:'0.85rem', border:'1px solid #f1f5f9', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <div style={{flex: 1}}>
                                        {isEditing ? (
                                            <input 
                                                className="asm-input"
                                                value={batch.batchNumber || ""}
                                                onChange={e => {
                                                    const newBatches = [...editedData.Batches];
                                                    newBatches[index] = {...batch, batchNumber: e.target.value};
                                                    setEditedData({...editedData, Batches: newBatches});
                                                }}
                                                placeholder="Batch ID"
                                                style={{fontSize:'0.85rem', padding:'2px 8px', fontWeight:700, width:'140px', marginBottom: '4px'}}
                                            />
                                        ) : (
                                            <div style={{fontWeight:700, fontSize:'0.85rem', color:'#1e293b'}}>Batch {batch.batchNumber}</div>
                                        )}
                                        
                                        <div style={{fontSize:'0.75rem', color:'#64748b', display:'flex', alignItems:'center', gap:'0.25rem', flexWrap:'wrap'}}>
                                            <MapPin size={10} /> 
                                            {isEditing ? (
                                                <input 
                                                    className="asm-input"
                                                    value={batch.warehouse || ""}
                                                    placeholder="Warehouse"
                                                    onChange={e => {
                                                        const newBatches = [...editedData.Batches];
                                                        newBatches[index] = {...batch, warehouse: e.target.value};
                                                        setEditedData({...editedData, Batches: newBatches});
                                                    }}
                                                    style={{fontSize:'0.75rem', padding:'2px 4px', width:'100px'}}
                                                />
                                            ) : (
                                                <>{batch.warehouse || 'Main Store'}</>
                                            )}
                                            • Exp: 
                                            {isEditing ? (
                                                <input 
                                                    type="date"
                                                    className="asm-input"
                                                    value={batch.expiryDate ? safeFormatDate(batch.expiryDate) : ""}
                                                    onChange={e => {
                                                        const newBatches = [...editedData.Batches];
                                                        newBatches[index] = {...batch, expiryDate: e.target.value};
                                                        setEditedData({...editedData, Batches: newBatches});
                                                    }}
                                                    style={{fontSize:'0.75rem', padding:'2px 4px', width:'110px'}}
                                                />
                                            ) : (
                                                <>{safeFormatDate(batch.expiryDate)}</>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{textAlign:'right'}}>
                                        <div style={{fontWeight:800, color:'var(--primary)'}}>{batch.quantity} Units</div>
                                        <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>K{batch.costPrice} / unit</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="inv-sidebar-footer">
                    {isEditing ? (
                        <>
                            <button className="asm-btn asm-btn-secondary" style={{flex:1}} onClick={() => setIsEditing(false)}>
                                Cancel
                            </button>
                            <button className="asm-btn asm-btn-primary" style={{flex:1}} onClick={handleSave}>
                                <Save size={18} /> Save Changes
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="asm-btn asm-btn-secondary" style={{flex:1}}>
                                <Printer size={18} /> Print Labels
                            </button>
                            <button className="asm-btn asm-btn-secondary" style={{flex:1}}>
                                <ArrowRightLeft size={18} /> Transfer
                            </button>
                            <button className="asm-btn asm-btn-primary" style={{flex:1}} onClick={() => setIsEditing(true)}>
                                <Edit size={18} /> Edit Product
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
