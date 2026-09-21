import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { 
    UserPlus, 
    Search, 
    Shield, 
    Stethoscope,
    Package,
    Mail,
    MapPin,
    Clock,
    MoreVertical,
    CheckCircle2,
    XCircle,
    X,
    Key,
    Activity,
    Lock
} from "lucide-react";
import { apiFetch } from "../utils/api";
import "../styles/team-modern.css";

const ROLES = [
    { id: 'admin', label: 'Administrator', icon: Shield, color: 'role-admin' },
    { id: 'manager', label: 'Manager', icon: Stethoscope, color: 'role-pharmacist' },
    { id: 'user', label: 'Staff', icon: Package, color: 'role-inventory' },
];

const PERMISSIONS = [
    { feature: 'POS & Sales', admin: true, manager: true, user: true },
    { feature: 'Inventory Control', admin: true, manager: true, user: true },
    { feature: 'Prescriptions', admin: true, manager: true, user: false },
    { feature: 'Reports & BI', admin: true, manager: true, user: false },
    { feature: 'Supplier Mgmt', admin: true, manager: true, user: false },
    { feature: 'Staff Admin', admin: true, manager: false, user: false },
];

export default function TeamHubPage() {
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
        role: "user",
        email: "",
        locations: ["Main Pharmacy"]
    });

    const fetchUsers = async () => {
        try {
            const res = await apiFetch("/api/auth/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error("Fetch users error", err);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return users;
        const q = searchQuery.toLowerCase();
        return users.filter(u => 
            u.username.toLowerCase().includes(q) || 
            (u.email && u.email.toLowerCase().includes(q))
        );
    }, [users, searchQuery]);

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const endpoint = editingUser ? `/api/auth/users/${editingUser.id}` : "/api/auth/users";
            const method = editingUser ? "PUT" : "POST";
            
            // Password is not required when editing unless we add reset logic
            const payload = { ...formData };
            if (editingUser && !payload.password) delete payload.password;

            const res = await apiFetch(endpoint, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toast.success(editingUser ? "Staff profile updated!" : "Staff profile created!");
                setShowForm(false);
                setEditingUser(null);
                setFormData({ username: "", password: "", role: "user", email: "", locations: ["Main Pharmacy"] });
                fetchUsers();
            } else {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Failed to save user");
            }
        } catch (err) {
            toast.error("Server error");
        }
    };

    const handleEditInitiated = (user) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            password: "", // Leave blank when editing unless resetting
            role: user.role,
            email: user.email || "",
            locations: user.locations || ["Main Pharmacy"]
        });
        setShowForm(true);
    };

    const getRoleData = (roleName) => {
        return ROLES.find(r => r.id.toLowerCase() === roleName.toLowerCase()) || ROLES[2];
    };

    return (
        <div className="team-container">
            {/* Header */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                {/* <div>
                    <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:800}}>Team & HR Hub</h1>
                    <p style={{margin:'0.25rem 0 0 0', color:'#64748b'}}>Provision staff accounts, manage access levels, and monitor system security.</p>
                </div> */}
                <button className="asm-btn asm-btn-primary" onClick={() => setShowForm(true)}>
                    <UserPlus size={18} /> Onboard New Staff
                </button>
            </div>
            
            {/* Search Bar */}
            <div style={{position:'relative', maxWidth:'400px'}}>
                <Search size={18} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
                <input 
                    type="text" 
                    className="asm-input" 
                    placeholder="Search by name or email..." 
                    style={{paddingLeft:'38px'}}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Staff Grid */}
            <div className="team-grid">
                {filteredUsers.map(user => {
                    const role = getRoleData(user.role);
                    const RoleIcon = role.icon;
                    return (
                        <div className="staff-card" key={user.id}>
                            <div className="staff-card-header">
                                <div className="staff-avatar">{user.username.charAt(0)}</div>
                                <div className="staff-info">
                                    <h3 className="staff-name">{user.username}</h3>
                                    <div className={`staff-role-pill ${role.color}`}>
                                        <RoleIcon size={12} style={{marginRight:4, verticalAlign:'middle'}} />
                                        {user.role}
                                    </div>
                                </div>
                                <button 
                                    style={{marginLeft:'auto', border:'none', background:'none', color:'#94a3b8', cursor:'pointer'}}
                                    onClick={() => handleEditInitiated(user)}
                                >
                                    <MoreVertical size={18}/>
                                </button>
                            </div>

                            <div className="staff-details">
                                <div className="staff-detail-row">
                                    <Mail size={14} /> {user.email || 'No email provided'}
                                </div>
                                <div className="staff-detail-row">
                                    <MapPin size={14} /> {user.locations?.join(', ') || 'Main Pharmacy'}
                                </div>
                                <div className="staff-detail-row">
                                    <Clock size={14} /> Last access: {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                                </div>
                            </div>

                            <div style={{marginTop:'0.5rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                                    <div className={user.status === 'active' ? 'status-active-dot' : 'status-inactive-dot'}></div>
                                    <span style={{fontSize:'0.75rem', fontWeight:600, color:'#64748b'}}>
                                        {user.status === 'active' ? 'System Active' : 'Access Revoked'}
                                    </span>
                                </div>
                                <div style={{display:'flex', gap:'0.5rem'}}>
                                    <button 
                                        className="asm-btn asm-btn-secondary" 
                                        style={{padding:'0.4rem 0.6rem', fontSize:'0.75rem'}}
                                        onClick={() => handleEditInitiated(user)}
                                    >
                                        Edit Profile
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'1.5rem'}}>
                {/* Permissions Matrix */}
                <div className="matrix-card">
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem'}}>
                        <Key size={20} color="var(--primary)" />
                        <h2 style={{margin:0, fontSize:'1.1rem', fontWeight:800}}>Access Permissions Matrix</h2>
                    </div>
                    <div className="matrix-grid">
                        <div className="matrix-header">Functional Area</div>
                        <div className="matrix-header">Admin</div>
                        <div className="matrix-header">Manager</div>
                        <div className="matrix-header">Staff</div>
                        
                        {PERMISSIONS.map(p => (
                            <React.Fragment key={p.feature}>
                                <div className="matrix-cell" style={{fontWeight:600}}>{p.feature}</div>
                                <div className="matrix-cell">{p.admin ? <CheckCircle2 size={16} color="#10b981"/> : <XCircle size={16} color="#cbd5e1"/>}</div>
                                <div className="matrix-cell">{p.manager ? <CheckCircle2 size={16} color="#10b981"/> : <XCircle size={16} color="#cbd5e1"/>}</div>
                                <div className="matrix-cell">{p.user ? <CheckCircle2 size={16} color="#10b981"/> : <XCircle size={16} color="#cbd5e1"/>}</div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Security Audit Log (Simplified) */}
                <div className="matrix-card">
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem'}}>
                        <Activity size={20} color="var(--primary)" />
                        <h2 style={{margin:0, fontSize:'1.1rem', fontWeight:800}}>Security Audit Log</h2>
                    </div>
                    <div style={{display:'flex', flexDirection:'column'}}>
                        {users.slice(0, 5).map(u => (
                            <div className="log-row" key={u.id}>
                                <div style={{display:'flex', flexDirection:'column'}}>
                                    <span style={{fontWeight:700, fontSize:'0.85rem'}}>{u.username}</span>
                                    <span style={{fontSize:'0.7rem', color:'#64748b'}}>Successful Login</span>
                                </div>
                                <span style={{fontSize:'0.7rem', color:'#94a3b8'}}>{u.lastLogin ? 'Today' : '—'}</span>
                            </div>
                        ))}
                        <button className="asm-btn asm-btn-secondary" style={{marginTop:'1.5rem', width:'100%'}}>
                            Download Full Audit
                        </button>
                    </div>
                </div>
            </div>

            {/* Onboarding Modal */}
            {showForm && (
                <div className="crm-sidebar-overlay" onClick={() => { setShowForm(false); setEditingUser(null); }}>
                    <div className="crm-sidebar" style={{width:450}} onClick={e => e.stopPropagation()}>
                        <div className="crm-side-header">
                            <div>
                                <h2 style={{margin:0, fontSize:'1.25rem', fontWeight:800}}>
                                    {editingUser ? "Edit Staff Profile" : "Staff Onboarding"}
                                </h2>
                                <span style={{fontSize:'0.8rem', color:'#64748b'}}>
                                    {editingUser ? `Updating credentials for ${editingUser.username}` : "Provision new system credentials"}
                                </span>
                            </div>
                            <button onClick={() => { setShowForm(false); setEditingUser(null); }} style={{border:'none', background:'none', cursor:'pointer'}}><X size={22}/></button>
                        </div>
                        <form onSubmit={handleCreateUser} className="crm-side-body">
                            <div className="asm-field">
                                <label>Username</label>
                                <input 
                                    className="asm-input" required
                                    disabled={!!editingUser}
                                    value={formData.username || ""}
                                    onChange={e => setFormData({...formData, username:e.target.value})}
                                />
                            </div>
                            <div className="asm-field">
                                <label>Email Address</label>
                                <input 
                                    type="email" className="asm-input"
                                    value={formData.email || ""}
                                    onChange={e => setFormData({...formData, email:e.target.value})}
                                />
                            </div>
                            {!editingUser && (
                                <div className="asm-field">
                                    <label>Set Password</label>
                                    <input 
                                        type="password" className="asm-input" required
                                        value={formData.password || ""}
                                        onChange={e => setFormData({...formData, password:e.target.value})}
                                    />
                                </div>
                            )}
                            <div className="asm-field">
                                <label>Operational Role</label>
                                <select 
                                    className="asm-input"
                                    value={formData.role}
                                    onChange={e => setFormData({...formData, role:e.target.value})}
                                >
                                    <option value="admin">Administrator</option>
                                    <option value="manager">Manager</option>
                                    <option value="user">Staff</option>
                                </select>
                            </div>
                            <div className="allergy-alert" style={{background:'#f8fafc', border:'1px solid #e2e8f0', color:'#64748b'}}>
                                <Lock size={18} />
                                <div style={{fontSize:'0.75rem', fontWeight:400}}>
                                    By creating this account, the user will be granted access to clinical and financial data based on their role.
                                </div>
                            </div>
                            <button type="submit" className="asm-btn asm-btn-primary" style={{marginTop:'auto', width:'100%'}}>
                                Save Staff Profile
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
