import { useState, useEffect, useCallback } from "react";
import "./App.css";

// API URL - hardcoded for production
const API_URL = "https://ai-backend-1gq9.onrender.com";
const ANALYZER_URL = "https://ai-analyzer-kxo9.onrender.com";

// Detect severity of log line
const getSeverity = (line) => {
  const lowerLine = line.toLowerCase();
  if (lowerLine.includes("error") || lowerLine.includes("failed") || lowerLine.includes("critical")) {
    return "high";
  }
  if (lowerLine.includes("warning") || lowerLine.includes("timeout") || lowerLine.includes("warn")) {
    return "medium";
  }
  return "normal";
};

// ========================
// DASHBOARD PAGE
// ========================
function Dashboard({ currentPage, setCurrentPage }) {
  const [logs, setLogs] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    backend: "checking",
    analyzer: "checking"
  });
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const checkStatus = async () => {
    try {
      const backendRes = await fetch(`${API_URL}/health`);
      const backendData = await backendRes.json();

      const analyzerRes = await fetch(`${ANALYZER_URL}/health`);
      const analyzerData = await analyzerRes.json();

      setStatus({
        backend: backendData.status,
        analyzer: analyzerData.status
      });
    } catch {
      setStatus({
        backend: "down",
        analyzer: "down"
      });
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { setLogs(e.target.result); setResult(null); };
    reader.onerror = () => { setResult({ error: "Failed to read file" }); };
    reader.readAsText(file);
    event.target.value = "";
  };

  const analyzeLogs = async () => {
    if (!logs.trim()) { setResult({ error: "Please enter some logs to analyze" }); return; }
    setLoading(true);
    setResult(null);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: logs.split("\n") }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error("Request failed");
      }
      const data = await response.json();
      setResult(data);
      
      // Check for critical issues and add alerts
      const newAlerts = [];
      if (data.root_cause?.toLowerCase().includes("failure") ||
          data.analysis?.toLowerCase().includes("critical")) {
        newAlerts.push({
          id: Date.now(),
          message: data.root_cause,
          severity: "critical"
        });
      }
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev]);
        
        // Create incident from alert
        const incident = {
          id: Date.now(),
          title: data.root_cause,
          status: "OPEN",
          time: new Date().toLocaleString()
        };
        setIncidents(prev => [incident, ...prev]);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setResult({ error: "Request timed out. Please try again." });
      } else {
        setResult({ error: error.message || "Failed to analyze logs" });
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  const logLines = logs.split("\n").filter(line => line.trim());

  const resolveIncident = (id) => {
    setIncidents(prev =>
      prev.map(i =>
        i.id === id ? { ...i, status: "RESOLVED" } : i
      )
    );
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1 className="app-title">🤖 AI SRE Log Analyzer</h1>
            <p className="app-subtitle">Intelligent log analysis for site reliability engineering</p>
            <div className="status-bar">
              <span>Backend: {status.backend}</span>
              <span>AI Analyzer: {status.analyzer}</span>
            </div>
          </div>
          <nav className="nav-tabs">
            <button className={`nav-tab ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
            <button className={`nav-tab ${currentPage === 'history' ? 'active' : ''}`} onClick={() => setCurrentPage('history')}>History</button>
          </nav>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel left-panel">
          <div className="panel-header">
            <h2>📝 Log Input</h2>
            <span className="panel-hint">Paste your logs below</span>
          </div>
          <div className="log-input-container">
            <div className="upload-section">
              <input type="file" accept=".txt,.log" onChange={handleFileUpload} className="file-input" id="file-upload" />
              <button className="upload-btn" onClick={() => document.getElementById("file-upload").click()} disabled={loading}>📁 Upload Log File</button>
              <span className="upload-hint">(.txt, .log)</span>
            </div>
            <textarea className="log-textarea" placeholder={`Paste your logs here...\n\nExample:\n2024-01-15 ERROR Database connection failed\n2024-01-15 WARN Retrying...`} value={logs} onChange={(e) => { setLogs(e.target.value); setResult(null); }} />
            {logLines.length > 0 && (
              <div className="log-preview">
                <h3 className="preview-title">🔍 Log Preview</h3>
                <div className="preview-lines">
                  {logLines.map((line, index) => {
                    const severity = getSeverity(line);
                    return (
                      <div key={index} className={`log-line severity-${severity}`}>
                        <span className="line-number">{index + 1}</span>
                        <span className="line-text">{line}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="action-bar">
            <button className="analyze-btn" onClick={analyzeLogs} disabled={loading || !logs.trim()}>
              {loading ? <><span className="spinner"></span> Analyzing...</> : "🔍 Analyze Logs"}
            </button>
            <button className="clear-btn" onClick={() => { setLogs(""); setResult(null); }} disabled={loading}>Clear</button>
          </div>
        </section>

        <section className="panel right-panel">
          <div className="panel-header">
            <h2>📊 Analysis Results</h2>
            <span className="panel-hint">AI-powered insights</span>
          </div>
          <div className="results-container">
            {alerts.length > 0 && (
              <div className="alerts-section">
                {alerts.map(alert => (
                  <div key={alert.id} className={`alert-card ${alert.severity}`}>
                    🚨 {alert.message}
                  </div>
                ))}
              </div>
            )}
            {loading && <div className="loading-state"><div className="loading-spinner"></div><p>Analyzing...</p></div>}
            {!loading && result && (
              <div className="results-grid">
                {result.error ? (
                  <div className="error-card"><span className="error-icon">⚠️</span><h3>Error</h3><p>{result.error}</p></div>
                ) : (
                  <>
                    <div className="result-card analysis-card"><div className="card-icon">🔎</div><h3>Analysis</h3><p>{result.analysis}</p></div>
                    <div className="result-card cause-card"><div className="card-icon">🎯</div><h3>Root Cause</h3><p>{result.root_cause}</p></div>
                    <div className="result-card recommendation-card"><div className="card-icon">💡</div><h3>Recommendation</h3><p>{result.recommendation}</p></div>
                  </>
                )}
              </div>
            )}
            {!loading && !result && <div className="empty-state"><span className="empty-icon">📋</span><h3>Ready to Analyze</h3><p>Enter logs and click "Analyze Logs"</p></div>}
            
            {/* Incidents Section */}
            {incidents.length > 0 && (
              <div className="incident-section">
                <h3>🚨 Incidents</h3>
                {incidents.map(inc => (
                  <div key={inc.id} className="incident-card">
                    <div className="incident-header">
                      <span>{inc.title}</span>
                      <span className={`status ${inc.status.toLowerCase()}`}>
                        {inc.status}
                      </span>
                    </div>
                    <div className="incident-footer">
                      <span>{inc.time}</span>
                      {inc.status === "OPEN" && (
                        <button onClick={() => resolveIncident(inc.id)}>Resolve</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// ========================
// HISTORY PAGE
// ========================
function HistoryPage({ setCurrentPage }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/history`);
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const deleteAnalysis = async (id) => {
    try {
      const response = await fetch(`${API_URL}/history/${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Failed to delete");
      setHistory(history.filter(h => h.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const truncateLogs = (logs, maxLength = 100) => {
    if (logs.length <= maxLength) return logs;
    return logs.substring(0, maxLength) + "...";
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1 className="app-title">📜 Analysis History</h1>
            <p className="app-subtitle">View your past log analyses</p>
          </div>
          <nav className="nav-tabs">
            <button className={`nav-tab ${false ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
            <button className={`nav-tab ${true ? 'active' : ''}`} onClick={() => setCurrentPage('history')}>History</button>
          </nav>
        </div>
      </header>

      <main className="history-page">
        {loading && <div className="loading-state"><div className="loading-spinner"></div><p>Loading history...</p></div>}
        
        {!loading && error && <div className="error-card"><h3>Error</h3><p>{error}</p></div>}
        
        {!loading && !error && history.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h3>No History Yet</h3>
            <p>Run your first analysis to see it here</p>
            <button className="analyze-btn" onClick={() => setCurrentPage('dashboard')}>Go to Dashboard</button>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <div className="history-list">
            {history.map((item) => (
              <div key={item.id} className="history-card">
                <div className="history-header">
                  <span className="history-date">📅 {formatDate(item.created_at)}</span>
                  <button className="delete-btn" onClick={() => deleteAnalysis(item.id)}>🗑️ Delete</button>
                </div>
                <div className="history-content">
                  <div className="history-section">
                    <h4>📝 Logs</h4>
                    <pre className="logs-preview">{truncateLogs(item.logs)}</pre>
                  </div>
                  <div className="history-section">
                    <h4>🔎 Analysis</h4>
                    <p>{item.analysis}</p>
                  </div>
                  <div className="history-section">
                    <h4>🎯 Root Cause</h4>
                    <p>{item.root_cause}</p>
                  </div>
                  <div className="history-section">
                    <h4>💡 Recommendation</h4>
                    <p>{item.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ========================
// MAIN APP
// ========================
function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");

  if (currentPage === "history") {
    return <HistoryPage setCurrentPage={setCurrentPage} />;
  }

  return <Dashboard currentPage={currentPage} setCurrentPage={setCurrentPage} />;
}

export default App;
