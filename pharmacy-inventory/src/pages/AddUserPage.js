import React, { useState, useEffect, useMemo, useContext } from "react";
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
    KeyRound,
    Trash2,
    Activity,
    Lock
} from "lucide-react";
import { DataContext } from "../context/DataContext";
import { apiFetch, getApiErrorMessage } from "../utils/api";
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
    const dataContext = useContext(DataContext) || {};
    const currentUsername = String(dataContext.username || "").trim().toLowerCase();
    const [users, setUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [savingUser, setSavingUser] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState(null);
    const [passwordForm, setPasswordForm] = useState({ newPassword: "", confirmPassword: "" });
    const [savingPassword, setSavingPassword] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deletingUser, setDeletingUser] = useState(false);
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
        if (savingUser) return;
        const trimmedEmail = String(formData.email || "").trim();
        const trimmedPassword = String(formData.password || "").trim();
        if (!editingUser && trimmedPassword.length < 12) {
            toast.error("Password must be at least 12 characters long");
            return;
        }
        if (editingUser && trimmedPassword && trimmedPassword.length < 12) {
            toast.error("New password must be at least 12 characters long");
            return;
        }

        setSavingUser(true);
        try {
            const endpoint = editingUser ? `/api/auth/users/${editingUser.id}` : "/api/auth/users";
            const method = editingUser ? "PUT" : "POST";

            const payload = {
                ...formData,
                username: String(formData.username || "").trim(),
                email: trimmedEmail || null,
            };
            if (editingUser && !trimmedPassword) {
                delete payload.password;
            } else if (trimmedPassword) {
                payload.password = trimmedPassword;
            }

            const res = await apiFetch(endpoint, {
                method,
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
                toast.error(await getApiErrorMessage(res, "Failed to save user"));
            }
        } catch (err) {
            toast.error(err?.message || "Server error");
        } finally {
            setSavingUser(false);
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

    const handleOpenPasswordModal = (user) => {
        setPasswordTarget(user);
        setPasswordForm({ newPassword: "", confirmPassword: "" });
    };

    const handleResetUserPassword = async (e) => {
        e.preventDefault();
        if (!passwordTarget || savingPassword) return;
        const nextPassword = passwordForm.newPassword.trim();
        if (nextPassword.length < 12) {
            toast.error("New password must be at least 12 characters long");
            return;
        }
        if (nextPassword !== passwordForm.confirmPassword.trim()) {
            toast.error("Passwords do not match");
            return;
        }

        setSavingPassword(true);
        try {
            const res = await apiFetch(`/api/auth/users/${passwordTarget.id}/password`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: nextPassword }),
            });
            if (res.ok) {
                toast.success(`Password updated for ${passwordTarget.username}`);
                setPasswordTarget(null);
                setPasswordForm({ newPassword: "", confirmPassword: "" });
            } else {
                toast.error(await getApiErrorMessage(res, "Failed to change password"));
            }
        } catch (err) {
            toast.error(err?.message || "Failed to change password");
        } finally {
            setSavingPassword(false);
        }
    };

    const handleConfirmDeleteUser = async () => {
        if (!deleteTarget || deletingUser) return;
        setDeletingUser(true);
        try {
            const res = await apiFetch(`/api/auth/users/${deleteTarget.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success(`Deleted user ${deleteTarget.username}`);
                setDeleteTarget(null);
                fetchUsers();
            } else {
                toast.error(await getApiErrorMessage(res, "Failed to delete user"));
            }
        } catch (err) {
            toast.error(err?.message || "Failed to delete user");
        } finally {
            setDeletingUser(false);
        }
    };

    const canManageCredentialsOrDelete = (targetUser) => {
        const isSelf = currentUsername && String(targetUser.username || "").trim().toLowerCase() === currentUsername;
        return targetUser.role !== "admin" && !isSelf;
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
                <button
                    className="asm-btn asm-btn-primary"
                    onClick={() => {
                        setEditingUser(null);
                        setFormData({ username: "", password: "", role: "user", email: "", locations: ["Main Pharmacy"] });
                        setShowForm(true);
                    }}
                >
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
                                <div style={{display:'flex', gap:'0.4rem', flexWrap:'wrap', justifyContent:'flex-end'}}>
                                    <button 
                                        type="button"
                                        className="asm-btn asm-btn-secondary" 
                                        style={{padding:'0.4rem 0.6rem', fontSize:'0.75rem'}}
                                        onClick={() => handleEditInitiated(user)}
                                    >
                                        Edit Profile
                                    </button>
                                    {canManageCredentialsOrDelete(user) && (
                                        <>
                                            <button
                                                type="button"
                                                className="asm-btn asm-btn-secondary"
                                                style={{padding:'0.4rem 0.6rem', fontSize:'0.75rem', display:'inline-flex', alignItems:'center', gap:'0.3rem'}}
                                                aria-label={`Change password for ${user.username}`}
                                                onClick={() => handleOpenPasswordModal(user)}
                                            >
                                                <KeyRound size={13} aria-hidden="true" />
                                                Change Password
                                            </button>
                                            <button
                                                type="button"
                                                className="asm-btn asm-btn-secondary"
                                                style={{padding:'0.4rem 0.6rem', fontSize:'0.75rem', color:'#dc2626', borderColor:'#fecaca', background:'#fef2f2', display:'inline-flex', alignItems:'center', gap:'0.3rem'}}
                                                aria-label={`Delete user ${user.username}`}
                                                onClick={() => setDeleteTarget(user)}
                                            >
                                                <Trash2 size={13} aria-hidden="true" />
                                                Delete
                                            </button>
                                        </>
                                    )}
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
                                        type="password" className="asm-input" required minLength={12}
                                        placeholder="Minimum 12 characters"
                                        value={formData.password || ""}
                                        onChange={e => setFormData({...formData, password:e.target.value})}
                                    />
                                </div>
                            )}
                            <div className="asm-field">
                                <label>Operational Role</label>
                                <select 
                                    className="asm-input"
                                    disabled={editingUser?.role === "admin"}
                                    value={formData.role}
                                    onChange={e => setFormData({...formData, role:e.target.value})}
                                >
                                    {editingUser?.role === "admin" && <option value="admin">Administrator</option>}
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
                            <button type="submit" disabled={savingUser} className="asm-btn asm-btn-primary" style={{marginTop:'auto', width:'100%'}}>
                                {savingUser ? "Saving..." : "Save Staff Profile"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Change User Password Modal */}
            {passwordTarget && (
                <div className="crm-sidebar-overlay" onClick={() => !savingPassword && setPasswordTarget(null)}>
                    <div className="crm-sidebar" style={{width:440}} role="dialog" aria-modal="true" aria-label={`Change password for ${passwordTarget.username}`} onClick={e => e.stopPropagation()}>
                        <div className="crm-side-header">
                            <div>
                                <h2 style={{margin:0, fontSize:'1.2rem', fontWeight:800}}>Change User Password</h2>
                                <span style={{fontSize:'0.8rem', color:'#64748b'}}>
                                    Set a new password for <strong>{passwordTarget.username}</strong>
                                </span>
                            </div>
                            <button type="button" onClick={() => !savingPassword && setPasswordTarget(null)} style={{border:'none', background:'none', cursor:'pointer'}} aria-label="Close password modal">
                                <X size={22}/>
                            </button>
                        </div>
                        <form onSubmit={handleResetUserPassword} className="crm-side-body">
                            <div className="asm-field">
                                <label htmlFor="admin-reset-new-password">New Password</label>
                                <input
                                    id="admin-reset-new-password"
                                    type="password"
                                    className="asm-input"
                                    required
                                    minLength={12}
                                    placeholder="Minimum 12 characters"
                                    value={passwordForm.newPassword}
                                    onChange={e => setPasswordForm(current => ({ ...current, newPassword: e.target.value }))}
                                />
                            </div>
                            <div className="asm-field">
                                <label htmlFor="admin-reset-confirm-password">Confirm New Password</label>
                                <input
                                    id="admin-reset-confirm-password"
                                    type="password"
                                    className="asm-input"
                                    required
                                    minLength={12}
                                    placeholder="Re-enter new password"
                                    value={passwordForm.confirmPassword}
                                    onChange={e => setPasswordForm(current => ({ ...current, confirmPassword: e.target.value }))}
                                />
                            </div>
                            <div className="allergy-alert" style={{background:'#f8fafc', border:'1px solid #e2e8f0', color:'#64748b'}}>
                                <Lock size={18} />
                                <div style={{fontSize:'0.75rem', fontWeight:400}}>
                                    Passwords must be at least 12 characters. Share the updated password securely with the user.
                                </div>
                            </div>
                            <div style={{marginTop:'auto', display:'flex', gap:'0.75rem'}}>
                                <button
                                    type="button"
                                    className="asm-btn asm-btn-secondary"
                                    style={{flex:1}}
                                    disabled={savingPassword}
                                    onClick={() => setPasswordTarget(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="asm-btn asm-btn-primary"
                                    style={{flex:2}}
                                    disabled={savingPassword}
                                >
                                    {savingPassword ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete User Confirmation Modal */}
            {deleteTarget && (
                <div className="crm-sidebar-overlay" onClick={() => !deletingUser && setDeleteTarget(null)}>
                    <div className="crm-sidebar" style={{width:420, height:'auto', maxHeight:'90vh', margin:'auto', borderRadius:'14px'}} role="dialog" aria-modal="true" aria-label={`Delete user ${deleteTarget.username}`} onClick={e => e.stopPropagation()}>
                        <div className="crm-side-header">
                            <div>
                                <h2 style={{margin:0, fontSize:'1.15rem', fontWeight:800, color:'#b91c1c'}}>Delete User Account</h2>
                                <span style={{fontSize:'0.8rem', color:'#64748b'}}>This action cannot be undone.</span>
                            </div>
                            <button type="button" onClick={() => !deletingUser && setDeleteTarget(null)} style={{border:'none', background:'none', cursor:'pointer'}} aria-label="Close delete modal">
                                <X size={22}/>
                            </button>
                        </div>
                        <div className="crm-side-body" style={{gap:'1rem'}}>
                            <p style={{margin:0, fontSize:'0.9rem', color:'#334155', lineHeight:1.5}}>
                                Are you sure you want to permanently delete <strong>{deleteTarget.username}</strong>? Historical sales and order records will be preserved, but this user will immediately lose system access.
                            </p>
                            <div style={{display:'flex', gap:'0.75rem', marginTop:'0.5rem'}}>
                                <button
                                    type="button"
                                    className="asm-btn asm-btn-secondary"
                                    style={{flex:1}}
                                    disabled={deletingUser}
                                    onClick={() => setDeleteTarget(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="asm-btn"
                                    style={{flex:1, background:'#dc2626', color:'#ffffff', border:'none'}}
                                    disabled={deletingUser}
                                    onClick={handleConfirmDeleteUser}
                                >
                                    {deletingUser ? "Deleting..." : "Confirm Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
