import React, { useCallback, useEffect, useState } from "react";
import { Check, Mail, MessageSquare, Phone, RefreshCw, Search, Headset } from "lucide-react";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import "../styles/supportCenter.css";

const INQUIRY_STATUSES = ["New", "Contacted", "Resolved"];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
}

export default function SupportCenterPage() {
  const [inquiries, setInquiries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingInquiryId, setSavingInquiryId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInquiries = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ page: String(page), limit: "100" });
      if (statusFilter) query.set("status", statusFilter);
      if (search.trim()) query.set("search", search.trim());
      const response = await apiFetch(`/api/support/inquiries?${query}`);
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Could not load customer inquiries."));
      }
      const payload = await response.json();
      setInquiries(payload.data || []);
      setPagination(payload.pagination || null);
    } catch (loadError) {
      setInquiries([]);
      setPagination(null);
      setError(loadError.message || "Could not load customer inquiries.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  const updateStatus = async (inquiry, status) => {
    if (status === inquiry.status) return;
    setSavingInquiryId(inquiry.id);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/support/inquiries/${inquiry.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Could not update inquiry status."));
      }
      const updated = await response.json();
      setInquiries((current) => current.map((item) => (
        item.id === inquiry.id ? { ...item, ...updated } : item
      )));
      setNotice(`Inquiry from ${inquiry.name} marked ${updated.status}.`);
      await loadInquiries({ quiet: true });
    } catch (updateError) {
      setError(updateError.message || "Could not update inquiry status.");
      await loadInquiries({ quiet: true });
    } finally {
      setSavingInquiryId(null);
    }
  };

  const pageStatusCounts = INQUIRY_STATUSES.map((status) => ({
    status,
    count: inquiries.filter((inquiry) => inquiry.status === status).length,
  }));

  return (
    <section className="support-center">
      <header className="support-center__header">
        <div>
          <p className="support-center__eyebrow">Customer care</p>
          <h2>Pharmacy Support Center</h2>
          <p>Review customer messages, contact customers, and keep inquiry progress up to date.</p>
        </div>
        <button
          type="button"
          className="support-center__refresh"
          onClick={() => loadInquiries({ quiet: true })}
          disabled={refreshing || loading}
        >
          <RefreshCw size={16} className={refreshing ? "support-center__spinning" : ""} />
          Refresh
        </button>
      </header>

      <div className="support-center__summary" aria-label="Inquiry status counts on this page">
        <div className="support-center__total">
          <MessageSquare size={20} />
          <span><strong>{pagination?.total ?? inquiries.length}</strong>Total inquiries</span>
        </div>
        {pageStatusCounts.map(({ status, count }) => (
          <div className={`support-center__count support-center__count--${status.toLowerCase()}`} key={status}>
            <strong>{count}</strong>
            <span>{status} on this page</span>
          </div>
        ))}
      </div>

      <div className="support-center__filters">
        <label className="support-center__search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search customer, contact, topic, or message"
            aria-label="Search inquiries"
          />
        </label>
        <label className="support-center__status-filter">
          Inquiry status
          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            {INQUIRY_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="support-center__message support-center__message--error" role="alert">{error}</p>}
      {notice && <p className="support-center__message support-center__message--success" role="status"><Check size={16} />{notice}</p>}

      {loading ? (
        <div className="support-center__empty" role="status">Loading customer inquiries…</div>
      ) : inquiries.length === 0 ? (
        <div className="support-center__empty">
          <Headset size={38} />
          <strong>{search || statusFilter ? "No matching inquiries" : "No customer inquiries yet"}</strong>
          <span>{search || statusFilter ? "Try changing the search or status filter." : "Messages submitted through the pharmacy store will appear here."}</span>
        </div>
      ) : (
        <div className="support-center__list">
          {inquiries.map((inquiry) => (
            <article className="support-center__card" key={inquiry.id}>
              <div className="support-center__card-heading">
                <div>
                  <span className={`support-center__badge support-center__badge--${String(inquiry.status || "New").toLowerCase()}`}>
                    {inquiry.status || "New"}
                  </span>
                  <h3>{inquiry.inquiryType}</h3>
                  <time dateTime={inquiry.date}>{formatDate(inquiry.date || inquiry.createdAt)}</time>
                </div>
                <strong className="support-center__customer-name">{inquiry.name}</strong>
              </div>

              <p className="support-center__message-body">{inquiry.message}</p>

              <div className="support-center__contact-actions" aria-label={`Contact ${inquiry.name}`}>
                <a href={`tel:${inquiry.phone}`}><Phone size={16} />{inquiry.phone}</a>
                {inquiry.email && <a href={`mailto:${inquiry.email}`}><Mail size={16} />{inquiry.email}</a>}
              </div>

              <div className="support-center__card-footer">
                <span>Update this status after contacting the customer through the selected channel.</span>
                <label htmlFor={`inquiry-status-${inquiry.id}`}>
                  Status
                  <select
                    id={`inquiry-status-${inquiry.id}`}
                    value={inquiry.status || "New"}
                    disabled={savingInquiryId === inquiry.id}
                    onChange={(event) => updateStatus(inquiry, event.target.value)}
                  >
                    {INQUIRY_STATUSES.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
                {savingInquiryId === inquiry.id && <span role="status">Saving…</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="support-center__pagination" aria-label="Inquiry pages">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} inquiries</span>
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
