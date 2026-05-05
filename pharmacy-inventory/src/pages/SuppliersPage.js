import React, { useContext, useState, useMemo } from "react";
import { 
    Truck, 
    UserPlus, 
    Search, 
    Mail, 
    Phone, 
    MapPin, 
    ExternalLink,
    MoreVertical,
    Star,
    DollarSign,
    Briefcase,
    X
} from "lucide-react";
import { DataContext } from "../context/DataContext";
import { apiFetch } from "../utils/api";
import toast from "react-hot-toast";
import "../styles/suppliers-modern.css";

export default function SuppliersPage() {
    const { suppliers, fetchSuppliers } = useContext(DataContext);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        paymentTerms: "Net 30"
    });

    const handleOnboard = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch("/api/suppliers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                toast.success("Supplier onboarded successfully");
                setIsAdding(false);
                setFormData({ name: "", contactPerson: "", email: "", phone: "", address: "", paymentTerms: "Net 30" });
                fetchSuppliers();
            } else {
                toast.error("Failed to onboard supplier");
            }
        } catch (err) {
            toast.error("Server error");
        }
    };

    // --- Statistics ---
    const stats = useMemo(() => {
        const total = suppliers.length;
        const totalOwed = suppliers.reduce((acc, s) => acc + (s.balanceOwed || 0), 0);
        const topRated = suppliers.filter(s => (s.rating || 0) === 5).length;
        return { total, totalOwed, topRated };
    }, [suppliers]);

    // --- Filtering ---
    const filteredSuppliers = useMemo(() => {
        if (!searchQuery) return suppliers;
        const q = searchQuery.toLowerCase();
        return suppliers.filter(s => 
            s.name.toLowerCase().includes(q) || 
            (s.contactPerson && s.contactPerson.toLowerCase().includes(q))
        );
    }, [suppliers, searchQuery]);

    return (
        <div className="sup-container">
            {/* Header */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                    <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:800}}>Supplier Management Suite</h1>
                    <p style={{margin:'0.25rem 0 0 0', color:'#64748b'}}>Manage procurement partners, delivery logs, and outstanding balances.</p>
                </div>
                <button className="asm-btn asm-btn-primary" onClick={() => setIsAdding(true)}>
                    <UserPlus size={18} /> Onboard New Supplier
                </button>
            </div>

            {/* Stats Grid */}
            <div className="sup-stats-row">
                <div className="sup-stat-card">
                    <div className="sup-stat-icon" style={{background:'#dcfce7'}}>
                        <Truck size={22} color="#166534" />
                    </div>
                    <div className="sup-stat-copy">
                        <span className="sup-stat-label">Partners</span>
                        <span className="sup-stat-value">{stats.total}</span>
                    </div>
                </div>
                <div className="sup-stat-card">
                    <div className="sup-stat-icon" style={{background:'#fee2e2'}}>
                        <DollarSign size={22} color="#b91c1c" />
                    </div>
                    <div className="sup-stat-copy">
                        <span className="sup-stat-label">Total Payable</span>
                        <span className="sup-stat-value">K{stats.totalOwed.toLocaleString()}</span>
                    </div>
                </div>
                <div className="sup-stat-card">
                    <div className="sup-stat-icon" style={{background:'#fef9c3'}}>
                        <Star size={22} color="#a16207" />
                    </div>
                    <div className="sup-stat-copy">
                        <span className="sup-stat-label">Top Rated</span>
                        <span className="sup-stat-value">{stats.topRated}</span>
                    </div>
                </div>
                <div className="sup-stat-card">
                    <div className="sup-stat-icon" style={{background:'#f1f5f9'}}>
                        <Briefcase size={22} color="#475569" />
                    </div>
                    <div className="sup-stat-copy">
                        <span className="sup-stat-label">Active Orders</span>
                        <span className="sup-stat-value">0</span>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div style={{position:'relative', maxWidth:'400px'}}>
                <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
                <input 
                    type="text" 
                    className="asm-input" 
                    placeholder="Search by company or contact person..." 
                    style={{paddingLeft:'38px'}}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Partner Grid */}
            <div className="sup-grid">
                {filteredSuppliers.map(sup => (
                    <div className="sup-card" key={sup.id}>
                        <div className="sup-card-header">
                            <div className="sup-avatar">{sup.name.charAt(0)}</div>
                            <div style={{flex:1, marginLeft:'1rem'}}>
                                <h3 style={{margin:0, fontSize:'1.1rem', fontWeight:800, color:'#1e293b'}}>{sup.name}</h3>
                                <div className="sup-rating">
                                    {[...Array(5)].map((_, i) => (
                                        <Star 
                                            key={i} 
                                            size={12} 
                                            fill={i < (sup.rating || 5) ? "#f59e0b" : "none"} 
                                            color={i < (sup.rating || 5) ? "#f59e0b" : "#e2e8f0"} 
                                        />
                                    ))}
                                </div>
                            </div>
                            <button style={{border:'none', background:'none', color:'#94a3b8', cursor:'pointer'}} onClick={() => toast('Options menu coming soon.')}><MoreVertical size={18}/></button>
                        </div>

                        <div className="sup-details">
                            <div className="sup-info-row">
                                <Mail size={14} /> <span>{sup.email || "No email provided"}</span>
                            </div>
                            <div className="sup-info-row">
                                <Phone size={14} /> <span>{sup.phone || "No phone provided"}</span>
                            </div>
                            <div className="sup-info-row">
                                <MapPin size={14} /> <span>{sup.address || "No address provided"}</span>
                            </div>
                            <div className="sup-info-row">
                                <DollarSign size={14} /> 
                                <span className={`badge-finance ${sup.balanceOwed > 0 ? 'finance-pending' : 'finance-paid'}`}>
                                    {sup.balanceOwed > 0 ? `Unpaid: K${sup.balanceOwed.toLocaleString()}` : "Clear Balance"}
                                </span>
                            </div>
                        </div>

                        <div className="sup-actions">
                            <button className="asm-btn asm-btn-secondary" style={{flex:1}} onClick={() => toast('Loading History logs...')}>
                                <ExternalLink size={16} /> History
                            </button>
                            <button className="asm-btn asm-btn-primary" style={{flex:1}} onClick={() => toast.success('Opening Contact module...')}>
                                Contact Partner
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Onboard Modal Overlay */}
            {isAdding && (
                <div className="crm-sidebar-overlay" onClick={() => setIsAdding(false)}>
                    <div className="crm-sidebar" style={{width: '500px'}} onClick={e => e.stopPropagation()}>
                        <div className="crm-side-header">
                            <div>
                                <h2 style={{margin:0, fontSize:'1.25rem', fontWeight:800}}>New Supplier</h2>
                                <span style={{fontSize:'0.8rem', color:'#64748b'}}>Procurement partner onboarding</span>
                            </div>
                            <button onClick={() => setIsAdding(false)} style={{border:'none', background:'none', cursor:'pointer'}}><X size={22}/></button>
                        </div>
                        
                        <div className="crm-side-body">
                            <form id="supplier-form" onSubmit={handleOnboard}>
                                <div className="exp-input-group" style={{marginBottom: '1rem'}}>
                                    <label>Company / Supplier Name *</label>
                                    <input required className="asm-input" type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. MedSupply Inc"/>
                                </div>
                                <div className="exp-input-group" style={{marginBottom: '1rem'}}>
                                    <label>Contact Person</label>
                                    <input className="asm-input" type="text" value={formData.contactPerson} onChange={e => setFormData({...formData, contactPerson: e.target.value})} placeholder="e.g. Jane Doe"/>
                                </div>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom: '1rem'}}>
                                    <div className="exp-input-group">
                                        <label>Email Address</label>
                                        <input className="asm-input" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="jane@example.com"/>
                                    </div>
                                    <div className="exp-input-group">
                                        <label>Phone Number</label>
                                        <input className="asm-input" type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(555) 123-4567"/>
                                    </div>
                                </div>
                                <div className="exp-input-group" style={{marginBottom: '1rem'}}>
                                    <label>Physical Address</label>
                                    <input className="asm-input" type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="123 Warehousing Blvd"/>
                                </div>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom: '1rem'}}>
                                    <div className="exp-input-group">
                                        <label>Payment Terms</label>
                                        <select className="asm-input" value={formData.paymentTerms} onChange={e => setFormData({...formData, paymentTerms: e.target.value})}>
                                            <option value="Net 30">Net 30</option>
                                            <option value="Net 60">Net 60</option>
                                            <option value="Immediate">Immediate / Upon Delivery</option>
                                            <option value="Advance">Advance Payment</option>
                                        </select>
                                    </div>
                                </div>
                            </form>
                        </div>
                        
                        <div className="crm-side-footer" style={{padding:'1.5rem', borderTop:'1px solid #e2e8f0', display:'flex', gap:'1rem'}}>
                            <button className="asm-btn asm-btn-secondary" style={{flex:1}} onClick={() => setIsAdding(false)}>
                                Cancel
                            </button>
                            <button type="submit" form="supplier-form" className="asm-btn asm-btn-primary" style={{flex:1}}>
                                Save Supplier
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
