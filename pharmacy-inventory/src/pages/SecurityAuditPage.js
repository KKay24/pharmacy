import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Monitor,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Tablet,
  X,
  XCircle,
} from "lucide-react";
import { apiFetch, getApiErrorMessage } from "../utils/api";
import "../styles/securityAudit.css";

const FAILURE_REASON_LABELS = {
  incorrect_password: "Incorrect password",
  unknown_user: "Unknown account",
  disabled_account: "Disabled / suspended account",
  rate_limited: "Temporarily rate-limited",
  missing_credentials: "Missing credentials",
};

function formatLocalDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

function formatLocation(location) {
  if (!location) return "Unavailable";
  const parts = [location.city, location.region, location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Unavailable";
}

function DeviceIcon({ deviceType }) {
  if (deviceType === "mobile") return <Smartphone size={14} aria-hidden="true" />;
  if (deviceType === "tablet") return <Tablet size={14} aria-hidden="true" />;
  return <Monitor size={14} aria-hidden="true" />;
}

export default function SecurityAuditPage() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [geoDisclaimer, setGeoDisclaimer] = useState(
    "IP geolocation provides an approximate network location only and does not identify an exact physical address or individual."
  );

  const [page, setPage] = useState(1);
  const [email, setEmail] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [status, setStatus] = useState("");
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // IP Investigation Panel state
  const [selectedIp, setSelectedIp] = useState("");
  const [ipReport, setIpReport] = useState(null);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipError, setIpError] = useState("");

  const loadLoginActivity = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({ page: String(page), limit: "25" });
      if (email.trim()) query.set("email", email.trim());
      if (ipAddress.trim()) query.set("ipAddress", ipAddress.trim());
      if (status) query.set("status", status);
      if (suspiciousOnly) query.set("suspicious", "true");
      if (startDate) query.set("startDate", startDate);
      if (endDate) query.set("endDate", endDate);

      const response = await apiFetch(`/api/security/login-activity?${query.toString()}`);
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Could not load login activity."));
      }

      const payload = await response.json();
      setRecords(payload.data || []);
      setPagination(payload.pagination || null);
      setSummary(payload.summary || null);
      if (payload.geolocationDisclaimer) {
        setGeoDisclaimer(payload.geolocationDisclaimer);
      }
    } catch (loadError) {
      setRecords([]);
      setPagination(null);
      setSummary(null);
      setError(loadError.message || "Could not load login activity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [email, endDate, ipAddress, page, startDate, status, suspiciousOnly]);

  useEffect(() => {
    loadLoginActivity();
  }, [loadLoginActivity]);

  const handleInvestigateIp = async (targetIp) => {
    if (!targetIp || targetIp === "unknown") return;
    setSelectedIp(targetIp);
    setIpLoading(true);
    setIpError("");
    setIpReport(null);

    try {
      const response = await apiFetch(
        `/api/security/login-activity/ip/${encodeURIComponent(targetIp)}?page=1&limit=50`
      );
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, `Could not investigate IP ${targetIp}.`));
      }
      const payload = await response.json();
      setIpReport(payload);
    } catch (requestError) {
      setIpError(requestError.message || `Could not investigate IP ${targetIp}.`);
    } finally {
      setIpLoading(false);
    }
  };

  const handleResetFilters = () => {
    setPage(1);
    setEmail("");
    setIpAddress("");
    setStatus("");
    setSuspiciousOnly(false);
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = Boolean(email || ipAddress || status || suspiciousOnly || startDate || endDate);

  return (
    <section className="security-audit">
      <header className="security-audit__header">
        <div>
          <p className="security-audit__eyebrow">Administrator Monitoring</p>
          <h2>Security &amp; Login Activity</h2>
          <p>
            Track authentication attempts, detect suspicious patterns, and investigate IP addresses. All timestamps are stored in UTC and displayed in your local timezone.
          </p>
        </div>
        <button
          type="button"
          className="security-audit__refresh"
          onClick={() => loadLoginActivity({ quiet: true })}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} className={refreshing ? "security-audit__spin" : ""} />
          Refresh
        </button>
      </header>

      {/* Summary KPI Cards */}
      <div className="security-audit__summary" aria-label="Authentication activity summary">
        <div className="security-audit__kpi security-audit__kpi--total">
          <ShieldAlert size={20} aria-hidden="true" />
          <div>
            <strong>{summary?.totalAttempts ?? records.length}</strong>
            <span>Total attempts</span>
          </div>
        </div>
        <div className="security-audit__kpi security-audit__kpi--success">
          <CheckCircle2 size={20} aria-hidden="true" />
          <div>
            <strong>{summary?.successfulAttempts ?? 0}</strong>
            <span>Successful logins</span>
          </div>
        </div>
        <div className="security-audit__kpi security-audit__kpi--failed">
          <XCircle size={20} aria-hidden="true" />
          <div>
            <strong>{summary?.failedAttempts ?? 0}</strong>
            <span>Failed attempts</span>
          </div>
        </div>
        <div className="security-audit__kpi security-audit__kpi--suspicious">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>{summary?.suspiciousAttempts ?? 0}</strong>
            <span>Suspicious events</span>
          </div>
        </div>
        <div className="security-audit__kpi security-audit__kpi--ips">
          <Globe size={20} aria-hidden="true" />
          <div>
            <strong>{summary?.uniqueIps ?? 0}</strong>
            <span>Unique IPs</span>
          </div>
        </div>
      </div>

      {/* Top Suspicious IPs quick bar */}
      {summary?.topSuspiciousIps?.length > 0 && (
        <div className="security-audit__alerts-bar" role="region" aria-label="Suspicious IP addresses">
          <div className="security-audit__alerts-title">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Suspicious IP activity detected — click an IP to investigate:</span>
          </div>
          <div className="security-audit__ip-chips">
            {summary.topSuspiciousIps.map((item) => (
              <button
                key={item.ipAddress}
                type="button"
                className="security-audit__ip-chip"
                onClick={() => handleInvestigateIp(item.ipAddress)}
              >
                <code>{item.ipAddress}</code>
                <span>
                  {item.suspiciousEvents} flagged
                  {item.country ? ` · ${item.city ? `${item.city}, ` : ""}${item.country}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="security-audit__filters" role="search" aria-label="Filter login activity">
        <label className="security-audit__field">
          <span>Email / Username</span>
          <div className="security-audit__input-icon">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={email}
              onChange={(event) => {
                setPage(1);
                setEmail(event.target.value);
              }}
              placeholder="e.g. user@example.com"
              aria-label="Filter by email or username"
            />
          </div>
        </label>

        <label className="security-audit__field">
          <span>IP Address</span>
          <input
            type="text"
            value={ipAddress}
            onChange={(event) => {
              setPage(1);
              setIpAddress(event.target.value);
            }}
            placeholder="IPv4 or IPv6"
            aria-label="Filter by IP address"
          />
        </label>

        <label className="security-audit__field">
          <span>Login Status</span>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            aria-label="Filter by login status"
          >
            <option value="">All statuses</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
          </select>
        </label>

        <label className="security-audit__field">
          <span>From Date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => {
              setPage(1);
              setStartDate(event.target.value);
            }}
            aria-label="Filter from date"
          />
        </label>

        <label className="security-audit__field">
          <span>To Date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => {
              setPage(1);
              setEndDate(event.target.value);
            }}
            aria-label="Filter to date"
          />
        </label>

        <div className="security-audit__filter-actions">
          <label className="security-audit__checkbox">
            <input
              type="checkbox"
              checked={suspiciousOnly}
              onChange={(event) => {
                setPage(1);
                setSuspiciousOnly(event.target.checked);
              }}
            />
            <span>Suspicious only</span>
          </label>
          {hasActiveFilters && (
            <button type="button" className="security-audit__clear" onClick={handleResetFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="security-audit__geo-note">
        <Globe size={14} aria-hidden="true" />
        <span>{geoDisclaimer}</span>
      </p>

      {error && (
        <div className="security-audit__error" role="alert">
          {error}
        </div>
      )}

      {/* IP Investigation Drawer/Panel */}
      {selectedIp && (
        <section className="security-audit__ip-panel" aria-label={`IP investigation for ${selectedIp}`}>
          <div className="security-audit__ip-panel-header">
            <div>
              <span className="security-audit__eyebrow">IP Investigation</span>
              <h3>
                <code>{selectedIp}</code>
                {ipReport?.stats?.currentlyRateLimited && (
                  <span className="security-audit__badge security-audit__badge--failed">Temporarily Rate-Limited</span>
                )}
              </h3>
            </div>
            <button
              type="button"
              className="security-audit__close-panel"
              aria-label="Close IP investigation"
              onClick={() => {
                setSelectedIp("");
                setIpReport(null);
                setIpError("");
              }}
            >
              <X size={18} />
            </button>
          </div>

          {ipLoading ? (
            <p className="security-audit__status-text" role="status">Loading IP investigation details…</p>
          ) : ipError ? (
            <p className="security-audit__error" role="alert">{ipError}</p>
          ) : ipReport ? (
            <div className="security-audit__ip-panel-body">
              <div className="security-audit__ip-grid">
                <div className="security-audit__ip-card">
                  <strong>Approximate Network Location</strong>
                  <p>{formatLocation(ipReport.approximateLocation)}</p>
                  <small>ISP / Network: {ipReport.approximateLocation?.isp || "Unavailable"}</small>
                  <small className="security-audit__disclaimer-small">
                    {ipReport.approximateLocation?.disclaimer}
                  </small>
                </div>
                <div className="security-audit__ip-card">
                  <strong>Activity Overview</strong>
                  <p>
                    {ipReport.stats.totalAttempts} total ({ipReport.stats.failedAttempts} failed, {ipReport.stats.successfulAttempts} succeeded)
                  </p>
                  <small>
                    {ipReport.stats.suspiciousAttempts} flagged · {ipReport.stats.distinctAccountsTargeted} distinct account(s)
                  </small>
                  <small>
                    Last seen: {formatLocalDateTime(ipReport.stats.lastSeen)}
                  </small>
                </div>
                <div className="security-audit__ip-card">
                  <strong>Targeted Accounts</strong>
                  {ipReport.targetedAccounts.length === 0 ? (
                    <p>No targeted accounts recorded.</p>
                  ) : (
                    <ul className="security-audit__account-list">
                      {ipReport.targetedAccounts.slice(0, 8).map((acc) => (
                        <li key={acc.attemptedEmail}>
                          <span>{acc.attemptedEmail}</span>
                          <small>{acc.attempts} ({acc.failed} failed)</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="security-audit__ip-history">
                <h4>All Recorded Login Attempts from {ipReport.ipAddress}</h4>
                <div className="security-audit__table-wrap">
                  <table className="security-audit__table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Email / Username</th>
                        <th>Status</th>
                        <th>Device &amp; Browser</th>
                        <th>Indicators</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ipReport.attempts?.data || []).map((attempt) => (
                        <tr key={attempt.id}>
                          <td title={attempt.createdAt}>{formatLocalDateTime(attempt.createdAt)}</td>
                          <td><strong>{attempt.attemptedEmail}</strong></td>
                          <td>
                            <span className={`security-audit__badge security-audit__badge--${attempt.status.toLowerCase()}`}>
                              {attempt.status}
                            </span>
                            {attempt.failureReason && (
                              <span className="security-audit__subtext">
                                {FAILURE_REASON_LABELS[attempt.failureReason] || attempt.failureReason}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="security-audit__device">
                              <DeviceIcon deviceType={attempt.deviceType} />
                              {attempt.browser} · {attempt.operatingSystem} ({attempt.deviceType})
                            </span>
                          </td>
                          <td>
                            {attempt.suspiciousFlagLabels?.length > 0 ? (
                              <div className="security-audit__flags">
                                {attempt.suspiciousFlagLabels.map((label) => (
                                  <span key={label} className="security-audit__flag">{label}</span>
                                ))}
                              </div>
                            ) : (
                              <span className="security-audit__muted">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* Main Login Activity Table */}
      {loading ? (
        <div className="security-audit__empty" role="status">
          Loading authentication audit logs…
        </div>
      ) : records.length === 0 ? (
        <div className="security-audit__empty">
          <ShieldAlert size={36} aria-hidden="true" />
          <strong>{hasActiveFilters ? "No matching login activity" : "No authentication attempts recorded yet"}</strong>
          <span>
            {hasActiveFilters
              ? "Try broadening your date range, IP, email, or status filter."
              : "Successful and failed login attempts will appear here automatically."}
          </span>
        </div>
      ) : (
        <div className="security-audit__table-card">
          <div className="security-audit__table-wrap">
            <table className="security-audit__table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Status</th>
                  <th>Email / Username</th>
                  <th>IP Address</th>
                  <th>Approx. Location</th>
                  <th>Device &amp; Browser</th>
                  <th>Suspicious Indicators</th>
                </tr>
              </thead>
              <tbody>
                {records.map((entry) => (
                  <tr key={entry.id} className={entry.suspicious ? "is-suspicious" : ""}>
                    <td title={`UTC: ${entry.createdAt}`}>
                      {formatLocalDateTime(entry.createdAt)}
                    </td>
                    <td>
                      <span className={`security-audit__badge security-audit__badge--${entry.status.toLowerCase()}`}>
                        {entry.status}
                      </span>
                      {entry.failureReason && (
                        <span className="security-audit__subtext">
                          {FAILURE_REASON_LABELS[entry.failureReason] || entry.failureReason}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{entry.attemptedEmail}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="security-audit__ip-btn"
                        onClick={() => handleInvestigateIp(entry.ipAddress)}
                        title={`Investigate all attempts from ${entry.ipAddress}`}
                      >
                        <code>{entry.ipAddress}</code>
                      </button>
                    </td>
                    <td>
                      <div>{formatLocation(entry.location)}</div>
                      {entry.location?.isp && (
                        <span className="security-audit__subtext">{entry.location.isp}</span>
                      )}
                    </td>
                    <td>
                      <span className="security-audit__device">
                        <DeviceIcon deviceType={entry.deviceType} />
                        {entry.browser} · {entry.operatingSystem}
                      </span>
                      <span className="security-audit__subtext">{entry.deviceType}</span>
                    </td>
                    <td>
                      {entry.suspiciousFlagLabels?.length > 0 ? (
                        <div className="security-audit__flags">
                          {entry.suspiciousFlagLabels.map((label) => (
                            <span key={label} className="security-audit__flag">{label}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="security-audit__muted">Normal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="security-audit__pagination">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
