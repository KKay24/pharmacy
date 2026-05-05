import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    MoreHorizontal, 
    ChevronLeft, 
    Clock, 
    CheckCircle2, 
    PauseCircle, 
    FileText, 
    Settings,
    Download
} from 'lucide-react';
import { 
    PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Legend
} from 'recharts';
import { apiFetch } from '../utils/api';
import toast from 'react-hot-toast';
import '../styles/prescription.css';

const STATUS_TABS = [
    { id: 'all', label: 'All', icon: FileText },
    { id: 'Pending', label: 'Pending', icon: Clock, color: '#92400e' },
    { id: 'Ready for Pickup', label: 'Ready for Pickup', icon: CheckCircle2, color: '#166534' },
    { id: 'Filled', label: 'Filled', icon: CheckCircle2, color: '#1e40af' },
    { id: 'On Hold', label: 'On Hold', icon: PauseCircle, color: '#c2410c' },
];

const COLORS = {
    'Pending': '#fcd34d',
    'Ready for Pickup': '#10b981',
    'Filled': '#3b82f6',
    'On Hold': '#f97316',
};

const WORKLOAD_DATA = [
    { name: 'Mon', count: 12 },
    { name: 'Tue', count: 18 },
    { name: 'Wed', count: 22 },
    { name: 'Thu', count: 15 },
    { name: 'Fri', count: 25 },
];

export default function PrescriptionPage() {
    const [prescriptions, setPrescriptions] = useState([]);
    const [filteredScripts, setFilteredScripts] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState("");
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        patientName: "",
        medications: "",
        prescriber: "",
        insurance: "Self-Pay",
        dueDate: new Date().toISOString().split('T')[0]
    });

    const fetchPrescriptions = async () => {
        try {
            const res = await apiFetch('/api/prescriptions');
            if (res.ok) {
                const data = await res.json();
                setPrescriptions(data);
                setFilteredScripts(data);
            }
        } catch (err) {
            console.error("Error fetching prescriptions");
        }
    };

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    useEffect(() => {
        let result = prescriptions;

        // Filter by Tab
        if (activeTab !== 'all') {
            result = result.filter(p => p.status === activeTab);
        }

        // Search Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => 
                p.patientName.toLowerCase().includes(q) || 
                (p.medications && p.medications.toLowerCase().includes(q))
            );
        }

        setFilteredScripts(result);
    }, [activeTab, searchQuery, prescriptions]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch('/api/prescriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, status: 'Pending', date: new Date().toISOString().split('T')[0] })
            });
            if (res.ok) {
                setShowForm(false);
                setFormData({ patientName: "", medications: "", prescriber: "", insurance: "Self-Pay", dueDate: new Date().toISOString().split('T')[0] });
                fetchPrescriptions();
            }
        } catch (err) {
            console.error("Save failed");
        }
    };

    const analytics = useMemo(() => {
        const stats = {
            'Pending': 0,
            'Ready for Pickup': 0,
            'Filled': 0,
            'On Hold': 0
        };
        prescriptions.forEach(p => {
            if (stats[p.status] !== undefined) stats[p.status]++;
        });

        const donutData = Object.entries(stats).map(([name, value]) => ({ name, value }));
        return { stats, donutData };
    }, [prescriptions]);

    const getStatusClass = (status) => {
        switch(status) {
            case 'Pending': return 'status-pending';
            case 'Ready for Pickup': return 'status-ready';
            case 'Filled': return 'status-filled';
            case 'On Hold': return 'status-hold';
            default: return '';
        }
    };

    const getDueDateLabel = (date) => {
        if (!date) return '-';
        const d = new Date(date);
        const today = new Date();
        today.setHours(0,0,0,0);
        d.setHours(0,0,0,0);

        if (d.getTime() === today.getTime()) return 'Today';
        if (d.getTime() < today.getTime()) return 'Yesterday';
        return d.toLocaleDateString();
    };

    return (
        <div className="pm-container">
            {/* Page Header */}
            <div className="pm-header">
                <button className="pm-btn-primary" onClick={() => setShowForm(!showForm)}>
                    <span>{showForm ? "Cancel" : "+ New Prescription"}</span>
                </button>
            </div>

            {/* Creation Form (Simplified Panel) */}
            {showForm && (
                <div className="pm-table-card" style={{padding: '1.5rem', marginBottom: '1rem'}}>
                    <h2 style={{marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem'}}>Add Prescription Record</h2>
                    <form onSubmit={handleCreate} style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: '1rem'}}>
                        <div>
                            <label style={{fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem'}}>Patient Name</label>
                            <input 
                                className="pm-search-input" style={{width:'100%'}} 
                                type="text" value={formData.patientName} 
                                onChange={e => setFormData({...formData, patientName: e.target.value})}
                                placeholder="Full Name" required
                            />
                        </div>
                        <div>
                            <label style={{fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem'}}>Prescriber</label>
                            <input 
                                className="pm-search-input" style={{width:'100%'}} 
                                type="text" value={formData.prescriber} 
                                onChange={e => setFormData({...formData, prescriber: e.target.value})}
                                placeholder="Dr. Name"
                            />
                        </div>
                        <div>
                            <label style={{fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem'}}>Insurance</label>
                            <input 
                                className="pm-search-input" style={{width:'100%'}} 
                                type="text" value={formData.insurance} 
                                onChange={e => setFormData({...formData, insurance: e.target.value})}
                                placeholder="Provider Name"
                            />
                        </div>
                        <div style={{gridColumn: 'span 2'}}>
                            <label style={{fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem'}}>Medications</label>
                            <input 
                                className="pm-search-input" style={{width:'100%'}} 
                                type="text" value={formData.medications} 
                                onChange={e => setFormData({...formData, medications: e.target.value})}
                                placeholder="e.g. Atorvastatin 20mg"
                            />
                        </div>
                        <div style={{display:'flex', alignItems:'flex-end'}}>
                            <button type="submit" className="pm-btn-primary" style={{width:'100%'}}>Save Record</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filters Row */}
            <div className="pm-controls">
                <div className="pm-tabs">
                    {STATUS_TABS.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button 
                                key={tab.id}
                                className={`pm-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="pm-search-group">
                    <div style={{position: 'relative'}}>
                        <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color: '#94a3b8'}} />
                        <input 
                            className="pm-search-input" 
                            style={{paddingLeft: '38px'}} 
                            placeholder="Search patients..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Main Table Panel */}
            <div className="pm-table-card">
                <div className="pm-table-header">
                    <h2>Prescription Queue</h2>
                    <div style={{display:'flex', gap: '0.75rem'}}>
                         <select className="pm-search-input" style={{width: 'auto'}}>
                            <option>All Prescribers</option>
                         </select>
                         <select className="pm-search-input" style={{width: 'auto'}}>
                            <option>All Insurance</option>
                         </select>
                         <button className="pm-search-input" style={{width: '40px', padding: 0, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={() => toast.success('Exporting Queue as CSV...')}>
                            <Download size={18} />
                         </button>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="pm-table">
                        <thead>
                            <tr>
                                <th style={{width:'40px'}}><input type="checkbox" /></th>
                                <th>Patient</th>
                                <th>Drug</th>
                                <th>Status</th>
                                <th>Prescriber</th>
                                <th>Insurance</th>
                                <th>Due Date</th>
                                <th style={{width:'40px'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScripts.map(script => (
                                <tr key={script.id}>
                                    <td><input type="checkbox" /></td>
                                    <td>
                                        <div className="patient-avatar-row">
                                            <div className="patient-avatar">
                                                {script.patientName.charAt(0)}
                                            </div>
                                            <span style={{fontWeight: 600}}>{script.patientName}</span>
                                        </div>
                                    </td>
                                    <td style={{color: '#4474BF', fontWeight: 500}}>{script.medications}</td>
                                    <td>
                                        <span className={`badge-pm ${getStatusClass(script.status)}`}>
                                            {script.status}
                                        </span>
                                    </td>
                                    <td style={{color: '#64748b'}}>{script.prescriber || script.doctorName || 'Unknown'}</td>
                                    <td style={{color: '#64748b'}}>{script.insurance || 'Self-Pay'}</td>
                                    <td style={{fontWeight: 600}}>{getDueDateLabel(script.dueDate)}</td>
                                    <td><MoreHorizontal size={20} style={{color: '#94a3b8', cursor: 'pointer'}} onClick={() => toast('Menu opening...')} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="pm-pagination">
                    <div style={{fontSize: '0.85rem', color: '#64748b'}}><ChevronLeft size={16} /> 5 Items</div>
                    <div style={{display:'flex', gap:'0.5rem'}}>
                        <button className="pm-btn-primary active" style={{padding:'0.4rem 0.8rem'}}>1</button>
                        <button className="pm-btn-primary" style={{padding:'0.4rem 0.8rem', background:'white', border:'1px solid #e2e8f0', color:'#64748b'}}>2</button>
                    </div>
                    <button className="pm-btn-primary" style={{background:'white', border:'1px solid #e2e8f0', color:'#64748b'}} onClick={() => toast('No more pages found.')}>Next</button>
                </div>
            </div>

            {/* Analytics Row */}
            <div className="pm-stats-row">
                <div className="pm-stat-card">
                    <div className="pm-stat-card-header">
                        <h3>Processing Overview</h3>
                        <Settings size={16} color="#94a3b8" />
                    </div>
                    <div style={{height: '200px'}}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={analytics.donutData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {analytics.donutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#eee'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="pm-stat-card">
                    <div className="pm-stat-card-header">
                        <h3>Workload Summary</h3>
                        <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>Last 7 days</span>
                    </div>
                    <div style={{height: '200px'}}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={WORKLOAD_DATA}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                                <YAxis hide />
                                <Tooltip cursor={{fill: '#f8fafc'}} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="pm-stat-card">
                    <div className="pm-stat-card-header">
                        <h3>Quick Stats</h3>
                    </div>
                    <div className="pm-quick-stats">
                        <div className="pm-qstat-item">
                            <span className="pm-qstat-label">New Prescriptions</span>
                            <span className="pm-qstat-value">155</span>
                        </div>
                        <div className="pm-qstat-item">
                            <span className="pm-qstat-label">Refills</span>
                            <span className="pm-qstat-value">46</span>
                        </div>
                        <div className="pm-qstat-item">
                            <span className="pm-qstat-label">Transfer Rx</span>
                            <span className="pm-qstat-value">12</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
