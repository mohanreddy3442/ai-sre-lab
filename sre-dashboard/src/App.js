import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API_BASE = "http://localhost:8000";

function App() {
  const [incidents, setIncidents] = useState([]);
  const [serviceHealth, setServiceHealth] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metricsError, setMetricsError] = useState(null);

  useEffect(() => {
    fetchIncidents();
    fetchMetrics();
    const interval = setInterval(() => {
      fetchIncidents();
      fetchMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await fetch("http://localhost:8004/incidents");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setIncidents(data);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching incidents:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      // Fetch service health status
      const statusResponse = await fetch(`${API_BASE}/metrics/status`);
      const statusData = await statusResponse.json();
      
      if (statusData.error) {
        setMetricsError(statusData.error);
      } else if (statusData.data && statusData.data.result) {
        const services = statusData.data.result.map((item) => ({
          job: item.metric.job || "unknown",
          status: item.value[1] === "1" ? "UP" : "DOWN"
        }));
        setServiceHealth(services);
        setMetricsError(null);
      }

      // Fetch active alerts
      const alertsResponse = await fetch(`${API_BASE}/metrics/alerts`);
      const alertsData = await alertsResponse.json();
      
      if (!alertsData.error && alertsData.data && alertsData.data.result.length > 0) {
        setAlertCount(parseInt(alertsData.data.result[0].value[1], 10));
      } else {
        setAlertCount(0);
      }
    } catch (err) {
      console.error("Error fetching metrics:", err);
      setMetricsError(err.message);
    }
  };

  // AI Insight based on alerts and health
  const getAIInsight = () => {
    if (alertCount > 0) {
      return `⚠️ ${alertCount} active alert${alertCount > 1 ? 's' : ''} detected. Immediate attention required.`;
    }
    const downServices = serviceHealth.filter(s => s.status === "DOWN");
    if (downServices.length > 0) {
      return `🟡 ${downServices.length} service${downServices.length > 1 ? 's are' : ' is'} experiencing issues.`;
    }
    return `✅ All systems operational. AI monitoring active.`;
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "error":
        return "#ef4444";
      default:
        return "#22c55e";
    }
  };

  const getSeverityBgColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "rgba(239, 68, 68, 0.15)";
      case "warning":
        return "rgba(245, 158, 11, 0.15)";
      case "error":
        return "rgba(239, 68, 68, 0.15)";
      default:
        return "rgba(34, 197, 94, 0.15)";
    }
  };

  // Calculate incidents per service for bar chart
  const getServiceData = () => {
    const serviceCounts = {};
    incidents.forEach((incident) => {
      const service = incident.service || "Unknown";
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });
    return Object.entries(serviceCounts).map(([name, count]) => ({
      name,
      count,
    }));
  };

  const chartData = getServiceData();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🚀 AI SRE Dashboard</h1>
        <div style={styles.headerRight}>
          <div style={styles.countBadge}>
            <span style={styles.countNumber}>{incidents.length}</span>
            <span style={styles.countLabel}>Total Incidents</span>
          </div>
          <div style={styles.statusBadge}>
            <span style={styles.statusDot}></span>
            Live
          </div>
        </div>
      </header>

      <div style={styles.metaBar}>
        <span>Auto-refreshing every 5 seconds</span>
        {lastUpdated && <span>Last updated: {lastUpdated}</span>}
      </div>

      {/* Top Section: AI Insight, Active Alerts, Service Health */}
      <div style={styles.topSection}>
        {/* AI Insight */}
        <div style={{...styles.card, ...styles.aiInsightCard}}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>🤖</span>
            <span style={styles.cardTitle}>AI Insight</span>
          </div>
          <p style={styles.aiInsightText}>{getAIInsight()}</p>
        </div>

        {/* Active Alerts */}
        <div style={{...styles.card, ...styles.alertsCard}}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>🔔</span>
            <span style={styles.cardTitle}>Active Alerts</span>
          </div>
          <div style={styles.alertCount}>
            <span style={alertCount > 0 ? styles.alertNumberRed : styles.alertNumber}>
              {alertCount}
            </span>
            {alertCount > 0 && <span style={styles.alertBadge}>FIRING</span>}
          </div>
        </div>

        {/* Service Health */}
        <div style={{...styles.card, ...styles.healthCard}}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>💚</span>
            <span style={styles.cardTitle}>Service Health</span>
          </div>
          {metricsError ? (
            <p style={styles.metricsError}>Metrics unavailable</p>
          ) : (
            <div style={styles.serviceList}>
              {serviceHealth.length === 0 ? (
                <span style={styles.noServices}>No services monitored</span>
              ) : (
                serviceHealth.map((service, index) => (
                  <div key={index} style={styles.serviceItem}>
                    <span style={styles.serviceName}>{service.job}</span>
                    <span style={service.status === "UP" ? styles.statusUp : styles.statusDown}>
                      {service.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <main style={styles.main}>
        {loading ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⏳</div>
            <h2 style={styles.emptyTitle}>Loading incidents...</h2>
          </div>
        ) : error ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⚠️</div>
            <h2 style={styles.emptyTitle}>Error loading incidents</h2>
            <p style={styles.emptySubtitle}>{error}</p>
          </div>
        ) : incidents.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>✅</div>
            <h2 style={styles.emptyTitle}>No incidents</h2>
            <p style={styles.emptySubtitle}>
              All systems are operating normally.
            </p>
          </div>
        ) : (
          <>
            {/* Bar Chart */}
            <div style={styles.chartContainer}>
              <h3 style={styles.chartTitle}>Incidents per Service</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#e2e8f0",
                    }}
                  />
                  <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead style={styles.thead}>
                  <tr>
                    <th style={{...styles.th, ...styles.thService}}>Service</th>
                    <th style={{...styles.th, ...styles.thSeverity}}>Severity</th>
                    <th style={{...styles.th, ...styles.thRootCause}}>Root Cause</th>
                    <th style={{...styles.th, ...styles.thAction}}>Action</th>
                    <th style={{...styles.th, ...styles.thTime}}>Time</th>
                  </tr>
                </thead>
                <tbody style={styles.tbody}>
                  {incidents.map((incident, index) => (
                    <tr key={index} style={styles.tr}>
                      <td style={{...styles.td, ...styles.tdService}}>
                        <span style={styles.serviceIcon}>🏢</span>
                        {incident.service || "Unknown Service"}
                      </td>
                      <td style={{...styles.td, ...styles.tdSeverity}}>
                        <span
                          style={{
                            ...styles.severityBadge,
                            backgroundColor: getSeverityBgColor(incident.severity),
                            color: getSeverityColor(incident.severity),
                            border: `1px solid ${getSeverityColor(incident.severity)}`,
                          }}
                        >
                          {incident.severity?.toUpperCase() || "NORMAL"}
                        </span>
                      </td>
                      <td style={{...styles.td, ...styles.tdRootCause}}>
                        {incident.root_cause || "Unknown"}
                      </td>
                      <td style={{...styles.td, ...styles.tdAction}}>
                        {incident.action || "None"}
                      </td>
                      <td style={{...styles.td, ...styles.tdTime}}>
                        <span style={styles.timestamp}>
                          Occurred at: {incident.timestamp || "N/A"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <footer style={styles.footer}>
        <span>AI SRE Dashboard v1.0.0</span>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 32px",
    backgroundColor: "#1e293b",
    borderBottom: "1px solid #334155",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    margin: 0,
    background: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  countBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 20px",
    backgroundColor: "#334155",
    borderRadius: "12px",
  },
  countNumber: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#f1f5f9",
  },
  countLabel: {
    fontSize: "11px",
    fontWeight: "500",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    border: "1px solid #22c55e",
    borderRadius: "20px",
    color: "#22c55e",
    fontSize: "14px",
    fontWeight: "600",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#22c55e",
    animation: "pulse 2s infinite",
  },
  metaBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 32px",
    backgroundColor: "#1e293b",
    borderBottom: "1px solid #334155",
    fontSize: "13px",
    color: "#64748b",
  },
  main: {
    padding: "32px",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    textAlign: "center",
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    border: "1px solid #334155",
  },
  emptyIcon: {
    fontSize: "64px",
    marginBottom: "24px",
  },
  emptyTitle: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#e2e8f0",
    margin: "0 0 12px 0",
  },
  emptySubtitle: {
    fontSize: "16px",
    color: "#94a3b8",
    margin: "8px 0 0 0",
  },
  chartContainer: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    border: "1px solid #334155",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
  },
  chartTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#e2e8f0",
    margin: "0 0 16px 0",
  },
  tableContainer: {
    backgroundColor: "#1e293b",
    borderRadius: "16px",
    border: "1px solid #334155",
    overflow: "hidden",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  thead: {
    backgroundColor: "#0f172a",
    borderBottom: "2px solid #334155",
  },
  th: {
    padding: "16px 20px",
    textAlign: "left",
    fontSize: "12px",
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  thService: { width: "18%" },
  thSeverity: { width: "12%" },
  thRootCause: { width: "35%" },
  thAction: { width: "20%" },
  thTime: { width: "15%" },
  tbody: {
    backgroundColor: "#1e293b",
  },
  tr: {
    borderBottom: "1px solid #334155",
  },
  td: {
    padding: "16px 20px",
    fontSize: "14px",
    color: "#e2e8f0",
  },
  tdService: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontWeight: "500",
  },
  serviceIcon: {
    fontSize: "20px",
  },
  tdRootCause: {
    color: "#cbd5e1",
  },
  tdAction: {
    color: "#60a5fa",
    fontWeight: "500",
  },
  tdTime: {
    color: "#94a3b8",
  },
  severityBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },
  timestamp: {
    fontSize: "12px",
    color: "#64748b",
  },
  footer: {
    display: "flex",
    justifyContent: "center",
    padding: "20px",
    color: "#64748b",
    fontSize: "14px",
    borderTop: "1px solid #1e293b",
  },
  topSection: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: "20px",
    padding: "20px 32px",
    backgroundColor: "#0f172a",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #334155",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  cardIcon: {
    fontSize: "20px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  aiInsightCard: {
    borderLeft: "4px solid #a78bfa",
  },
  aiInsightText: {
    fontSize: "15px",
    color: "#e2e8f0",
    margin: 0,
    fontWeight: "500",
  },
  alertsCard: {
    borderLeft: "4px solid #ef4444",
  },
  alertCount: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  alertNumber: {
    fontSize: "36px",
    fontWeight: "700",
    color: "#22c55e",
  },
  alertNumberRed: {
    fontSize: "36px",
    fontWeight: "700",
    color: "#ef4444",
  },
  alertBadge: {
    backgroundColor: "#ef4444",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "10px",
    fontWeight: "700",
  },
  healthCard: {
    borderLeft: "4px solid #22c55e",
  },
  serviceList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  serviceItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    backgroundColor: "#0f172a",
    borderRadius: "6px",
  },
  serviceName: {
    fontSize: "13px",
    color: "#e2e8f0",
    fontWeight: "500",
  },
  statusUp: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#22c55e",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    padding: "3px 8px",
    borderRadius: "4px",
  },
  statusDown: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    padding: "3px 8px",
    borderRadius: "4px",
  },
  noServices: {
    fontSize: "13px",
    color: "#64748b",
    fontStyle: "italic",
  },
  metricsError: {
    fontSize: "13px",
    color: "#f59e0b",
    margin: 0,
  },
};

export default App;
