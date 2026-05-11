'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Service {
  id: number;
  name: string;
  status: 'HEALTHY' | 'CRITICAL' | 'INVESTIGATING' | 'WARNING';
  port: number;
  last_checked: string;
  error_count: number;
  last_error: string | null;
}

interface Incident {
  id: number;
  service_name: string;
  error_type: string;
  error_message: string;
  status: 'OPEN' | 'RESOLVED';
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  agent: string;
}

interface AgentLog {
  id: number;
  agent_name: string;
  action: string;
  details: string;
  timestamp: string;
}

interface Stats {
  totalServices: number;
  healthyServices: number;
  criticalServices: number;
  openIncidents: number;
  resolvedToday: number;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#080810',
    color: '#e2e8f0',
    fontFamily: "'Space Mono', monospace",
    overflow: 'hidden',
  },
  scanline: {
    position: 'fixed' as const,
    inset: 0,
    background:
      'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,136,0.015) 2px, rgba(0,255,136,0.015) 4px)',
    pointerEvents: 'none' as const,
    zIndex: 1,
  },
  grid: {
    position: 'fixed' as const,
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)',
    backgroundSize: '60px 60px',
    pointerEvents: 'none' as const,
    zIndex: 0,
  },
  content: {
    position: 'relative' as const,
    zIndex: 2,
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '0 24px 40px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '28px 0 20px',
    borderBottom: '1px solid rgba(0,255,136,0.15)',
    marginBottom: '32px',
  },
  logo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  logoTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: '28px',
    fontWeight: 800,
    color: '#00ff88',
    letterSpacing: '-1px',
    margin: 0,
    textShadow: '0 0 30px rgba(0,255,136,0.5)',
  },
  logoSub: {
    fontSize: '10px',
    color: 'rgba(0,255,136,0.5)',
    letterSpacing: '4px',
    textTransform: 'uppercase' as const,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  clock: {
    fontSize: '12px',
    color: 'rgba(226,232,240,0.4)',
    fontFamily: "'Space Mono', monospace",
  },
  ollamaStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    border: '1px solid rgba(0,255,136,0.2)',
    borderRadius: '4px',
    fontSize: '11px',
    background: 'rgba(0,255,136,0.05)',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
    marginBottom: '32px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '20px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  statLabel: {
    fontSize: '9px',
    letterSpacing: '3px',
    color: 'rgba(226,232,240,0.35)',
    textTransform: 'uppercase' as const,
    marginBottom: '10px',
  },
  statValue: {
    fontFamily: "'Syne', sans-serif",
    fontSize: '42px',
    fontWeight: 800,
    lineHeight: 1,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    marginBottom: '24px',
  },
  panel: {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  panelTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '3px',
    textTransform: 'uppercase' as const,
    color: 'rgba(226,232,240,0.6)',
  },
  panelBody: {
    padding: '4px',
    maxHeight: '360px',
    overflowY: 'auto' as const,
  },
  serviceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '2px',
    transition: 'background 0.2s',
    cursor: 'default',
  },
  serviceLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  serviceName: {
    fontSize: '13px',
    fontFamily: "'Space Mono', monospace",
  },
  servicePort: {
    fontSize: '10px',
    color: 'rgba(226,232,240,0.3)',
    marginTop: '2px',
  },
  badge: {
    padding: '3px 10px',
    borderRadius: '3px',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
  },
  incidentRow: {
    padding: '14px 16px',
    borderRadius: '6px',
    marginBottom: '4px',
    borderLeft: '3px solid',
  },
  incidentTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  incidentService: {
    fontSize: '13px',
    fontWeight: 700,
  },
  incidentType: {
    fontSize: '9px',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    color: 'rgba(226,232,240,0.45)',
  },
  incidentMessage: {
    fontSize: '11px',
    color: 'rgba(226,232,240,0.5)',
    fontFamily: "'Space Mono', monospace",
    marginTop: '4px',
    wordBreak: 'break-word' as const,
  },
  resolveBtn: {
    padding: '5px 14px',
    background: 'rgba(0,255,136,0.1)',
    border: '1px solid rgba(0,255,136,0.3)',
    borderRadius: '4px',
    color: '#00ff88',
    fontSize: '10px',
    fontFamily: "'Space Mono', monospace",
    cursor: 'pointer',
    letterSpacing: '1px',
    transition: 'all 0.2s',
  },
  resolveAllBtn: {
    padding: '8px 20px',
    background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,200,255,0.1))',
    border: '1px solid rgba(0,255,136,0.4)',
    borderRadius: '6px',
    color: '#00ff88',
    fontSize: '11px',
    fontFamily: "'Space Mono', monospace",
    cursor: 'pointer',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logRow: {
    padding: '8px 12px',
    borderRadius: '4px',
    marginBottom: '2px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    fontSize: '11px',
  },
  logAgent: {
    fontSize: '9px',
    letterSpacing: '1px',
    whiteSpace: 'nowrap' as const,
    minWidth: '110px',
    paddingTop: '1px',
  },
  logAction: {
    color: 'rgba(226,232,240,0.5)',
    fontSize: '10px',
    minWidth: '140px',
    whiteSpace: 'nowrap' as const,
  },
  logDetails: {
    color: 'rgba(226,232,240,0.35)',
    fontSize: '10px',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  toast: {
    position: 'fixed' as const,
    bottom: '32px',
    right: '32px',
    padding: '16px 24px',
    background: 'rgba(8,8,16,0.95)',
    border: '1px solid rgba(0,255,136,0.4)',
    borderRadius: '8px',
    fontSize: '12px',
    fontFamily: "'Space Mono', monospace",
    color: '#00ff88',
    zIndex: 100,
    backdropFilter: 'blur(10px)',
    maxWidth: '400px',
    boxShadow: '0 0 40px rgba(0,255,136,0.15)',
  },
};

// ─── Utils ────────────────────────────────────────────────────────────────────
function statusColor(status: string): string {
  if (status === 'HEALTHY') return '#00ff88';
  if (status === 'CRITICAL') return '#ff3366';
  if (status === 'INVESTIGATING') return '#ffaa00';
  if (status === 'WARNING') return '#ffaa00';
  return '#4a5568';
}

function statusBg(status: string): string {
  if (status === 'HEALTHY') return 'rgba(0,255,136,0.08)';
  if (status === 'CRITICAL') return 'rgba(255,51,102,0.08)';
  if (status === 'INVESTIGATING') return 'rgba(255,170,0,0.08)';
  return 'rgba(255,255,255,0.04)';
}

function agentColor(agent: string): string {
  if (agent.includes('Prime')) return '#00c8ff';
  if (agent.includes('Alpha')) return '#ff9900';
  if (agent.includes('Beta')) return '#aa66ff';
  return '#4a9eff';
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return ts;
  }
}

function formatRelative(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  } catch {
    return ts;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SentinelDashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [openIncidents, setOpenIncidents] = useState<Incident[]>([]);
  const [resolvedIncidents, setResolvedIncidents] = useState<Incident[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [clock, setClock] = useState('');
  const [resolving, setResolving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open');
  const [pulse, setPulse] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, incRes, logRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/incidents?filter=all'),
        fetch('/api/logs'),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        setServices(data.services || []);
        setStats(data.stats || null);
      }
      if (incRes.ok) {
        const data = await incRes.json();
        const all: Incident[] = data.incidents || [];
        setOpenIncidents(all.filter(i => i.status === 'OPEN'));
        setResolvedIncidents(all.filter(i => i.status === 'RESOLVED'));
      }
      if (logRes.ok) {
        const data = await logRes.json();
        setAgentLogs(data.logs || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (incidentId?: number) => {
    setResolving(true);
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentId ? { incidentId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✓ Incident #${data.incidentId} resolved by Sentinel AI\n${data.resolution}`);
        await fetchData();
      } else {
        showToast(`✗ Resolution failed: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      showToast('✗ Agent unreachable');
    } finally {
      setResolving(false);
    }
  };

  const criticalCount = services.filter(s => s.status === 'CRITICAL').length;
  const healthPercent = stats ? Math.round((stats.healthyServices / Math.max(stats.totalServices, 1)) * 100) : 100;

  return (
    <div style={styles.root}>
      <div style={styles.grid} />
      <div style={styles.scanline} />

      <div style={styles.content}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logo}>
            <h1 style={styles.logoTitle}>
              ⬡ SENTINEL
            </h1>
            <span style={styles.logoSub}>Autonomous Incident Resolution Engine</span>
          </div>
          <div style={styles.headerRight}>
            <span style={styles.clock}>{clock} IST</span>
            <div style={{
              ...styles.ollamaStatus,
              borderColor: 'rgba(0,255,136,0.3)',
              color: '#00ff88',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#00ff88',
                display: 'inline-block',
                boxShadow: pulse ? '0 0 8px #00ff88' : 'none',
                transition: 'box-shadow 0.5s',
              }} />
              OLLAMA ACTIVE
            </div>
            {openIncidents.length > 0 && (
              <button
                style={{
                  ...styles.resolveAllBtn,
                  opacity: resolving ? 0.6 : 1,
                }}
                onClick={() => handleResolve()}
                disabled={resolving}
              >
                {resolving ? '⟳ RESOLVING...' : '⚡ AUTO-RESOLVE ALL'}
              </button>
            )}
          </div>
        </header>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          {[
            { label: 'System Health', value: `${healthPercent}%`, color: healthPercent === 100 ? '#00ff88' : '#ffaa00' },
            { label: 'Services Online', value: stats?.healthyServices ?? '—', color: '#00ff88' },
            { label: 'Critical', value: stats?.criticalServices ?? '—', color: criticalCount > 0 ? '#ff3366' : '#00ff88' },
            { label: 'Open Incidents', value: stats?.openIncidents ?? '—', color: (stats?.openIncidents ?? 0) > 0 ? '#ffaa00' : '#00ff88' },
            { label: 'Resolved Today', value: stats?.resolvedToday ?? '—', color: '#00c8ff' },
          ].map(({ label, value, color }) => (
            <div key={label} style={styles.statCard}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '2px',
                background: `linear-gradient(90deg, ${color}, transparent)`,
              }} />
              <div style={styles.statLabel}>{label}</div>
              <div style={{ ...styles.statValue, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div style={styles.mainGrid}>
          {/* Services Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Service Registry</span>
              <span style={{ fontSize: '10px', color: 'rgba(226,232,240,0.3)' }}>
                Polled every 5s
              </span>
            </div>
            <div style={styles.panelBody}>
              {services.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(226,232,240,0.3)', fontSize: '12px' }}>
                  No services found — run npm run db:init
                </div>
              ) : (
                services.map(svc => (
                  <div
                    key={svc.id}
                    style={{
                      ...styles.serviceRow,
                      background: statusBg(svc.status),
                    }}
                  >
                    <div style={styles.serviceLeft}>
                      <div style={{
                        ...styles.dot,
                        background: statusColor(svc.status),
                        boxShadow: svc.status === 'CRITICAL' ? `0 0 10px ${statusColor(svc.status)}` : 'none',
                      }} />
                      <div>
                        <div style={styles.serviceName}>{svc.name}</div>
                        <div style={styles.servicePort}>:{svc.port} · {svc.error_count} errors · {formatRelative(svc.last_checked)}</div>
                      </div>
                    </div>
                    <div style={{
                      ...styles.badge,
                      color: statusColor(svc.status),
                      background: `${statusColor(svc.status)}18`,
                      border: `1px solid ${statusColor(svc.status)}33`,
                    }}>
                      {svc.status}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Incidents Panel */}
          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <span style={styles.panelTitle}>Incident Board</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['open', 'resolved'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '4px',
                      border: activeTab === tab ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      background: activeTab === tab ? 'rgba(0,255,136,0.1)' : 'transparent',
                      color: activeTab === tab ? '#00ff88' : 'rgba(226,232,240,0.4)',
                      fontSize: '10px',
                      cursor: 'pointer',
                      fontFamily: "'Space Mono', monospace",
                      letterSpacing: '1px',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    {tab} {tab === 'open' ? `(${openIncidents.length})` : `(${resolvedIncidents.length})`}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.panelBody}>
              {(activeTab === 'open' ? openIncidents : resolvedIncidents).length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(226,232,240,0.25)', fontSize: '12px' }}>
                  {activeTab === 'open' ? '✓ No open incidents' : 'No resolved incidents yet'}
                </div>
              ) : (
                (activeTab === 'open' ? openIncidents : resolvedIncidents).map(inc => (
                  <div key={inc.id} style={{
                    ...styles.incidentRow,
                    background: inc.status === 'OPEN' ? 'rgba(255,51,102,0.05)' : 'rgba(0,255,136,0.04)',
                    borderLeftColor: inc.status === 'OPEN' ? '#ff3366' : '#00ff88',
                  }}>
                    <div style={styles.incidentTop}>
                      <div>
                        <span style={{ ...styles.incidentService, color: inc.status === 'OPEN' ? '#ff3366' : '#00ff88' }}>
                          #{inc.id} {inc.service_name}
                        </span>
                        <span style={{ ...styles.incidentType, marginLeft: '12px' }}>{inc.error_type}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(226,232,240,0.3)' }}>
                          {formatRelative(inc.created_at)}
                        </span>
                        {inc.status === 'OPEN' && (
                          <button
                            style={styles.resolveBtn}
                            onClick={() => handleResolve(inc.id)}
                            disabled={resolving}
                          >
                            FIX
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={styles.incidentMessage}>
                      {inc.status === 'RESOLVED' && inc.resolution
                        ? `✓ ${inc.resolution.slice(0, 100)}`
                        : inc.error_message?.slice(0, 120)}
                    </div>
                    {inc.status === 'RESOLVED' && inc.agent && (
                      <div style={{ fontSize: '9px', color: 'rgba(0,255,136,0.4)', marginTop: '4px', letterSpacing: '1px' }}>
                        RESOLVED BY {inc.agent.toUpperCase()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Agent Logs Panel */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>Agent Activity Log</span>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {['SentinelPrime', 'SubagentAlpha', 'SubagentBeta'].map(agent => (
                <span key={agent} style={{ fontSize: '10px', color: agentColor(agent), letterSpacing: '1px' }}>
                  ● {agent}
                </span>
              ))}
            </div>
          </div>
          <div style={{ ...styles.panelBody, maxHeight: '260px', padding: '8px 4px' }}>
            {agentLogs.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(226,232,240,0.25)', fontSize: '12px' }}>
                No agent activity yet — run chaos and resolve
              </div>
            ) : (
              agentLogs.map(log => (
                <div key={log.id} style={{
                  ...styles.logRow,
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <span style={{ ...styles.logAgent, color: agentColor(log.agent_name) }}>
                    {log.agent_name}
                  </span>
                  <span style={styles.logAction}>{log.action}</span>
                  <span style={styles.logDetails}>{log.details}</span>
                  <span style={{ fontSize: '9px', color: 'rgba(226,232,240,0.2)', whiteSpace: 'nowrap' as const }}>
                    {formatTime(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: 'rgba(226,232,240,0.2)',
          letterSpacing: '2px',
        }}>
          <span>PROJECT SENTINEL v1.0 — POWERED BY OLLAMA + NEXT.JS</span>
          <span>3-AGENT SYSTEM: PRIME · ALPHA · BETA</span>
          <span>REFRESH INTERVAL: 5s</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={styles.toast}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px' }}>{toast}</pre>
        </div>
      )}
    </div>
  );
}
