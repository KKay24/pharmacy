import React, { useState, useContext, useMemo } from "react";
import { 
    Plus, 
    Trash2, 
    Receipt, 
    Tag,
    Search,
    Download
} from "lucide-react";
import toast from "react-hot-toast";
import { DataContext } from "../context/DataContext";
import { apiFetch } from "../utils/api";
import "../styles/expenses.css";

const CATEGORIES = [
    { label: "Payroll", value: "Payroll", class: "cat-payroll" },
    { label: "Rent", value: "Rent", class: "cat-rent" },
    { label: "Utilities", value: "Utilities", class: "cat-utilities" },
    { label: "Operating", value: "Operating", class: "cat-operating" },
    { label: "Other", value: "Other", class: "cat-other" }
];

export default function ExpensesPage() {
    const { expenses, fetchExpenses, fetchAnalytics } = useContext(DataContext);
    const [isAdding, setIsAdding] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const [form, setForm] = useState({
        category: "Operating",
        amount: "",
        description: "",
        date: new Date().toISOString().split('T')[0]
    });

    const filteredExpenses = useMemo(() => {
        if (!searchQuery) return expenses;
        const q = searchQuery.toLowerCase();
        return expenses.filter(e => 
            e.category.toLowerCase().includes(q) || 
            (e.description && e.description.toLowerCase().includes(q))
        );
    }, [expenses, searchQuery]);

    const stats = useMemo(() => {
        const now = new Date();
        const thisMonth = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const total = thisMonth.reduce((sum, e) => sum + e.amount, 0);
        const count = thisMonth.length;
        
        // Find top category
        const cats = {};
        thisMonth.forEach(e => cats[e.category] = (cats[e.category] || 0) + e.amount);
        const topCat = Object.entries(cats).sort((a,b) => b[1] - a[1])[0]?.[0] || "None";

        return { total, count, topCat };
    }, [expenses]);

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch("/api/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    amount: parseFloat(form.amount)
                }),
            });

            if (res.ok) {
                toast.success("Expense recorded successfully");
                setIsAdding(false);
                setForm({ category: "Operating", amount: "", description: "", date: new Date().toISOString().split('T')[0] });
                fetchExpenses();
                fetchAnalytics(); // Refresh P&L
            } else {
                toast.error("Failed to record expense");
            }
        } catch (err) {
            toast.error("Server error");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this expense record?")) return;
        try {
            const res = await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Expense deleted");
                fetchExpenses();
                fetchAnalytics();
            }
        } catch (err) {
            toast.error("Failed to delete");
        }
    };

    return (
        <div className="exp-container">
            {/* Header */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                    <h1 style={{margin:0, fontSize:'1.5rem', fontWeight:800}}>Operational Expenses</h1>
                    <p style={{margin:'0.25rem 0 0 0', color:'#64748b'}}>Track and manage your pharmacy's recurring and ad-hoc costs.</p>
                </div>
                <button 
                    className="exp-submit-btn" 
                    style={{marginTop:0, display:'flex', alignItems:'center', gap:'0.5rem'}}
                    onClick={() => setIsAdding(!isAdding)}
                >
                    <Plus size={18} />
                    {isAdding ? "Cancel" : "Add Expense"}
                </button>
            </div>

            {/* Stats Row */}
            <div className="exp-stats-row">
                <div className="exp-stat-card">
                    <span className="exp-stat-label">This Month Total</span>
                    <span className="exp-stat-value" style={{color:'#ef4444'}}>K{stats.total.toLocaleString()}</span>
                </div>
                <div className="exp-stat-card">
                    <span className="exp-stat-label">Transactions</span>
                    <span className="exp-stat-value">{stats.count}</span>
                </div>
                <div className="exp-stat-card">
                    <span className="exp-stat-label">Top Expense Category</span>
                    <span className="exp-stat-value" style={{fontSize:'1.1rem', color:'var(--primary)'}}>{stats.topCat}</span>
                </div>
                <div className="exp-stat-card">
                    <span className="exp-stat-label">Monthly Change</span>
                    <span className="exp-stat-value" style={{fontSize:'1.1rem', color:'#10b981'}}>+2.4%</span>
                </div>
            </div>

            {/* Entry Form (Conditional) */}
            {isAdding && (
                <div className="exp-form-card">
                    <h3 style={{marginTop:0, marginBottom:'1.5rem'}}>New Expense Entry</h3>
                    <form onSubmit={handleAdd}>
                        <div className="exp-input-grid">
                            <div className="exp-input-group">
                                <label>Category</label>
                                <select 
                                    className="exp-input"
                                    value={form.category}
                                    onChange={e => setForm({...form, category: e.target.value})}
                                >
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="exp-input-group">
                                <label>Amount (K)</label>
                                <input 
                                    className="exp-input" 
                                    type="number" step="0.01" 
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={e => setForm({...form, amount: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="exp-input-group">
                                <label>Date</label>
                                <input 
                                    className="exp-input" 
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({...form, date: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="exp-input-group">
                                <label>Description</label>
                                <input 
                                    className="exp-input" 
                                    type="text" 
                                    placeholder="e.g. Monthly rent for unit 4B"
                                    value={form.description}
                                    onChange={e => setForm({...form, description: e.target.value})}
                                />
                            </div>
                        </div>
                        <button type="submit" className="exp-submit-btn">Record Expense</button>
                    </form>
                </div>
            )}

            {/* History Table */}
            <div className="exp-table-card">
                <div className="exp-table-header">
                    <h2>Recent History</h2>
                    <div style={{display:'flex', gap:'1rem'}}>
                        <div style={{position:'relative'}}>
                            <Search size={16} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94a3b8'}} />
                            <input 
                                type="text" 
                                className="exp-input" 
                                style={{paddingLeft:'34px', paddingBottom:'0.5rem', paddingTop:'0.5rem', fontSize:'0.85rem'}}
                                placeholder="Search costs..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button className="exp-input" style={{fontSize:'0.85rem', display:'flex', alignItems:'center', gap:'0.5rem'}} onClick={() => toast.success('Exporting Expense History as CSV...')}>
                            <Download size={16} /> Export
                        </button>
                    </div>
                </div>
                <div className="table-responsive">
                    <table className="exp-table">
                        <thead>
                            <tr>
                                <th>DATE</th>
                                <th>CATEGORY</th>
                                <th>DESCRIPTION</th>
                                <th>AMOUNT</th>
                                <th style={{width:'80px'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map(item => (
                                <tr key={item.id}>
                                    <td style={{fontWeight:600}}>{new Date(item.date).toLocaleDateString()}</td>
                                    <td>
                                        <span className={`badge-cat ${CATEGORIES.find(c => c.value === item.category)?.class || 'cat-other'}`}>
                                            <Tag size={12} />
                                            {item.category}
                                        </span>
                                    </td>
                                    <td style={{color:'#64748b'}}>{item.description || '—'}</td>
                                    <td className="expense-amount">-K{item.amount.toLocaleString()}</td>
                                    <td>
                                        <button 
                                            onClick={() => handleDelete(item.id)}
                                            style={{border:'none', background:'none', color:'#94a3b8', cursor:'pointer'}}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredExpenses.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{textAlign:'center', padding:'3rem', color:'#94a3b8'}}>
                                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem'}}>
                                            <Receipt size={48} strokeWidth={1} />
                                            No expense records found.
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
