// src/components/SyncStatusIndicator.js
import React, { useContext, useState, useRef, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Clock,
  ChevronDown,
  X
} from 'lucide-react';
import { DataContext } from '../context/DataContext';

export default function SyncStatusIndicator() {
  const { syncState, triggerManualSync } = useContext(DataContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const popoverRef = useRef(null);

  const { isOnline, syncStatus, pendingCount, failedCount, conflictCount, lastSyncTime } = syncState || {
    isOnline: true,
    syncStatus: 'idle',
    pendingCount: 0,
    failedCount: 0,
    conflictCount: 0,
    lastSyncTime: null,
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSyncClick = async () => {
    setIsManualSyncing(true);
    try {
      await triggerManualSync();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const formatLastSync = (isoString) => {
    if (!isoString) return 'Not yet synced';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Recently';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Determine indicator appearance
  let badgeColor = '#10b981'; // Green
  let badgeBg = '#ecfdf5';
  let badgeBorder = '#a7f3d0';
  let badgeText = 'Online';
  let Icon = CheckCircle2;

  if (!isOnline) {
    badgeColor = '#d97706'; // Amber / Orange
    badgeBg = '#fffbeb';
    badgeBorder = '#fde68a';
    badgeText = pendingCount > 0 ? `Offline (${pendingCount} pending)` : 'Offline';
    Icon = WifiOff;
  } else if (syncStatus === 'syncing' || isManualSyncing) {
    badgeColor = '#2563eb'; // Blue
    badgeBg = '#eff6ff';
    badgeBorder = '#bfdbfe';
    badgeText = 'Syncing...';
    Icon = RefreshCw;
  } else if (conflictCount > 0) {
    badgeColor = '#dc2626'; // Red
    badgeBg = '#fef2f2';
    badgeBorder = '#fecaca';
    badgeText = `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`;
    Icon = AlertCircle;
  } else if (pendingCount > 0) {
    badgeColor = '#d97706';
    badgeBg = '#fffbeb';
    badgeBorder = '#fde68a';
    badgeText = `${pendingCount} pending`;
    Icon = AlertTriangle;
  }

  return (
    <div className="sync-indicator-wrapper" ref={popoverRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="sync-status-badge"
        onClick={() => setIsOpen(!isOpen)}
        title={isOnline ? 'Online - Click for sync details' : 'Offline - Changes will sync when internet returns'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '9999px',
          border: `1px solid ${badgeBorder}`,
          background: badgeBg,
          color: badgeColor,
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        <Icon size={14} className={syncStatus === 'syncing' || isManualSyncing ? 'spin-animation' : ''} />
        <span>{badgeText}</span>
        <ChevronDown size={12} opacity={0.6} />
      </button>

      {isOpen && (
        <div
          className="sync-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isOnline ? <Wifi size={16} color="#10b981" /> : <WifiOff size={16} color="#d97706" />}
              <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                {isOnline ? 'System Online' : 'Offline Mode Active'}
              </strong>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Popover Body */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>
              {isOnline
                ? 'All operations are connected to Render backend & PostgreSQL source of truth.'
                : 'OFFLINE — You can continue recording sales and managing inventory. All changes are saved safely to IndexedDB and will synchronize automatically when internet returns.'}
            </p>

            <div
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Pending Offline Sync:</span>
                <strong style={{ color: pendingCount > 0 ? '#d97706' : '#10b981' }}>
                  {pendingCount} operation{pendingCount !== 1 ? 's' : ''}
                </strong>
              </div>
              {conflictCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>Inventory Conflicts:</span>
                  <strong>{conflictCount} required review</strong>
                </div>
              )}
              {failedCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>Failed operations:</span>
                  <strong>{failedCount} awaiting retry</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Last Synced:
                </span>
                <span>{formatLastSync(lastSyncTime)}</span>
              </div>
            </div>

            {/* Sync Now button */}
            <button
              type="button"
              onClick={handleSyncClick}
              disabled={!isOnline || isManualSyncing || syncStatus === 'syncing'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: isOnline ? 'var(--primary, #039d83)' : '#cbd5e1',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: isOnline && !isManualSyncing ? 'pointer' : 'not-allowed',
                transition: 'background-color 0.2s',
              }}
            >
              <RefreshCw size={14} className={isManualSyncing || syncStatus === 'syncing' ? 'spin-animation' : ''} />
              {isManualSyncing || syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
