import React, { useState } from "react";
import toast from "react-hot-toast";
import { getActiveBatches, getBatchStockValue, getEffectiveBatchCost } from "../utils/inventoryValuation";
import BatchDeleteModal from "./BatchDeleteModal";
import {
    ChevronDown,
    ChevronUp,
    Edit3,
    Trash2,
    MapPin,
    Calendar as CalendarIcon,
    AlertCircle,
    CheckCircle2,
    ShieldAlert,
    Copy,
    Check,
    User
} from "lucide-react";

const getBatchStatusMeta = (batch) => {
    const raw = String(batch?.status || '').toLowerCase();
    if (raw === 'deleted') return { key: 'deleted', label: 'Deleted' };
    if (raw === 'archived') return { key: 'archived', label: 'Archived' };
    if (raw === 'depleted' || Number(batch?.quantity || 0) <= 0) {
        return { key: 'depleted', label: 'Depleted' };
    }
    return { key: 'active', label: 'Active' };
};

const formatBatchTimestamp = (value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function InventoryTable({
    inventory,
    userRole,
    updateMedicine,
    deleteMedicine,
    onOpenCard,
    onRemoveBatch,
    onArchiveBatch
}) {
    const [expandedRow, setExpandedRow] = useState(null);
    const [copiedBatchId, setCopiedBatchId] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [batchSubmitting, setBatchSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');
    const [modalCanArchive, setModalCanArchive] = useState(false);

    const canManageBatches = userRole === 'admin' || userRole === 'manager';

    const toggleRow = (e, id) => {
        e.stopPropagation();
        setExpandedRow(expandedRow === id ? null : id);
    };

    const handleCopyBatch = async (e, batch) => {
        e.stopPropagation();
        const value = batch?.batchNumber || '';
        if (!value) return;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
            }
            setCopiedBatchId(batch.id);
            toast.success(`Copied ${value}`);
            setTimeout(() => {
                setCopiedBatchId((current) => (current === batch.id ? null : current));
            }, 1800);
        } catch (err) {
            toast.error('Could not copy batch number.');
        }
    };

    const openBatchDeleteModal = (e, med, batch) => {
        e.stopPropagation();
        setModalError('');
        setModalCanArchive(false);
        setPendingDelete({ medicine: med, batch });
    };

    const closeBatchDeleteModal = () => {
        if (batchSubmitting) return;
        setPendingDelete(null);
        setModalError('');
        setModalCanArchive(false);
    };

    const handleConfirmDeleteBatch = async (batch, reason) => {
        if (!pendingDelete?.medicine?.id || !batch?.id || !onRemoveBatch) return;
        setBatchSubmitting(true);
        setModalError('');
        const result = await onRemoveBatch(pendingDelete.medicine.id, batch.id, reason);
        setBatchSubmitting(false);
        if (!result?.success) {
            const msg = result?.error || 'Failed to delete stock batch.';
            setModalError(msg);
            setModalCanArchive(Number(batch.quantity || 0) === 0 && Boolean(onArchiveBatch));
            toast.error(msg);
            return;
        }
        setPendingDelete(null);
        setModalError('');
        setModalCanArchive(false);
        toast.success(`Batch ${batch.batchNumber || batch.id} deleted.`);
    };

    const handleConfirmArchiveBatch = async (batch, reason) => {
        if (!pendingDelete?.medicine?.id || !batch?.id || !onArchiveBatch) return;
        setBatchSubmitting(true);
        setModalError('');
        const result = await onArchiveBatch(pendingDelete.medicine.id, batch.id, reason);
        setBatchSubmitting(false);
        if (!result?.success) {
            const msg = result?.error || 'Failed to archive stock batch.';
            setModalError(msg);
            toast.error(msg);
            return;
        }
        setPendingDelete(null);
        setModalError('');
        setModalCanArchive(false);
        toast.success(`Batch ${batch.batchNumber || batch.id} archived.`);
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
        <>
            <table className="inv-table">
                <thead>
                    <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Medicine Details</th>
                        <th>Classification</th>
                        <th style={{ width: '180px' }}>Inventory Status</th>
                        <th style={{ width: '140px' }}>Current Price</th>
                        <th style={{ width: '180px' }}>Shelf Status</th>
                        <th style={{ width: '100px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {inventory.map((med) => {
                        const batches = getActiveBatches(med);
                        const totalQty = batches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
                        const status = getStockStatus(totalQty, med.lowStockThreshold);

                        const sortedBatches = [...batches]
                            .filter((b) => Number(b.quantity || 0) > 0 && b.expiryDate)
                            .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
                        const shelfStatus = sortedBatches.length > 0 ? getExpiryStatus(sortedBatches[0].expiryDate) : null;
                        const referenceBatch = batches.find((b) => Number(b.quantity || 0) > 0) || batches[0] || null;

                        return (
                            <React.Fragment key={med.id}>
                                <tr style={{ cursor: 'pointer' }} onClick={() => onOpenCard(med)}>
                                    <td onClick={(e) => toggleRow(e, med.id)}>
                                        {expandedRow === med.id ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                    </td>
                                    <td>
                                        <div className="inv-medicine-cell">
                                            <div className="inv-medicine-thumb">
                                                {med.imageUrl ? <img src={med.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : med.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{med.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{med.genericName} • {med.strength || med.dosage}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{batches.length} stock batch{batches.length === 1 ? '' : 'es'}</span>
                                                    {med.isCustomerVisible !== false && (
                                                        <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
                                                            Store
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>
                                            {med.MainCategory?.name || 'Unclassified'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                            {[med.Subcategory?.name, med.ProductForm?.name || med.dosage].filter(Boolean).join(' › ') || (med.category ? `Legacy label: ${med.category}` : 'Classification needed')}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <span className={`badge-inv ${status.class}`}>
                                                {status.icon} {status.label}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: '#94a3b8', fontWeight: 600 }}>{totalQty} units on hand</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                            K{referenceBatch ? (referenceBatch.sellingPrice || 0).toLocaleString() : "0.00"}
                                        </div>
                                    </td>
                                    <td>
                                        {shelfStatus ? (
                                            <span className={`badge-inv ${shelfStatus.class}`}>
                                                <CalendarIcon size={14} /> {shelfStatus.label}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No active batches</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                type="button"
                                                className="asm-btn"
                                                style={{ padding: 6, background: 'var(--primary-soft)', color: 'var(--primary)', border: 'none' }}
                                                title="View Details"
                                                onClick={(e) => { e.stopPropagation(); onOpenCard(med); }}
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            {canManageBatches && (
                                                <button
                                                    type="button"
                                                    className="asm-btn"
                                                    style={{ padding: 6, background: '#fee2e2', color: '#ef4444', border: 'none' }}
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
                                        <td colSpan="7" style={{ padding: 0 }}>
                                            <div className="inv-batch-grid">
                                                {batches.length === 0 ? (
                                                    <div style={{ gridColumn: 'span 3', padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                                        No stock batches found. Please add stock to this item.
                                                    </div>
                                                ) : (
                                                    batches.map((batch) => {
                                                        const batchStatus = getBatchStatusMeta(batch);
                                                        const receivedQty = batch.quantityReceived !== null && batch.quantityReceived !== undefined
                                                            ? Number(batch.quantityReceived)
                                                            : null;
                                                        return (
                                                            <div className="inv-batch-card" key={batch.id}>
                                                                <div className="inv-batch-header">
                                                                    <div className="inv-batch-id-row">
                                                                        <code className="inv-batch-code-pill">{batch.batchNumber}</code>
                                                                        <button
                                                                            type="button"
                                                                            className="inv-batch-copy-btn"
                                                                            title="Copy batch number"
                                                                            aria-label={`Copy batch number ${batch.batchNumber}`}
                                                                            onClick={(e) => handleCopyBatch(e, batch)}
                                                                        >
                                                                            {copiedBatchId === batch.id ? <Check size={12} /> : <Copy size={12} />}
                                                                        </button>
                                                                    </div>
                                                                    <span className={`inv-batch-status is-${batchStatus.key}`}>
                                                                        {batchStatus.label}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                    <span className="warehouse-tag">
                                                                        <MapPin size={10} /> {batch.warehouse || "Main Store"}
                                                                    </span>
                                                                    {batch.supplier && (
                                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                                            {batch.supplier}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>EXPIRY</label>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{batch.expiryDate}</span>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <label style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>REMAINING</label>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                                            {batch.quantity}{receivedQty !== null ? ` / ${receivedQty}` : ''} units
                                                                        </span>
                                                                    </div>
                                                                    <div>
                                                                        <label style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>UNIT COST</label>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>K{getEffectiveBatchCost(batch, batches[0]?.costPrice)}</span>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <label style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>LANDING</label>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>K{getBatchStockValue(batch, batches[0]?.costPrice).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="inv-batch-card-table-footer">
                                                                    <div className="inv-batch-audit-copy">
                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                            <User size={10} /> {batch.createdByUsername || 'System'}
                                                                        </span>
                                                                        <span>{formatBatchTimestamp(batch.createdAt || batch.receivedDate)}</span>
                                                                    </div>
                                                                    {canManageBatches && onRemoveBatch && (
                                                                        <button
                                                                            type="button"
                                                                            className="inv-batch-delete-btn"
                                                                            title={`Delete batch ${batch.batchNumber}`}
                                                                            aria-label={`Delete batch ${batch.batchNumber}`}
                                                                            onClick={(e) => openBatchDeleteModal(e, med, batch)}
                                                                        >
                                                                            <Trash2 size={15} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
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

            <BatchDeleteModal
                isOpen={Boolean(pendingDelete)}
                batch={pendingDelete?.batch || null}
                productName={pendingDelete?.medicine?.name || ''}
                onCancel={closeBatchDeleteModal}
                onConfirmDelete={handleConfirmDeleteBatch}
                onConfirmArchive={handleConfirmArchiveBatch}
                isSubmitting={batchSubmitting}
                errorMessage={modalError}
                canArchiveFallback={modalCanArchive}
            />
        </>
    );
}
