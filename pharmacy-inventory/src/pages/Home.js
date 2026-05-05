import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { 
    ShoppingCart, 
    Boxes, 
    TrendingUp, 
    Heart, 
    Truck,
    Users,
    Activity,
    Database,
    Globe,
    ShieldCheck,
    ArrowRight
} from "lucide-react";
import { DataContext } from "../context/DataContext";
import "../styles/home-modern.css";

export default function CommandOverviewPage() {
    const { username, inventory, sales, customers } = useContext(DataContext);
    
    const COMMAND_CARDS = [
        {
            title: "Retail POS",
            subtitle: "Process sales, manage carts, and print receipts.",
            icon: ShoppingCart,
            color: "#e0f2fe",
            iconColor: "#0369a1",
            path: "/pos"
        },
        {
            title: "Inventory Control",
            subtitle: "Audit stock levels, prices, and expiry dates.",
            icon: Boxes,
            color: "#fef3c7",
            iconColor: "#92400e",
            path: "/inventory"
        },
        {
            title: "Patient CRM",
            subtitle: "Manage medical history and allergy alerts.",
            icon: Heart,
            color: "#fee2e2",
            iconColor: "#b91c1c",
            path: "/customers"
        },
        {
            title: "Supply Chain",
            subtitle: "Manage suppliers and procurement orders.",
            icon: Truck,
            color: "#dcfce7",
            iconColor: "#166534",
            path: "/suppliers"
        },
        {
            title: "Analytics Hub",
            subtitle: "Review financial performance and BI reports.",
            icon: TrendingUp,
            color: "#f3e8ff",
            iconColor: "#7e22ce",
            path: "/reports"
        },
        {
            title: "Staff Management",
            subtitle: "Oversee team access and role permissions.",
            icon: Users,
            color: "#f1f5f9",
            iconColor: "#475569",
            path: "/add-user"
        }
    ];

    const stats = [
        { label: "Active SKU", value: inventory?.length || 0 },
        { label: "Daily Sales", value: sales?.length || 0 },
        { label: "Registered Patients", value: customers?.length || 0 },
        { label: "System Uptime", value: "99.9%" }
    ];

    const firstName = username?.split(' ')[0] || "Staff";

    return (
        <div className="home-container">
            {/* Hero Section */}
            <div className="hero-section">
                <span className="hero-eyebrow">Enterprise Command Center</span>
                <h1 className="hero-title">Welcome back, {firstName}</h1>
                <p className="hero-subtitle">
                    Manage your pharmacy's clinical and retail operations from a centralized, high-fidelity mission control.
                </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="quick-meta">
                {stats.map(s => (
                    <div className="meta-box" key={s.label}>
                        <span className="meta-label">{s.label}</span>
                        <span className="meta-value">{s.value}</span>
                    </div>
                ))}
            </div>

            {/* Mission Control Grid */}
            <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                <h2 style={{margin:0, fontSize:'1.1rem', fontWeight:800, color:'#64748b', textTransform:'uppercase'}}>Mission Control</h2>
                <div className="command-grid">
                    {COMMAND_CARDS.map(card => {
                        const Icon = card.icon;
                        return (
                            <Link to={card.path} className="command-card" key={card.title}>
                                <div className="command-icon-box" style={{background: card.color}}>
                                    <Icon size={24} color={card.iconColor} />
                                </div>
                                <div>
                                    <h3>{card.title}</h3>
                                    <p>{card.subtitle}</p>
                                </div>
                                <div style={{marginTop:'auto', display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.75rem', fontWeight:800, color: card.iconColor}}>
                                    Launch Module <ArrowRight size={14} />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* System Status Bar */}
            <div className="status-bar">
                <div className="status-group">
                    <div className="status-item">
                        <Activity size={14} />
                        <span>Core Services: <strong style={{color:'#10b981'}}>Active</strong></span>
                        <div className="status-dot"></div>
                    </div>
                    <div className="status-item">
                        <Database size={14} />
                        <span>Database Sync: <strong style={{color:'#10b981'}}>Live</strong></span>
                    </div>
                    <div className="status-item">
                        <Globe size={14} />
                        <span>Cloud Gateway: <strong style={{color:'#10b981'}}>Connected</strong></span>
                    </div>
                </div>
                <div className="status-item">
                    <ShieldCheck size={14} />
                    <span>Protocol: <strong style={{color:'#cbd5e1'}}>TLS 1.3 Secure</strong></span>
                </div>
            </div>
        </div>
    );
}
