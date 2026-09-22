import React, { useContext, useState, useMemo } from "react";
import { 
    Search, 
    Mail, 
    Phone, 
    MapPin, 
    ExternalLink,
    MoreVertical,
    Star,
    X,
    TrendingUp,
    Users,
    UserPlus,
    ShieldAlert,
    History,
    Clipboard
} from "lucide-react";
import { DataContext } from "../context/DataContext";
import { apiFetch } from "../utils/api";
import "../styles/customers-modern.css";

export default function CustomersPage() {
    const { customers } = useContext(DataContext);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [fullPatientData, setFullPatientData] = useState(null);

    // --- Statistics ---
    const stats = useMemo(() => {
        const total = customers.length;
        const totalPoints = customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0);
        const withAllergies = customers.filter(c => c.allergies && c.allergies !== 'None').length;
        return { total, totalPoints, withAllergies };
    }, [customers]);

    // --- Filtering ---
    const filteredPatients = useMemo(() => {
        if (!searchQuery) return customers;
        const q = searchQuery.toLowerCase();
        return customers.filter(c => 
            c.name.toLowerCase().includes(q) || 
            (c.phone && c.phone.toLowerCase().includes(q))
        );
    }, [customers, searchQuery]);

    // --- Detail Fetching ---
    const handleOpenProfile = async (patient) => {
        setSelectedPatient(patient);
        try {
            const res = await apiFetch(`/api/customers/${patient.id}`);
            if (res.ok) {
                const data = await res.json();
                setFullPatientData(data);
            }
        } catch (err) {
            console.error("Failed to fetch patient history", err);
        }
    };

    return (
        <div className="crm-container">
            {/* Header */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                    <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:800}}>Patient & Customer Hub</h1>
                    <p style={{margin:'0.25rem 0 0 0', color:'#64748b'}}>Manage medical history, allergy alerts, and transaction history.</p>
                </div>
                <button className="asm-btn asm-btn-primary" disabled title="Patient registration is unavailable">
                    <UserPlus size={18} /> New Patient Registration (Unavailable)
                </button>
            </div>

            {/* Stats Grid */}
            <div className="crm-stats-row">
                <div className="crm-stat-card">
                    <div className="crm-stat-icon" style={{background:'#e0f2fe'}}>
                        <Users size={22} color="#0369a1" />
                    </div>
                    <div className="crm-stat-copy">
                        <span className="crm-stat-label">Total Patients</span>
                        <span className="crm-stat-value">{stats.total}</span>
                    </div>
                </div>
                <div className="crm-stat-card">
                    <div className="crm-stat-icon" style={{background:'#fee2e2'}}>
                        <ShieldAlert size={22} color="#b91c1c" />
                    </div>
                    <div className="crm-stat-copy">
                        <span className="crm-stat-label">Medical Alerts</span>
                        <span className="crm-stat-value">{stats.withAllergies}</span>
                    </div>
                </div>
                <div className="crm-stat-card">
                    <div className="crm-stat-icon" style={{background:'#fef9c3'}}>
                        <Star size={22} color="#a16207" />
                    </div>
                    <div className="crm-stat-copy">
                        <span className="crm-stat-label">Loyalty Points</span>
                        <span className="crm-stat-value">{stats.totalPoints.toLocaleString()}</span>
                    </div>
                </div>
                <div className="crm-stat-card">
                    <div className="crm-stat-icon" style={{background:'#dcfce7'}}>
                        <TrendingUp size={22} color="#166534" />
                    </div>
                    <div className="crm-stat-copy">
                        <span className="crm-stat-label">Active This Month</span>
                        <span className="crm-stat-value">0</span>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div style={{position:'relative', maxWidth:'400px'}}>
                <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
                <input 
                    type="text" 
                    className="asm-input" 
                    placeholder="Search by name or phone number..." 
                    style={{paddingLeft:'38px'}}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Patient Grid */}
            <div className="crm-list-card">
                <table className="crm-table">
                    <thead>
                        <tr>
                            <th>Patient Name</th>
                            <th>Medical Alerts</th>
                            <th>Contact Info</th>
                            <th>Loyalty Status</th>
                            <th style={{width:'50px'}}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.map(p => (
                            <tr key={p.id} style={{cursor:'pointer'}} onClick={() => handleOpenProfile(p)}>
                                <td>
                                    <div style={{fontWeight:800, color:'#1e293b'}}>{p.name}</div>
                                    <div style={{fontSize:'0.75rem', color:'#64748b'}}>ID: P-{p.id.toString().padStart(4, '0')}</div>
                                </td>
                                <td>
                                    {p.allergies && p.allergies !== 'None' ? (
                                        <span className="allergy-badge" style={{background:'#fee2e2', color:'#b91c1c', padding:'2px 8px', borderRadius:4, fontSize:'0.75rem', fontWeight:700}}>
                                            {p.allergies}
                                        </span>
                                    ) : <span style={{color:'#94a3b8', fontSize:'0.75rem'}}>No known allergies</span>}
                                </td>
                                <td>
                                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8rem'}}>
                                        <Phone size={12} color="#94a3b8" /> {p.phone || '—'}
                                    </div>
                                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8rem', color:'#64748b'}}>
                                        <Mail size={12} color="#94a3b8" /> {p.email || '—'}
                                    </div>
                                </td>
                                <td>
                                    <div className="loyalty-pill">{p.loyaltyPoints} Points</div>
                                </td>
                                <td>
                                    <button style={{border:'none', background:'none', color:'#94a3b8', cursor:'not-allowed'}} disabled title="Customer options are unavailable"><MoreVertical size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Patient Profile Sidebar */}
            {selectedPatient && (
                <div className="crm-sidebar-overlay" onClick={() => setSelectedPatient(null)}>
                    <div className="crm-sidebar" onClick={e => e.stopPropagation()}>
                        <div className="crm-side-header">
                            <div>
                                <h2 style={{margin:0, fontSize:'1.25rem', fontWeight:800}}>{selectedPatient.name}</h2>
                                <span style={{fontSize:'0.8rem', color:'#64748b'}}>Medical Record P-{selectedPatient.id.toString().padStart(4, '0')}</span>
                            </div>
                            <button onClick={() => setSelectedPatient(null)} style={{border:'none', background:'none', cursor:'pointer'}}><X size={22}/></button>
                        </div>

                        <div className="crm-side-body">
                            {/* Medical Alert Section */}
                            {selectedPatient.allergies && selectedPatient.allergies !== 'None' && (
                                <div className="allergy-alert">
                                    <ShieldAlert size={20} />
                                    <div>
                                        <div style={{fontSize:'0.85rem'}}>ALLERGY ALERT</div>
                                        <div style={{fontSize:'1rem'}}>{selectedPatient.allergies}</div>
                                    </div>
                                </div>
                            )}

                            {/* Info Blocks */}
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                                <div className="sup-details" style={{background:'#f8fafc'}}>
                                    <span style={{fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>Chronic Conditions</span>
                                    <div style={{marginTop:'0.25rem'}}>
                                        {selectedPatient.chronicConditions ? (
                                            selectedPatient.chronicConditions.split(',').map(c => <span key={c} className="chronic-badge" style={{marginRight:4}}>{c}</span>)
                                        ) : <span style={{color:'#94a3b8', fontSize:'0.8rem'}}>None reported</span>}
                                    </div>
                                </div>
                                <div className="sup-details" style={{background:'#f8fafc'}}>
                                    <span style={{fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>Insurance Provider</span>
                                    <div style={{marginTop:'0.25rem', fontWeight:700, fontSize:'0.9rem'}}>
                                        {selectedPatient.insuranceProvider || "Self-Pay"}
                                    </div>
                                    <div style={{fontSize:'0.7rem', color:'#64748b'}}>{selectedPatient.insuranceNumber || ""}</div>
                                </div>
                            </div>

                            {/* Contact Block */}
                            <div className="sup-details">
                                <span style={{fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase', marginBottom:'0.5rem', display:'block'}}>Contact Details</span>
                                <div className="sup-info-row"><Phone size={14}/> {selectedPatient.phone}</div>
                                <div className="sup-info-row"><Mail size={14}/> {selectedPatient.email}</div>
                                <div className="sup-info-row"><MapPin size={14}/> {selectedPatient.address}</div>
                            </div>

                            {/* History Block */}
                            <div style={{flex:1, display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                                <span style={{fontSize:'0.7rem', fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>Recent Purchase History</span>
                                {fullPatientData && fullPatientData.Sales && fullPatientData.Sales.length > 0 ? (
                                    fullPatientData.Sales.slice(0, 5).map(sale => (
                                        <div key={sale.id} style={{padding:'0.75rem', background:'#f8fafc', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                            <div>
                                                <div style={{fontWeight:700, fontSize:'0.9rem'}}>K{sale.totalAmount.toLocaleString()} Transaction</div>
                                                <div style={{fontSize:'0.75rem', color:'#64748b'}}>{new Date(sale.createdAt).toLocaleDateString()}</div>
                                            </div>
                                            <button style={{border:'none', background:'none', color:'#94a3b8', cursor:'not-allowed'}} disabled title="Transaction details are unavailable"><ExternalLink size={16}/></button>
                                        </div>
                                    ))
                                ) : (
                                    <div style={{textAlign:'center', padding:'2rem', color:'#94a3b8', background:'#f8fafc', borderRadius:8}}>
                                        <History size={32} style={{marginBottom:'0.5rem', opacity:0.5}} />
                                        <p style={{margin:0, fontSize:'0.85rem'}}>No recent transactions found</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="crm-side-footer" style={{padding:'1.5rem', borderTop:'1px solid #e2e8f0', display:'flex', gap:'1rem'}}>
                            <button className="asm-btn asm-btn-secondary" style={{flex:1}} disabled title="Medical notes are unavailable">
                                <Clipboard size={18} /> Medical Notes (Unavailable)
                            </button>
                            <button className="asm-btn asm-btn-primary" style={{flex:1}} disabled title="Customer editing is unavailable">
                                Edit Profile (Unavailable)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
