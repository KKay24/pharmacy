import React, { useState } from "react";
import { 
    ChevronDown, 
    ChevronUp, 
    Edit3, 
    Trash2, 
    MapPin, 
    Calendar as CalendarIcon,
    AlertCircle,
    CheckCircle2,
    ShieldAlert
} from "lucide-react";

export default function InventoryTable({
    inventory,
    userRole,
    updateMedicine,
    deleteMedicine,
    onOpenCard
}) {
    const [expandedRow, setExpandedRow] = useState(null);

    const toggleRow = (e, id) => {
        e.stopPropagation();
        setExpandedRow(expandedRow === id ? null : id);
    };

    // --- Status Helpers ---
    const getStockStatus = (total, threshold) => {
        if (total === 0) return { label: "Out of Stock", class: "status-critical", icon: <ShieldAlert size={14} /> };
        if (total < (threshold || 10)) return { label: "Low Stock", class: "status-alert", icon: <AlertCircle size={14} /> };
        return { label: "Stable", class: "status-stable", icon: <CheckCircle2 size={14} /> };
    };

    const getExpiryStatus = (date) => {
        const d = new Date(date);
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        if (d < now) return { label: "Expired", class: "status-expired" };
        if (d <= thirtyDays) return { label: "Expiring Soon", class: "status-alert" };
        return null;
    };

    return (
        <table className="inv-table">
            <thead>
                <tr>
                    <th style={{width:'40px'}}></th>
                    <th>Medicine Details</th>
                    <th>Category</th>
                    <th style={{width:'180px'}}>Inventory Status</th>
                    <th style={{width:'140px'}}>Current Price</th>
                    <th style={{width:'180px'}}>Shelf Status</th>
                    <th style={{width:'100px'}}>Actions</th>
                </tr>
            </thead>
            <tbody>
                {inventory.map((med) => {
                    const totalQty = med.Batches ? med.Batches.reduce((acc, b) => acc + b.quantity, 0) : 0;
                    const status = getStockStatus(totalQty, med.lowStockThreshold);
                    
                    // Earliest expiry for shelf status
                    const batches = med.Batches || [];
                    const sortedBatches = [...batches].sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
                    const shelfStatus = sortedBatches.length > 0 ? getExpiryStatus(sortedBatches[0].expiryDate) : null;

                    return (
                        <React.Fragment key={med.id}>
                            <tr style={{cursor:'pointer'}} onClick={() => onOpenCard(med)}>
                                <td onClick={(e) => toggleRow(e, med.id)}>
                                    {expandedRow === med.id ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                </td>
                                <td>
                                    <div className="inv-medicine-cell">
                                        <div className="inv-medicine-thumb">
                                            {med.imageUrl ? <img src={med.imageUrl} alt="" style={{width:'100%', height:'100%', objectFit:'cover'}} /> : med.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{fontWeight:700, color:'#1e293b'}}>{med.name}</div>
                                            <div style={{fontSize:'0.75rem', color:'#64748b'}}>{med.genericName} • {med.strength || med.dosage}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span style={{fontSize:'0.85rem', color:'#475569', fontWeight:500}}>{med.category}</span>
                                </td>
                                <td>
                                    <div style={{display:'flex', flexDirection:'column', gap:'0.25rem'}}>
                                        <span className={`badge-inv ${status.class}`}>
                                            {status.icon} {status.label}
                                        </span>
                                        <span style={{fontSize:'0.75rem', marginLeft:'0.5rem', color:'#94a3b8', fontWeight:600}}>{totalQty} units on hand</span>
                                    </div>
                                </td>
                                <td>
                                    <div style={{fontWeight:700, color:'#1e293b'}}>
                                        K{batches.length > 0 ? (batches[0].sellingPrice || 0).toLocaleString() : "0.00"}
                                    </div>
                                </td>
                                <td>
                                    {shelfStatus ? (
                                        <span className={`badge-inv ${shelfStatus.class}`}>
                                            <CalendarIcon size={14} /> {shelfStatus.label}
                                        </span>
                                    ) : (
                                        <span style={{color:'#94a3b8', fontSize:'0.85rem'}}>No active batches</span>
                                    )}
                                </td>
                                <td>
                                    <div style={{display:'flex', gap:'0.5rem'}}>
                                        <button 
                                            className="asm-btn" 
                                            style={{padding:6, background:'#f1f5f9', color:'#4474BF', border:'none'}} 
                                            title="View Details"
                                            onClick={(e) => { e.stopPropagation(); onOpenCard(med); }}
                                        >
                                            <Edit3 size={16} />
                                        </button>
                                        {(userRole === 'admin' || userRole === 'manager') && (
                                            <button 
                                                className="asm-btn" 
                                                style={{padding:6, background:'#fee2e2', color:'#ef4444', border:'none'}} 
                                                title="Delete"
                                                onClick={(e) => { e.stopPropagation(); deleteMedicine(med.id); }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                            
                            {/* Expanded Batch View */}
                            {expandedRow === med.id && (
                                <tr className="inv-expanded-row">
                                    <td colSpan="7" style={{padding:0}}>
                                        <div className="inv-batch-grid">
                                            {batches.length === 0 ? (
                                                <div style={{gridColumn:'span 3', padding:'2rem', textAlign:'center', color:'#94a3b8'}}>
                                                    No stock batches found. Please add stock to this item.
                                                </div>
                                            ) : (
                                                batches.map(batch => (
                                                    <div className="inv-batch-card" key={batch.id}>
                                                        <div className="inv-batch-header">
                                                            <span>BATCH ID: {batch.batchNumber}</span>
                                                            <span className="warehouse-tag">
                                                                <MapPin size={10} /> {batch.warehouse || "Main Store"}
                                                            </span>
                                                        </div>
                                                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem', marginTop:'0.5rem'}}>
                                                            <div>
                                                                <label style={{fontSize:'0.65rem', color:'#94a3b8', display:'block'}}>EXPIRY</label>
                                                                <span style={{fontSize:'0.85rem', fontWeight:600}}>{batch.expiryDate}</span>
                                                            </div>
                                                            <div style={{textAlign:'right'}}>
                                                                <label style={{fontSize:'0.65rem', color:'#94a3b8', display:'block'}}>STOCKED</label>
                                                                <span style={{fontSize:'0.85rem', fontWeight:600}}>{batch.quantity} units</span>
                                                            </div>
                                                            <div>
                                                                <label style={{fontSize:'0.65rem', color:'#94a3b8', display:'block'}}>UNIT COST</label>
                                                                <span style={{fontSize:'0.85rem', fontWeight:600}}>K{batch.costPrice}</span>
                                                            </div>
                                                            <div style={{textAlign:'right'}}>
                                                                <label style={{fontSize:'0.65rem', color:'#94a3b8', display:'block'}}>LANDING</label>
                                                                <span style={{fontSize:'0.85rem', fontWeight:600, color:'#4474BF'}}>K{((batch.costPrice || 0) * (batch.quantity || 0)).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}
