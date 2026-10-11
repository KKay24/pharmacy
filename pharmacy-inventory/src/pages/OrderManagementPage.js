import React, { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Package, RefreshCw, Search } from "lucide-react";
import { apiFetch, getApiErrorMessage } from "../utils/api";
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

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function OrderManagementPage() {
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

  const loadOrders = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ page: String(page), limit: "100" });
      if (statusFilter) query.set("status", statusFilter);
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

  const updateStatus = async (order, status) => {
    if (status === order.orderStatus) return;
    setSavingOrderId(order.id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `Could not update order ${order.orderNumber}.`));
      }
      const updated = await response.json();
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, ...updated } : item
      )));
      setNotice(`Order ${order.orderNumber} updated to ${updated.orderStatus}.`);
    } catch (updateError) {
      setError(updateError.message || `Could not update order ${order.orderNumber}.`);
      await loadOrders({ quiet: true });
    } finally {
      setSavingOrderId(null);
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
          Store checkout records payment as pending. Updating fulfillment status does not confirm or collect payment.
          Cancelling an order does not automatically restore its stock.
        </span>
      </div>

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
          Fulfillment status
          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
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
                  <span>{order.deliveryMethod === "pickup" ? "Store pickup" : "Delivery"}{order.deliveryAddress ? ` · ${order.deliveryAddress}` : ""}</span>
                </div>
              </div>

              <details className="order-management__items">
                <summary>{Array.isArray(order.items) ? order.items.length : 0} item(s) · Order details</summary>
                <ul>
                  {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                    <li key={`${item.id || item.medicineId || item.name}-${index}`}>
                      <span>{item.name} × {item.quantity}</span>
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
                  disabled={savingOrderId === order.id}
                  onChange={(event) => updateStatus(order, event.target.value)}
                >
                  {ORDER_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
                {savingOrderId === order.id && <span role="status">Saving…</span>}
              </div>
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
    </section>
  );
}
