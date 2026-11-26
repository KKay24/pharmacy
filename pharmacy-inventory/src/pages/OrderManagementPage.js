import React, { useCallback, useContext, useEffect, useState } from "react";
import { Check, Clock3, Package, RefreshCw, Search } from "lucide-react";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import { DataContext } from "../context/DataContext";
import "../styles/orderManagement.css";

const ORDER_STATUSES = [
  "Order Placed",
  "Confirmed",
  "Preparing",
  "Ready",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const ORDER_FILTERS = [
  ["new", "New orders"],
  ["paid", "Paid orders"],
  ["preorders", "Preorders"],
  ["awaiting-stock", "Awaiting stock"],
  ["processing", "Processing"],
  ["ready-pickup", "Ready for pickup"],
  ["ready-dispatch", "Ready for dispatch"],
  ["out-for-delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function OrderManagementPage() {
  const { userRole } = useContext(DataContext) || {};
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [notice, setNotice] = useState("");
  const [cancellationTarget, setCancellationTarget] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState(null);
  const [yangoDetails, setYangoDetails] = useState({
    yangoReference: "",
    yangoRiderDetails: "",
    yangoFee: "",
    trackingLink: "",
  });
  const [pickupReference, setPickupReference] = useState("");
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState("");
  const [replenishmentTasks, setReplenishmentTasks] = useState([]);
  const [replenishmentLoading, setReplenishmentLoading] = useState(false);
  const [replenishmentError, setReplenishmentError] = useState("");
  const [replenishmentNotice, setReplenishmentNotice] = useState("");
  const [taskEstimates, setTaskEstimates] = useState({});
  const [savingTaskId, setSavingTaskId] = useState(null);

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), limit: "100" });
      if (statusFilter) query.set("filter", statusFilter);
      const response = await apiFetch(`/api/orders?${query}`);
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Could not load online store orders."));
      }
      const payload = await response.json();
      setOrders(payload.data || []);
      setPagination(payload.pagination || null);
    } catch (loadError) {
      setOrders([]);
      setPagination(null);
      setError(loadError.message || "Could not load online store orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!["admin", "manager"].includes(userRole)) return undefined;
    let active = true;
    const to = new Date();
    to.setDate(to.getDate() + 1);
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    const query = new URLSearchParams({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    apiFetch(`/api/orders/reports/fulfillment?${query}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Order summary could not be loaded."));
        }
        return response.json();
      })
      .then((data) => {
        if (active) {
          setReport(data);
          setReportError("");
        }
      })
      .catch((loadError) => {
        if (active) setReportError(loadError.message || "Order summary could not be loaded.");
      });
    return () => { active = false; };
  }, [userRole]);

  const loadReplenishmentTasks = useCallback(async () => {
    if (!["admin", "manager", "user"].includes(userRole)) return;
    setReplenishmentLoading(true);
    setReplenishmentError("");
    try {
      const response = await apiFetch("/api/orders/replenishment-tasks");
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Replenishment tasks could not be loaded."));
      }
      const tasks = await response.json();
      setReplenishmentTasks(Array.isArray(tasks)
        ? tasks.filter((task) => Number(task.outstandingQuantity) > 0 && !["Cancelled", "Received"].includes(task.status))
        : []);
    } catch (loadError) {
      setReplenishmentError(loadError.message || "Replenishment tasks could not be loaded.");
      setReplenishmentTasks([]);
    } finally {
      setReplenishmentLoading(false);
    }
  }, [userRole]);

  useEffect(() => {
    loadReplenishmentTasks();
  }, [loadReplenishmentTasks]);

  const updateReplenishmentEstimate = async (event, task) => {
    event.preventDefault();
    const values = taskEstimates[task.id] || {};
    setSavingTaskId(task.id);
    setReplenishmentError("");
    setReplenishmentNotice("");
    try {
      const response = await apiFetch(`/api/orders/replenishment-tasks/${task.id}/estimate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierConfirmedAt: new Date(values.supplierConfirmedAt).toISOString(),
          estimatedFulfillmentAt: new Date(values.estimatedFulfillmentAt).toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "The supplier-confirmed estimate could not be saved."));
      }
      setReplenishmentNotice(`Supplier-confirmed estimate saved for ${task.orderNumber}.`);
      await loadReplenishmentTasks();
    } catch (saveError) {
      setReplenishmentError(saveError.message || "The supplier-confirmed estimate could not be saved.");
    } finally {
      setSavingTaskId(null);
    }
  };

  const updateStatus = async (order, status, reason = "", metadata = {}) => {
    if (status === order.orderStatus) return;
    setSavingOrderId(order.id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(status === "Cancelled" ? { reason } : {}), ...metadata }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `Could not update order ${order.orderNumber}.`));
      }
      const updated = await response.json();
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, ...updated } : item
      )));
      setNotice(`Order ${order.orderNumber} updated to ${updated.orderStatus}.`);
      return true;
    } catch (updateError) {
      setError(updateError.message || `Could not update order ${order.orderNumber}.`);
      await loadOrders({ quiet: true });
      return false;
    } finally {
      setSavingOrderId(null);
    }
  };

  const requestDispatch = (order) => {
    setDeliveryTarget(order);
    setYangoDetails({
      yangoReference: "",
      yangoRiderDetails: "",
      yangoFee: "",
      trackingLink: "",
    });
    setError("");
  };

  const submitDispatch = async (event) => {
    event.preventDefault();
    if (!deliveryTarget) return;
    const updated = await updateStatus(deliveryTarget, "Out for Delivery", "", {
      ...yangoDetails,
      yangoFee: Number(yangoDetails.yangoFee),
    });
    if (updated) setDeliveryTarget(null);
  };

  const recordPickupHandover = async (order) => {
    setSavingOrderId(order.id);
    setError("");
    try {
      const response = await apiFetch(`/api/orders/${order.id}/pickup/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupReference: pickupReference[order.id] || "" }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Could not record pickup handover."));
      }
      const updated = await response.json();
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updated } : item));
      setNotice(`Pickup for ${order.orderNumber} recorded.`);
      setPickupReference((current) => ({ ...current, [order.id]: "" }));
    } catch (handoverError) {
      setError(handoverError.message || "Could not record pickup handover.");
    } finally {
      setSavingOrderId(null);
    }
  };

  const requestCancellation = (order) => {
    setCancellationTarget(order);
    setCancellationReason("");
    setError("");
  };

  const submitCancellation = async (event) => {
    event.preventDefault();
    const reason = cancellationReason.trim();
    if (!reason || !cancellationTarget) return;
    const cancelled = await updateStatus(cancellationTarget, "Cancelled", reason);
    if (cancelled) {
      setCancellationTarget(null);
      setCancellationReason("");
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const visibleOrders = orders.filter((order) => (
    !normalizedSearch
    || [
      order.orderNumber,
      order.customerName,
      order.customerPhone,
      order.customerEmail,
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
  ));

  return (
    <section className="order-management">
      <header className="order-management__header">
        <div>
          <p className="order-management__eyebrow">Customer store</p>
          <h2>Online Order Management</h2>
          <p>Review customer orders and update their fulfillment status.</p>
        </div>
        <button
          type="button"
          className="order-management__refresh"
          onClick={() => loadOrders({ quiet: true })}
          disabled={refreshing || loading}
        >
          <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
          Refresh
        </button>
      </header>

      <div className="order-management__notice" role="note">
        <Clock3 size={17} />
        <span>
          Orders can be confirmed only when the full requested quantity is allocated from saleable stock.
          Preorder lines remain outstanding until received; estimates are shown only after supplier confirmation.
          Payment status is set by the signed provider callback, never by this screen. Paid cancellations require a provider refund.
        </span>
      </div>

      {reportError && <p className="order-management__message order-management__message--error" role="alert">{reportError}</p>}
      {report && (
        <div className="order-management__summary" aria-label="Online order summary for the last 30 days">
          <div><span>Online sales</span><strong>ZMW {Number(report.onlineSales || 0).toFixed(2)}</strong></div>
          <div><span>Preorder sales</span><strong>ZMW {Number(report.preorderSales || 0).toFixed(2)}</strong></div>
          <div><span>Outstanding preorder value</span><strong>ZMW {Number(report.outstandingPreorderValue || 0).toFixed(2)}</strong></div>
          <div><span>Stock awaiting replenishment</span><strong>{Number(report.stockAwaitingReplenishment || 0)}</strong></div>
          <div><span>Pickup orders</span><strong>{Number(report.pickupOrders || 0)}</strong></div>
          <div><span>Yango orders</span><strong>{Number(report.yangoDeliveryOrders || 0)}</strong></div>
          <div><span>Yango delivery costs</span><strong>ZMW {Number(report.deliveryCosts || 0).toFixed(2)}</strong></div>
          <div><span>Average fulfilment</span><strong>{report.averageFulfillmentHours == null ? "—" : `${Number(report.averageFulfillmentHours).toFixed(1)} h`}</strong></div>
        </div>
      )}

      {["admin", "manager", "user"].includes(userRole) && (
        <section className="order-management__replenishment" aria-labelledby="replenishment-title">
          <div className="order-management__replenishment-heading">
            <div>
              <h3 id="replenishment-title">Stock awaiting replenishment</h3>
              <p>Only enter an ETA after the supplier confirms the replenishment date.</p>
            </div>
            <button type="button" onClick={loadReplenishmentTasks} disabled={replenishmentLoading}>
              {replenishmentLoading ? "Refreshing…" : "Refresh tasks"}
            </button>
          </div>
          {replenishmentError && <p className="order-management__message order-management__message--error" role="alert">{replenishmentError}</p>}
          {replenishmentNotice && <p className="order-management__message order-management__message--success" role="status">{replenishmentNotice}</p>}
          {replenishmentLoading ? (
            <p role="status">Loading replenishment tasks…</p>
          ) : replenishmentTasks.length === 0 ? (
            <p>No outstanding replenishment tasks.</p>
          ) : (
            <div className="order-management__task-list">
              {replenishmentTasks.map((task) => {
                const values = taskEstimates[task.id] || {
                  supplierConfirmedAt: task.supplierConfirmedAt
                    ? new Date(task.supplierConfirmedAt).toISOString().slice(0, 16)
                    : "",
                  estimatedFulfillmentAt: task.estimatedFulfillmentAt
                    ? new Date(task.estimatedFulfillmentAt).toISOString().slice(0, 16)
                    : "",
                };
                return (
                  <form
                    className="order-management__task"
                    key={task.id}
                    onSubmit={(event) => updateReplenishmentEstimate(event, task)}
                  >
                    <div className="order-management__task-summary">
                      <strong>{task.productName || "Product"} · {task.outstandingQuantity} outstanding</strong>
                      <span>{task.orderNumber} · {task.status}</span>
                    </div>
                    <label htmlFor={`supplier-confirmed-${task.id}`}>Supplier confirmed at</label>
                    <input
                      id={`supplier-confirmed-${task.id}`}
                      type="datetime-local"
                      value={values.supplierConfirmedAt}
                      required
                      onChange={(event) => setTaskEstimates((current) => ({
                        ...current,
                        [task.id]: { ...values, supplierConfirmedAt: event.target.value },
                      }))}
                    />
                    <label htmlFor={`fulfillment-estimate-${task.id}`}>Estimated fulfillment</label>
                    <input
                      id={`fulfillment-estimate-${task.id}`}
                      type="datetime-local"
                      value={values.estimatedFulfillmentAt}
                      required
                      onChange={(event) => setTaskEstimates((current) => ({
                        ...current,
                        [task.id]: { ...values, estimatedFulfillmentAt: event.target.value },
                      }))}
                    />
                    <button type="submit" disabled={savingTaskId === task.id}>
                      {savingTaskId === task.id ? "Saving…" : "Save confirmed ETA"}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="order-management__filters">
        <label className="order-management__search">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order, customer, or phone"
            aria-label="Search orders"
          />
        </label>
        <label>
          Order queue
          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            {ORDER_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="order-management__message order-management__message--error" role="alert">{error}</p>}
      {notice && <p className="order-management__message order-management__message--success" role="status"><Check size={16} />{notice}</p>}

      {loading ? (
        <div className="order-management__empty" role="status">Loading orders…</div>
      ) : visibleOrders.length === 0 ? (
        <div className="order-management__empty">
          <Package size={38} />
          <strong>{orders.length ? "No matching orders" : "No online orders yet"}</strong>
          <span>{orders.length ? "Try a different search." : "New customer store orders will appear here."}</span>
        </div>
      ) : (
        <div className="order-management__list">
          {visibleOrders.map((order) => (
            <article className="order-management__card" key={order.id}>
              <div className="order-management__order-heading">
                <div>
                  <strong>{order.orderNumber}</strong>
                  <span>{formatDate(order.date || order.createdAt)}</span>
                </div>
                <strong className="order-management__amount">ZMW {Number(order.totalAmount || 0).toFixed(2)}</strong>
              </div>

              <div className="order-management__details">
                <div>
                  <span className="order-management__label">Customer</span>
                  <strong>{order.customerName}</strong>
                  <span>{order.customerPhone}{order.customerEmail ? ` · ${order.customerEmail}` : ""}</span>
                </div>
                <div>
                  <span className="order-management__label">Payment</span>
                  <strong>{order.paymentMethod || "Not specified"} · {order.paymentStatus || "Pending"}</strong>
                  <span>{order.deliveryMethod === "pickup" ? "MediQuick Store Pickup" : "Yango Home Delivery"}{order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}</span>
                  {order.refundStatus && <span>Refund: {order.refundStatus}</span>}
                  {order.yangoReference && <span>Yango reference: {order.yangoReference}{order.yangoFee !== null ? ` · Actual fee ZMW ${Number(order.yangoFee).toFixed(2)}` : ""}</span>}
                </div>
              </div>

              <details className="order-management__items">
                <summary>{Array.isArray(order.items) ? order.items.length : 0} item(s) · Order details</summary>
                <ul>
                  {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                    <li key={`${item.id || item.medicineId || item.name}-${index}`}>
                      <span>
                        {item.name} × {item.quantity}
                        {item.preorderQuantity > 0 && ` · preorder ${item.preorderQuantity}`}
                        {item.outstandingPreorderQuantity > 0 && ` · awaiting ${item.outstandingPreorderQuantity}`}
                        {item.estimatedFulfillmentAt && ` · ETA ${formatDate(item.estimatedFulfillmentAt)}`}
                        {item.fulfillmentStatus && ` · ${item.fulfillmentStatus}`}
                      </span>
                      <strong>ZMW {Number(item.total || Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</strong>
                    </li>
                  ))}
                </ul>
                {order.notes && <p><strong>Customer note:</strong> {order.notes}</p>}
              </details>

              <div className="order-management__status">
                <label htmlFor={`order-status-${order.id}`}>Fulfillment status</label>
                <select
                  id={`order-status-${order.id}`}
                  value={order.orderStatus}
                  disabled={savingOrderId === order.id || order.orderStatus === "Cancelled"}
                  onChange={(event) => {
                    if (event.target.value === "Cancelled") requestCancellation(order);
                    else if (event.target.value === "Out for Delivery") requestDispatch(order);
                    else updateStatus(order, event.target.value);
                  }}
                >
                  {ORDER_STATUSES.map((status) => (
                    <option
                      key={status}
                      disabled={
                        (status === "Confirmed" && (
                          order.paymentStatus !== "Paid"
                          || (Array.isArray(order.items) && order.items.some((item) => Number(item.outstandingPreorderQuantity) > 0))
                        ))
                        || (status === "Out for Delivery" && order.deliveryMethod !== "delivery")
                      }
                    >
                      {status}
                    </option>
                  ))}
                </select>
                {savingOrderId === order.id && <span role="status">Saving…</span>}
                {order.orderStatus !== "Cancelled" && (
                  <button
                    type="button"
                    className="order-management__cancel"
                    disabled={savingOrderId === order.id}
                    onClick={() => requestCancellation(order)}
                  >
                    Cancel order
                  </button>
                )}
              </div>
              {order.deliveryMethod === "pickup" && order.orderStatus === "Ready" && order.pickupReference && (
                <div className="order-management__pickup">
                  <p><strong>Pickup reference:</strong> {order.pickupReference}</p>
                  <label htmlFor={`pickup-ref-${order.id}`}>Scan or enter customer reference</label>
                  <input
                    id={`pickup-ref-${order.id}`}
                    value={pickupReference[order.id] || ""}
                    onChange={(event) => setPickupReference((current) => ({ ...current, [order.id]: event.target.value }))}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    disabled={savingOrderId === order.id || !pickupReference[order.id]?.trim()}
                    onClick={() => recordPickupHandover(order)}
                  >
                    Record handover
                  </button>
                </div>
              )}
              {order.cancellationReason && (
                <p className="order-management__cancellation-reason">
                  <strong>Cancellation reason:</strong> {order.cancellationReason}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="order-management__pagination" aria-label="Order pages">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} orders</span>
          <button
            type="button"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}

      {cancellationTarget && (
        <div className="order-management__modal-backdrop">
          <form
            className="order-management__cancel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-cancel-title"
            onSubmit={submitCancellation}
          >
            <h3 id="order-cancel-title">Cancel order {cancellationTarget.orderNumber}?</h3>
            <p>Enter the reason for cancellation. This will be saved with the order for staff review.</p>
            <label htmlFor="order-cancel-reason">Cancellation reason <span aria-hidden="true">*</span></label>
            <textarea
              id="order-cancel-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              rows={4}
              maxLength={2000}
              required
              autoFocus
            />
            <div className="order-management__cancel-actions">
              <button type="button" onClick={() => setCancellationTarget(null)} disabled={savingOrderId === cancellationTarget.id}>
                Keep order
              </button>
              <button
                type="submit"
                className="order-management__cancel"
                disabled={savingOrderId === cancellationTarget.id || !cancellationReason.trim()}
              >
                {savingOrderId === cancellationTarget.id ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </div>
          </form>
        </div>
      )}
      {deliveryTarget && (
        <div className="order-management__modal-backdrop">
          <form
            className="order-management__cancel-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="yango-dispatch-title"
            onSubmit={submitDispatch}
          >
            <h3 id="yango-dispatch-title">Book Yango delivery · {deliveryTarget.orderNumber}</h3>
            <p>Enter the details from the manual Yango booking. Prescription information is not included in the dispatch order.</p>
            <label htmlFor="yango-reference">Yango reference <span aria-hidden="true">*</span></label>
            <input id="yango-reference" value={yangoDetails.yangoReference} onChange={(event) => setYangoDetails((current) => ({ ...current, yangoReference: event.target.value }))} required maxLength={120} />
            <label htmlFor="yango-rider">Rider details</label>
            <input id="yango-rider" value={yangoDetails.yangoRiderDetails} onChange={(event) => setYangoDetails((current) => ({ ...current, yangoRiderDetails: event.target.value }))} maxLength={1000} />
            <label htmlFor="yango-fee">Actual Yango fee (ZMW) <span aria-hidden="true">*</span></label>
            <input id="yango-fee" type="number" min="0" step="0.01" value={yangoDetails.yangoFee} onChange={(event) => setYangoDetails((current) => ({ ...current, yangoFee: event.target.value }))} required />
            <label htmlFor="yango-tracking">Tracking link</label>
            <input id="yango-tracking" type="url" value={yangoDetails.trackingLink} onChange={(event) => setYangoDetails((current) => ({ ...current, trackingLink: event.target.value }))} />
            <div className="order-management__cancel-actions">
              <button type="button" onClick={() => setDeliveryTarget(null)} disabled={savingOrderId === deliveryTarget.id}>Back</button>
              <button type="submit" disabled={savingOrderId === deliveryTarget.id}>
                {savingOrderId === deliveryTarget.id ? "Saving…" : "Save and dispatch"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
