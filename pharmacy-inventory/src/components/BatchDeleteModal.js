import React, { useEffect, useState } from "react";
import { AlertTriangle, Archive, Trash2, X } from "lucide-react";

export default function BatchDeleteModal({
  isOpen,
  batch,
  productName,
  onCancel,
  onConfirmDelete,
  onConfirmArchive,
  isSubmitting = false,
  errorMessage = "",
  canArchiveFallback = false,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
    }
  }, [isOpen, batch?.id]);

  if (!isOpen || !batch) return null;

  const remainingQty = Number(batch.quantity || 0);

  return (
    <div
      className="inv-batch-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-delete-modal-title"
      onClick={(e) => {
        e.stopPropagation();
        if (!isSubmitting) onCancel?.();
      }}
    >
      <div className="inv-batch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="inv-batch-modal-header">
          <div className="inv-batch-modal-title-row">
            <span className="inv-batch-modal-icon" aria-hidden="true">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h3 id="batch-delete-modal-title">Delete Stock Batch</h3>
              <p className="inv-batch-modal-subtitle">
                This batch will be marked as deleted and preserved in batch history.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inv-batch-modal-close"
            aria-label="Close confirmation dialog"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            <X size={18} />
          </button>
        </div>

        <div className="inv-batch-modal-body">
          <div className="inv-batch-modal-summary">
            <div className="inv-batch-modal-summary-row">
              <span>Product</span>
              <strong>{productName || "Unknown Product"}</strong>
            </div>
            <div className="inv-batch-modal-summary-row">
              <span>Batch Number</span>
              <code className="inv-batch-code-pill">{batch.batchNumber || `Batch #${batch.id}`}</code>
            </div>
            <div className="inv-batch-modal-summary-row">
              <span>Remaining Quantity</span>
              <strong>{remainingQty} {remainingQty === 1 ? "unit" : "units"}</strong>
            </div>
          </div>

          <label className="inv-batch-modal-label" htmlFor="batch-delete-reason">
            Deletion reason (optional)
          </label>
          <input
            id="batch-delete-reason"
            type="text"
            className="asm-input inv-batch-modal-input"
            placeholder="e.g. Damaged stock, expired batch, entry error..."
            value={reason}
            disabled={isSubmitting}
            onChange={(e) => setReason(e.target.value)}
          />

          {errorMessage && (
            <div className="inv-batch-modal-error" role="alert">
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="inv-batch-modal-actions">
          <button
            type="button"
            className="asm-btn asm-btn-secondary"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </button>

          {canArchiveFallback && onConfirmArchive && (
            <button
              type="button"
              className="asm-btn inv-batch-archive-confirm-btn"
              disabled={isSubmitting}
              onClick={() => onConfirmArchive(batch, reason)}
            >
              <Archive size={16} />
              {isSubmitting ? "Archiving…" : "Archive Batch"}
            </button>
          )}

          <button
            type="button"
            className="asm-btn inv-batch-delete-confirm-btn"
            disabled={isSubmitting}
            onClick={() => onConfirmDelete?.(batch, reason)}
          >
            <Trash2 size={16} />
            {isSubmitting ? "Deleting…" : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
