import React, { useState, useEffect, useRef, useCallback } from "react";
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
    Trash2,
    Plus,
    Copy,
    Check,
    User,
    Clock,
    RefreshCw
} from "lucide-react";
import toast from "react-hot-toast";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import { getActiveBatches } from "../utils/inventoryValuation";
import BatchDeleteModal from "./BatchDeleteModal";

// Safe date formatter to prevent RangeError: 'Invalid time value' on bad data
const safeFormatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString).substring(0, 10);
    return d.toISOString().split('T')[0];
};

const safeFormatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const getBatchStatusMeta = (batch) => {
    const raw = String(batch?.status || '').toLowerCase();
    if (raw === 'deleted') return { key: 'deleted', label: 'Deleted' };
    if (raw === 'archived') return { key: 'archived', label: 'Archived' };
    if (raw === 'depleted' || Number(batch?.quantity || 0) <= 0) {
        return { key: 'depleted', label: 'Depleted' };
    }
    return { key: 'active', label: 'Active' };
};

const createInitialBatchDraft = (medicine) => {
    const activeBatches = getActiveBatches(medicine);
    const referenceBatch = activeBatches.find((b) => Number(b.quantity || 0) > 0) || activeBatches[0] || null;
    return {
        quantity: '',
        costPrice: referenceBatch?.costPrice !== undefined ? String(referenceBatch.costPrice) : '',
        sellingPrice: referenceBatch?.sellingPrice !== undefined
            ? String(referenceBatch.sellingPrice)
            : (medicine?.basePrice !== undefined ? String(medicine.basePrice) : ''),
        expiryDate: '',
        manufacturingDate: '',
        supplier: medicine?.supplier || '',
        warehouse: referenceBatch?.warehouse || '',
        supplierBatchNumber: '',
    };
};

export default function StockCardSidebar({
    medicine,
    userRole,
    onClose,
    onUpdate,
    onAddBatch,
    onRemoveBatch,
    onArchiveBatch,
    categories = []
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState(null);
    const [batchTab, setBatchTab] = useState('active');
    const [showAddBatchForm, setShowAddBatchForm] = useState(false);
    const [batchDraft, setBatchDraft] = useState(() => createInitialBatchDraft(medicine));
    const [batchSaving, setBatchSaving] = useState(false);
    const [copiedBatchId, setCopiedBatchId] = useState(null);
    const [pendingDeleteBatch, setPendingDeleteBatch] = useState(null);
    const [deleteModalError, setDeleteModalError] = useState('');
    const [deleteModalCanArchive, setDeleteModalCanArchive] = useState(false);
    const [historyData, setHistoryData] = useState({ loading: false, loaded: false, error: '', batches: [], movements: [] });
    const fileInputRef = useRef(null);

    const canManageBatches = userRole === 'admin' || userRole === 'manager';

    useEffect(() => {
        if (medicine) {
            const activeBatches = getActiveBatches(medicine);
            const currentTotal = activeBatches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
            const referenceBatch = activeBatches.find((b) => Number(b.quantity || 0) > 0) || activeBatches[0] || null;
            const currentPrice = referenceBatch ? referenceBatch.sellingPrice : Number(medicine.basePrice || 0);
            const currentCost = referenceBatch ? referenceBatch.costPrice : 0;
            setEditedData({
                ...medicine,
                Batches: activeBatches,
                totalQuantity: currentTotal,
                sellingPrice: currentPrice,
                costPrice: currentCost,
            });
            setIsEditing(false);
            setShowAddBatchForm(false);
            setBatchTab('active');
            setBatchDraft(createInitialBatchDraft(medicine));
            setPendingDeleteBatch(null);
            setDeleteModalError('');
            setDeleteModalCanArchive(false);
            setHistoryData({ loading: false, loaded: false, error: '', batches: [], movements: [] });
        }
    }, [medicine]);

    const loadBatchHistory = useCallback(async (medicineId) => {
        if (!medicineId) return;
        setHistoryData((prev) => ({ ...prev, loading: true, error: '' }));
        try {
            const response = await apiFetch(`/api/inventory/${medicineId}/batches`);
            if (!response.ok) {
                const msg = await getApiErrorMessage(response, 'Failed to load batch history');
                setHistoryData({ loading: false, loaded: true, error: msg, batches: [], movements: [] });
                return;
            }
            const payload = await response.json();
            setHistoryData({
                loading: false,
                loaded: true,
                error: '',
                batches: Array.isArray(payload?.batches) ? payload.batches : [],
                movements: Array.isArray(payload?.movements) ? payload.movements : [],
            });
        } catch (error) {
            setHistoryData({
                loading: false,
                loaded: true,
                error: 'Unable to reach the inventory service',
                batches: [],
                movements: [],
            });
        }
    }, []);

    useEffect(() => {
        if (medicine?.id && batchTab === 'history' && !historyData.loaded && !historyData.loading) {
            loadBatchHistory(medicine.id);
        }
    }, [medicine?.id, batchTab, historyData.loaded, historyData.loading, loadBatchHistory]);

    if (!medicine || !editedData) return null;

    const batches = getActiveBatches(medicine);
    const totalQty = batches.reduce((acc, b) => acc + Number(b.quantity || 0), 0);
    const referenceBatch = batches.find((b) => Number(b.quantity || 0) > 0) || batches[0] || null;
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

    const handleCopyBatchNumber = async (batch) => {
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

    const handleSave = async () => {
        if (onUpdate) {
            const result = await onUpdate(medicine.id, editedData);
            if (result?.success) {
                toast.success("Inventory changes saved.");
                setIsEditing(false);
                if (historyData.loaded) {
                    loadBatchHistory(medicine.id);
                }
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

    const replaceActiveBatches = (updatedMedicine) => {
        const nextBatches = getActiveBatches(updatedMedicine);
        setEditedData((current) => current && current.id === updatedMedicine.id
            ? { ...current, Batches: nextBatches, totalQuantity: updatedMedicine.totalQuantity }
            : current);
    };

    const handleAddBatch = async () => {
        const quantity = Number(batchDraft.quantity);
        const costPrice = batchDraft.costPrice === '' ? 0 : Number(batchDraft.costPrice);
        const sellingPrice = batchDraft.sellingPrice === '' ? 0 : Number(batchDraft.sellingPrice);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return toast.error('Quantity must be a positive whole number.');
        }
        if (!Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
            return toast.error('Cost price and selling price must be non-negative numbers.');
        }

        const existingIds = new Set((editedData.Batches || []).map((b) => b.id));
        setBatchSaving(true);
        const result = await onAddBatch?.(medicine.id, {
            quantity,
            costPrice,
            sellingPrice,
            expiryDate: batchDraft.expiryDate.trim() || undefined,
            manufacturingDate: batchDraft.manufacturingDate.trim() || undefined,
            supplier: batchDraft.supplier.trim() || undefined,
            warehouse: batchDraft.warehouse.trim() || undefined,
            supplierBatchNumber: batchDraft.supplierBatchNumber.trim() || undefined,
        });
        setBatchSaving(false);

        if (!result?.success) {
            return toast.error(result?.error || 'Failed to add stock batch.');
        }

        replaceActiveBatches(result.medicine);
        const createdBatch = (result.medicine?.Batches || []).find((b) => !existingIds.has(b.id));
        setBatchDraft(createInitialBatchDraft(result.medicine));
        setShowAddBatchForm(false);
        if (historyData.loaded) {
            loadBatchHistory(medicine.id);
        }
        toast.success(
            createdBatch?.batchNumber
                ? `Created batch ${createdBatch.batchNumber}`
                : 'New stock batch added to active inventory.'
        );
    };

    const openDeleteDialog = (batch) => {
        setDeleteModalError('');
        setDeleteModalCanArchive(false);
        setPendingDeleteBatch(batch);
    };

    const closeDeleteDialog = () => {
        if (batchSaving) return;
        setPendingDeleteBatch(null);
        setDeleteModalError('');
        setDeleteModalCanArchive(false);
    };

    const handleConfirmDeleteBatch = async (batch, reason) => {
        if (!batch?.id) return;
        setBatchSaving(true);
        setDeleteModalError('');
        const result = await onRemoveBatch?.(medicine.id, batch.id, reason);
        setBatchSaving(false);

        if (!result?.success) {
            const errorMsg = result?.error || 'Failed to delete stock batch.';
            setDeleteModalError(errorMsg);
            const canArchive = Number(batch.quantity || 0) === 0 && Boolean(onArchiveBatch);
            setDeleteModalCanArchive(canArchive);
            toast.error(errorMsg);
            return;
        }

        replaceActiveBatches(result.medicine);
        setPendingDeleteBatch(null);
        setDeleteModalError('');
        setDeleteModalCanArchive(false);
        if (historyData.loaded) {
            loadBatchHistory(medicine.id);
        }
        toast.success(`Batch ${batch.batchNumber || batch.id} deleted and archived in history.`);
    };

    const handleConfirmArchiveBatch = async (batch, reason) => {
        if (!batch?.id || !onArchiveBatch) return;
        setBatchSaving(true);
        setDeleteModalError('');
        const result = await onArchiveBatch(medicine.id, batch.id, reason);
        setBatchSaving(false);

        if (!result?.success) {
            const errorMsg = result?.error || 'Failed to archive stock batch.';
            setDeleteModalError(errorMsg);
            toast.error(errorMsg);
            return;
        }

        replaceActiveBatches(result.medicine);
        setPendingDeleteBatch(null);
        setDeleteModalError('');
        setDeleteModalCanArchive(false);
        if (historyData.loaded) {
            loadBatchHistory(medicine.id);
        }
        toast.success(`Batch ${batch.batchNumber || batch.id} archived.`);
    };

    const renderBatchCard = (batch, index, { editable = false, isHistoryView = false } = {}) => {
        const statusMeta = getBatchStatusMeta(batch);
        const isDeletable = canManageBatches && statusMeta.key !== 'deleted' && statusMeta.key !== 'archived';
        const remainingQty = Number(batch.quantity || 0);
        const receivedQty = batch.quantityReceived !== null && batch.quantityReceived !== undefined
            ? Number(batch.quantityReceived)
            : null;
        const createdTimestamp = batch.createdAt || batch.receivedDate;

        return (
            <div
                key={batch.id}
                className={`inv-batch-card-item is-${statusMeta.key}`}
                data-testid={`batch-card-${batch.id}`}
            >
                <div className="inv-batch-card-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="inv-batch-id-row">
                            <code className="inv-batch-code-pill">{batch.batchNumber}</code>
                            <button
                                type="button"
                                className="inv-batch-copy-btn"
                                title="Copy batch number"
                                aria-label={`Copy batch number ${batch.batchNumber}`}
                                onClick={() => handleCopyBatchNumber(batch)}
                            >
                                {copiedBatchId === batch.id ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            <span className={`inv-batch-status is-${statusMeta.key}`}>
                                {statusMeta.label}
                            </span>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontWeight: 800, color: statusMeta.key === 'active' ? 'var(--primary)' : '#64748b' }}>
                            {remainingQty} {remainingQty === 1 ? 'Unit' : 'Units'}
                        </div>
                        {receivedQty !== null && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                Received: {receivedQty}
                            </div>
                        )}
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            K{Number(batch.costPrice || 0)} / unit
                        </div>
                    </div>
                </div>

                <div className="inv-batch-card-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <MapPin size={11} />
                        {editable ? (
                            <input
                                className="asm-input"
                                value={batch.warehouse || ""}
                                placeholder="Warehouse"
                                onChange={(e) => {
                                    const newBatches = [...editedData.Batches];
                                    newBatches[index] = { ...batch, warehouse: e.target.value };
                                    setEditedData({ ...editedData, Batches: newBatches });
                                }}
                                style={{ fontSize: '0.75rem', padding: '2px 6px', width: '105px' }}
                            />
                        ) : (
                            batch.warehouse || 'Main Store'
                        )}
                    </span>
                    <span>•</span>
                    <span>
                        Exp:{' '}
                        {editable ? (
                            <input
                                type="date"
                                className="asm-input"
                                value={batch.expiryDate ? safeFormatDate(batch.expiryDate) : ""}
                                onChange={(e) => {
                                    const newBatches = [...editedData.Batches];
                                    newBatches[index] = { ...batch, expiryDate: e.target.value };
                                    setEditedData({ ...editedData, Batches: newBatches });
                                }}
                                style={{ fontSize: '0.75rem', padding: '2px 6px', width: '122px' }}
                            />
                        ) : (
                            safeFormatDate(batch.expiryDate)
                        )}
                    </span>
                    {batch.supplier && (
                        <>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Truck size={11} /> {batch.supplier}
                            </span>
                        </>
                    )}
                    {batch.supplierBatchNumber && (
                        <>
                            <span>•</span>
                            <span>Supplier Lot: {batch.supplierBatchNumber}</span>
                        </>
                    )}
                    {batch.manufacturingDate && (
                        <>
                            <span>•</span>
                            <span>Mfg: {safeFormatDate(batch.manufacturingDate)}</span>
                        </>
                    )}
                </div>

                <div className="inv-batch-card-footer">
                    <div className="inv-batch-audit-copy">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                            <User size={11} />
                            Created by <strong>{batch.createdByUsername || 'System'}</strong>
                            <Clock size={11} style={{ marginLeft: '0.25rem' }} />
                            {safeFormatDateTime(createdTimestamp)}
                        </span>
                        {(statusMeta.key === 'deleted' || statusMeta.key === 'archived') && (
                            <span style={{ color: statusMeta.key === 'deleted' ? '#b91c1c' : '#475569' }}>
                                {statusMeta.label} by <strong>{batch.deletedByUsername || 'Authorized user'}</strong>
                                {batch.deletedAt ? ` on ${safeFormatDateTime(batch.deletedAt)}` : ''}
                                {batch.deletionReason ? ` — ${batch.deletionReason}` : ''}
                            </span>
                        )}
                    </div>

                    {isDeletable && !isHistoryView && (
                        <button
                            type="button"
                            className="inv-batch-delete-btn"
                            disabled={batchSaving}
                            title={`Delete batch ${batch.batchNumber}`}
                            aria-label={`Delete batch ${batch.batchNumber}`}
                            onClick={() => openDeleteDialog(batch)}
                        >
                            <Trash2 size={15} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="inv-sidebar-overlay" onClick={onClose}>
            <div className="inv-sidebar" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="inv-sidebar-header">
                    <div>
                        <span className="warehouse-tag" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>PRODUCT STOCK CARD</span>
                        {isEditing ? (
                            <input
                                className="asm-input"
                                value={editedData.name || ""}
                                onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                                style={{ fontSize: '1.25rem', fontWeight: 800, width: '100%' }}
                            />
                        ) : (
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{medicine.name}</h2>
                        )}

                        {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <input
                                    className="asm-input"
                                    placeholder="Generic Name"
                                    value={editedData.genericName || ""}
                                    onChange={(e) => setEditedData({ ...editedData, genericName: e.target.value })}
                                    style={{ fontSize: '0.85rem' }}
                                />
                                <input
                                    className="asm-input"
                                    placeholder="Strength/Dosage"
                                    value={editedData.strength || ""}
                                    onChange={(e) => setEditedData({ ...editedData, strength: e.target.value })}
                                    style={{ fontSize: '0.85rem' }}
                                />
                            </div>
                        ) : (
                            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                {medicine.genericName} • {medicine.strength || medicine.dosage}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        aria-label="Close stock card"
                        onClick={onClose}
                        style={{ border: 'none', background: '#f1f5f9', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="inv-sidebar-content">
                    {/* Overview Stats */}
                    <div className="inv-sidebar-section">
                        <h3><BarChart3 size={16} color="var(--primary)" /> Inventory Overview</h3>
                        <div className="inv-detail-grid" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px' }}>
                            {/* Product Image Section */}
                            <div className="inv-product-image-container">
                                {editedData.imageUrl ? (
                                    <>
                                        <img src={editedData.imageUrl} alt={medicine.name} className="inv-image-preview" />
                                        {isEditing && (
                                            <div className="inv-image-overlay">
                                                <button type="button" className="inv-image-action-btn" onClick={removeImage} title="Remove Image">
                                                    <Trash2 size={16} color="#ef4444" />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="inv-image-placeholder" onClick={() => isEditing && fileInputRef.current.click()} style={{ cursor: isEditing ? 'pointer' : 'default' }}>
                                        <ImagePlus size={24} />
                                        <span>{isEditing ? 'Upload Image' : 'No Image'}</span>
                                    </div>
                                )}
                                {isEditing && (
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                )}
                            </div>

                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Current Stock</span>
                                {isEditing ? (
                                    <>
                                        <input
                                            type="number"
                                            className="asm-input"
                                            value={editedData.totalQuantity ?? 0}
                                            onChange={(e) => setEditedData({ ...editedData, totalQuantity: parseInt(e.target.value, 10) || 0 })}
                                            style={{ height: '24px', padding: '2px 8px', width: '80px', fontSize: '1.1rem' }}
                                        />
                                        {Number(editedData.totalQuantity || 0) > totalQty && (
                                            <span style={{ fontSize: '0.68rem', color: '#0f766e', fontWeight: 600 }}>
                                                +{Number(editedData.totalQuantity) - totalQty} units will create a new batch
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="inv-detail-value" style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{totalQty} Units</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Avg. Selling Price</span>
                                {isEditing ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <span style={{ color: '#64748b' }}>K</span>
                                        <input
                                            type="number"
                                            className="asm-input"
                                            value={editedData.sellingPrice ?? 0}
                                            onChange={(e) => setEditedData({ ...editedData, sellingPrice: parseFloat(e.target.value) || 0 })}
                                            style={{ height: '24px', padding: '2px 8px', width: '80px' }}
                                        />
                                    </div>
                                ) : (
                                    <span className="inv-detail-value">K{referenceBatch ? referenceBatch.sellingPrice : Number(medicine.basePrice || 0).toFixed(2)}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Cost Price (Supplier)</span>
                                {isEditing ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <span style={{ color: '#64748b' }}>K</span>
                                        <input
                                            type="number"
                                            className="asm-input"
                                            value={editedData.costPrice ?? 0}
                                            onChange={(e) => setEditedData({ ...editedData, costPrice: parseFloat(e.target.value) || 0 })}
                                            style={{ height: '24px', padding: '2px 8px', width: '80px' }}
                                        />
                                    </div>
                                ) : (
                                    <span className="inv-detail-value">K{referenceBatch ? referenceBatch.costPrice : '0.00'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Stock Status</span>
                                <span className="inv-detail-value" style={{ color: totalQty > (medicine.lowStockThreshold || 10) ? '#166534' : '#b91c1c' }}>
                                    {totalQty > (medicine.lowStockThreshold || 10) ? 'Stable' : 'Critical'}
                                </span>
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Threshold</span>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        className="asm-input"
                                        value={editedData.lowStockThreshold}
                                        onChange={(e) => setEditedData({ ...editedData, lowStockThreshold: parseInt(e.target.value, 10) })}
                                        style={{ height: '24px', padding: '2px 8px' }}
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
                                    <select className="asm-input" required value={editedData.mainCategoryId || ""} onChange={(e) => changeClassification('mainCategoryId', e.target.value)}>
                                        <option value="">Select main category...</option>
                                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                ) : (
                                    <span className="inv-detail-value">{medicine.MainCategory?.name || medicine.category || 'Unclassified'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Subcategory</span>
                                {isEditing ? (
                                    <select className="asm-input" disabled={!selectedCategory} value={editedData.subcategoryId || ""} onChange={(e) => changeClassification('subcategoryId', e.target.value)}>
                                        <option value="">Select subcategory...</option>
                                        {selectedCategory?.subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                                    </select>
                                ) : (
                                    <span className="inv-detail-value">{medicine.Subcategory?.name || '—'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Product Form</span>
                                {isEditing ? (
                                    <select className="asm-input" disabled={!selectedSubcategory} value={editedData.productFormId || ""} onChange={(e) => changeClassification('productFormId', e.target.value)}>
                                        <option value="">Select product form...</option>
                                        {selectedSubcategory?.forms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
                                    </select>
                                ) : (
                                    <span className="inv-detail-value">{medicine.ProductForm?.name || medicine.dosage || '—'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Brand Name</span>
                                {isEditing ? (
                                    <input className="asm-input" value={editedData.brandName || ""} onChange={(e) => setEditedData({ ...editedData, brandName: e.target.value })} />
                                ) : (
                                    <span className="inv-detail-value">{medicine.brandName || 'Not specified'}</span>
                                )}
                            </div>
                            <div className="inv-detail-item">
                                <span className="inv-detail-label">Pack Size / Unit</span>
                                {isEditing ? (
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <input className="asm-input" aria-label="Pack size" placeholder="Pack size" value={editedData.packSize || ""} onChange={(e) => setEditedData({ ...editedData, packSize: e.target.value })} />
                                        <input className="asm-input" aria-label="Unit of measure" placeholder="Unit" value={editedData.unitOfMeasure || ""} onChange={(e) => setEditedData({ ...editedData, unitOfMeasure: e.target.value })} />
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
                                        onChange={(e) => setEditedData({ ...editedData, manufacturer: e.target.value })}
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
                                        onChange={(e) => setEditedData({ ...editedData, supplier: e.target.value })}
                                    />
                                ) : (
                                    <span className="inv-detail-value">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
                                            onChange={(e) => setEditedData({ ...editedData, prescriptionRequired: e.target.value === 'true' })}
                                        >
                                            <option value="false">Not Required</option>
                                            <option value="true">Required</option>
                                        </select>
                                    ) : (
                                        medicine.prescriptionRequired ?
                                            <span style={{ color: '#b91c1c' }}><ShieldCheck size={12} /> Required</span> :
                                            <span style={{ color: '#64748b' }}>Not Required</span>
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
                                            onChange={(e) => setEditedData({ ...editedData, isCustomerVisible: e.target.value === 'true' })}
                                        >
                                            <option value="true">Visible to Customers</option>
                                            <option value="false">Hidden from Store</option>
                                        </select>
                                    ) : (
                                        medicine.isCustomerVisible !== false ?
                                            <span style={{ color: '#166534' }}>Visible</span> :
                                            <span style={{ color: '#64748b' }}>Hidden</span>
                                    )}
                                </span>
                            </div>
                            <div className="inv-detail-item" style={{ gridColumn: '1 / -1' }}>
                                <span className="inv-detail-label">Store Description</span>
                                {isEditing ? (
                                    <textarea
                                        className="asm-input"
                                        rows="2"
                                        value={editedData.description || ""}
                                        onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                                        placeholder="Customer-facing description for the online store..."
                                        style={{ width: '100%', resize: 'vertical', marginTop: '4px' }}
                                    />
                                ) : (
                                    <span className="inv-detail-value" style={{ fontSize: '0.85rem', color: medicine.description ? 'inherit' : '#94a3b8' }}>
                                        {medicine.description || 'No description provided'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Batch Log & History */}
                    <div className="inv-sidebar-section">
                        <div className="inv-batch-section-header">
                            <h3><History size={16} color="var(--primary)" /> Batch Logs &amp; Provenance</h3>
                            {canManageBatches && (
                                <button
                                    type="button"
                                    className="inv-batch-add-toggle"
                                    onClick={() => {
                                        setBatchTab('active');
                                        setShowAddBatchForm((prev) => !prev);
                                    }}
                                >
                                    <Plus size={14} /> {showAddBatchForm ? 'Close Form' : 'Add Stock Batch'}
                                </button>
                            )}
                        </div>

                        <div className="inv-batch-tabs" role="tablist" aria-label="Batch views">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={batchTab === 'active'}
                                className={`inv-batch-tab ${batchTab === 'active' ? 'is-active' : ''}`}
                                onClick={() => setBatchTab('active')}
                            >
                                Batches ({(editedData.Batches || []).length})
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={batchTab === 'history'}
                                className={`inv-batch-tab ${batchTab === 'history' ? 'is-active' : ''}`}
                                onClick={() => setBatchTab('history')}
                            >
                                Batch History {historyData.loaded ? `(${historyData.batches.length})` : ''}
                            </button>
                        </div>

                        {canManageBatches && (showAddBatchForm || isEditing) && batchTab === 'active' && (
                            <div style={{ padding: '0.85rem', border: '1px solid #ccfbf1', background: '#f8fffe', borderRadius: '10px' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f766e', marginBottom: '0.45rem' }}>
                                    Add New Stock Batch
                                </div>
                                <div className="inv-batch-auto-note">
                                    Batch number is generated automatically on save (format: <code>MQ-{medicine.id}-YYYYMMDD-HHMMSS-USERID</code>).
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <input
                                        className="asm-input"
                                        aria-label="Batch quantity"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={batchDraft.quantity}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, quantity: e.target.value })}
                                        placeholder="Quantity *"
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Supplier batch number"
                                        value={batchDraft.supplierBatchNumber}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, supplierBatchNumber: e.target.value })}
                                        placeholder="Supplier batch # (optional)"
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Batch cost price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={batchDraft.costPrice}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, costPrice: e.target.value })}
                                        placeholder="Purchase price / unit"
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Batch selling price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={batchDraft.sellingPrice}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, sellingPrice: e.target.value })}
                                        placeholder="Selling price / unit"
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Batch expiry date"
                                        type="date"
                                        title="Expiry date"
                                        value={batchDraft.expiryDate}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, expiryDate: e.target.value })}
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Batch manufacturing date"
                                        type="date"
                                        title="Manufacturing date (optional)"
                                        value={batchDraft.manufacturingDate}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, manufacturingDate: e.target.value })}
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Batch supplier"
                                        value={batchDraft.supplier}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, supplier: e.target.value })}
                                        placeholder="Supplier"
                                    />
                                    <input
                                        className="asm-input"
                                        aria-label="Batch warehouse"
                                        value={batchDraft.warehouse}
                                        onChange={(e) => setBatchDraft({ ...batchDraft, warehouse: e.target.value })}
                                        placeholder="Warehouse"
                                    />
                                    <button
                                        type="button"
                                        className="asm-btn asm-btn-primary"
                                        style={{ gridColumn: '1 / -1', justifyContent: 'center' }}
                                        disabled={batchSaving}
                                        onClick={handleAddBatch}
                                    >
                                        <Plus size={16} /> {batchSaving ? 'Saving…' : 'Create New Batch'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {batchTab === 'active' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {(editedData.Batches || []).length === 0 ? (
                                    <div style={{ padding: '1rem', borderRadius: '8px', background: '#f8fafc', color: '#64748b', fontSize: '0.82rem', textAlign: 'center' }}>
                                        No active batches found. Add stock to generate a tracked batch.
                                    </div>
                                ) : (
                                    (editedData.Batches || []).map((batch, index) =>
                                        renderBatchCard(batch, index, { editable: isEditing, isHistoryView: false })
                                    )
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        Showing active, depleted, archived, and deleted batches
                                    </span>
                                    <button
                                        type="button"
                                        className="inv-batch-copy-btn"
                                        style={{ width: 'auto', padding: '0 0.5rem', gap: '0.25rem', fontSize: '0.72rem' }}
                                        onClick={() => loadBatchHistory(medicine.id)}
                                        disabled={historyData.loading}
                                    >
                                        <RefreshCw size={12} /> Refresh
                                    </button>
                                </div>

                                {historyData.loading && (
                                    <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                                        Loading batch history…
                                    </div>
                                )}

                                {historyData.error && (
                                    <div className="inv-batch-modal-error" role="alert">
                                        {historyData.error}
                                    </div>
                                )}

                                {!historyData.loading && !historyData.error && (
                                    <>
                                        {historyData.batches.length === 0 ? (
                                            <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                                                No batch history recorded yet.
                                            </div>
                                        ) : (
                                            historyData.batches.map((batch, index) =>
                                                renderBatchCard(batch, index, { editable: false, isHistoryView: true })
                                            )
                                        )}

                                        {historyData.movements.length > 0 && (
                                            <div className="inv-batch-history-movements">
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                    Stock Movements ({historyData.movements.length})
                                                </div>
                                                {historyData.movements.slice(0, 25).map((movement) => {
                                                    const delta = Number(movement.quantityChange || 0);
                                                    return (
                                                        <div key={movement.id} className="inv-batch-movement-row">
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontWeight: 700, color: '#1e293b' }}>
                                                                    {movement.movementType}
                                                                    {movement.referenceType ? ` • ${movement.referenceType}` : ''}
                                                                </div>
                                                                <div style={{ color: '#64748b', marginTop: '0.1rem' }}>
                                                                    {movement.reason || 'Inventory update'}
                                                                </div>
                                                                <div style={{ color: '#94a3b8', fontSize: '0.68rem', marginTop: '0.15rem' }}>
                                                                    {safeFormatDateTime(movement.createdAt)}
                                                                </div>
                                                            </div>
                                                            <strong style={{ color: delta >= 0 ? '#166534' : '#b91c1c', whiteSpace: 'nowrap' }}>
                                                                {delta > 0 ? `+${delta}` : delta}
                                                            </strong>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="inv-sidebar-footer">
                    {isEditing ? (
                        <>
                            <button type="button" className="asm-btn asm-btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>
                                Cancel
                            </button>
                            <button type="button" className="asm-btn asm-btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                                <Save size={18} /> Save Changes
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="asm-btn asm-btn-secondary" style={{ flex: 1 }}>
                                <Printer size={18} /> Print Labels
                            </button>
                            <button type="button" className="asm-btn asm-btn-secondary" style={{ flex: 1 }}>
                                <ArrowRightLeft size={18} /> Transfer
                            </button>
                            {canManageBatches && (
                                <button type="button" className="asm-btn asm-btn-primary" style={{ flex: 1 }} onClick={() => setIsEditing(true)}>
                                    <Edit size={18} /> Edit Product
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <BatchDeleteModal
                isOpen={Boolean(pendingDeleteBatch)}
                batch={pendingDeleteBatch}
                productName={medicine.name}
                onCancel={closeDeleteDialog}
                onConfirmDelete={handleConfirmDeleteBatch}
                onConfirmArchive={handleConfirmArchiveBatch}
                isSubmitting={batchSaving}
                errorMessage={deleteModalError}
                canArchiveFallback={deleteModalCanArchive}
            />
        </div>
    );
}
