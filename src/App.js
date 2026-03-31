import { useState, useEffect, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
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
function Dashboard({ currentPage, setCurrentPage, onAnalysisComplete }) {
  const [logs, setLogs] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({
    backend: "checking",
    analyzer: "checking"
  });
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

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
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const response = await fetch(`${API_URL}/history`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      
      let totalErrors = 0;
      let totalWarnings = 0;
      const keywordCount = {};
      let latestTimestamp = null;

      // Chart data processing
      const errorsByDate = {};
      const analysesByDate = {};

      data.forEach(item => {
        // Get date key (YYYY-MM-DD)
        const dateKey = item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 'Unknown';
        
        // Initialize date entries
        if (!errorsByDate[dateKey]) errorsByDate[dateKey] = 0;
        if (!analysesByDate[dateKey]) analysesByDate[dateKey] = 0;
        
        // Count errors and warnings
        const lines = item.logs.split('\n');
        let itemErrors = 0;
        lines.forEach(line => {
          const upperLine = line.toUpperCase();
          if (upperLine.includes('ERROR')) {
            totalErrors++;
            itemErrors++;
          }
          if (upperLine.includes('WARN')) totalWarnings++;
          
          // Keyword frequency (simple word extraction)
          const words = line.split(/\s+/).filter(w => w.length > 3);
          words.forEach(word => {
            const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
            if (cleanWord) {
              keywordCount[cleanWord] = (keywordCount[cleanWord] || 0) + 1;
            }
          });
        });
        
        // Add to chart data
        errorsByDate[dateKey] += itemErrors;
        analysesByDate[dateKey] += 1;

        // Track latest timestamp
        if (item.created_at) {
          const itemDate = new Date(item.created_at);
          if (!latestTimestamp || itemDate > latestTimestamp) {
            latestTimestamp = itemDate;
          }
        }
      });

      // Find most common keyword
      let mostCommon = 'N/A';
      let maxCount = 0;
      Object.entries(keywordCount).forEach(([word, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommon = word;
        }
      });

      // Format chart data
      const errorsChartData = Object.entries(errorsByDate)
        .map(([date, errors]) => ({ date, errors }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const analysesChartData = Object.entries(analysesByDate)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Fallback dummy data if empty
      const finalErrorsData = errorsChartData.length > 0 ? errorsChartData : [
        { date: "2026-03-28", errors: 2 },
        { date: "2026-03-29", errors: 4 },
        { date: "2026-03-30", errors: 1 },
        { date: "2026-03-31", errors: 3 }
      ];

      const finalAnalysesData = analysesChartData.length > 0 ? analysesChartData : [
        { date: "2026-03-28", count: 3 },
        { date: "2026-03-29", count: 5 },
        { date: "2026-03-30", count: 2 },
        { date: "2026-03-31", count: 4 }
      ];

      setInsights({
        totalAnalyses: data.length,
        totalErrors,
        totalWarnings,
        mostCommonKeyword: mostCommon,
        lastAnalysisTime: latestTimestamp ? latestTimestamp.toLocaleString() : 'N/A',
        errorsChartData: finalErrorsData,
        analysesChartData: finalAnalysesData
      });
    } catch (err) {
      console.error('Insights error:', err);
    } finally {
      setInsightsLoading(false);
    }
  };

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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          logs: logs.split("\n")   // IMPORTANT
        })
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error("Request failed");
      }
      const data = await response.json();
      setResult(data);
      
      // Trigger history refresh
      if (onAnalysisComplete) {
        onAnalysisComplete();
      }
      
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

      {/* Insights Bar */}
      {!insightsLoading && insights && (
        <div className="insights-bar">
          <div className="insight-card">
            <span className="insight-icon">📊</span>
            <div className="insight-content">
              <span className="insight-value">{insights.totalAnalyses}</span>
              <span className="insight-label">Total Analyses</span>
            </div>
          </div>
          <div className="insight-card error-card">
            <span className="insight-icon">🔥</span>
            <div className="insight-content">
              <span className="insight-value">{insights.totalErrors}</span>
              <span className="insight-label">Errors Detected</span>
            </div>
          </div>
          <div className="insight-card warning-card">
            <span className="insight-icon">⚠️</span>
            <div className="insight-content">
              <span className="insight-value">{insights.totalWarnings}</span>
              <span className="insight-label">Warnings</span>
            </div>
          </div>
          <div className="insight-card">
            <span className="insight-icon">🕒</span>
            <div className="insight-content">
              <span className="insight-value small">{insights.lastAnalysisTime}</span>
              <span className="insight-label">Last Analysis</span>
            </div>
          </div>
          <button className="refresh-insights-btn" onClick={fetchInsights} disabled={insightsLoading}>
            🔄
          </button>
        </div>
      )}

      {/* Charts Section */}
      {!insightsLoading && insights && (
        <div className="charts-section">
          <div className="chart-card">
            <h3 className="chart-title">📈 Errors Over Time</h3>
            {insights.errorsChartData && insights.errorsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={insights.errorsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No data to display</div>
            )}
          </div>
          <div className="chart-card">
            <h3 className="chart-title">📊 Analyses Per Day</h3>
            {insights.analysesChartData && insights.analysesChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={insights.analysesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.slice(5)} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">No data to display</div>
            )}
          </div>
        </div>
      )}

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
function HistoryPage({ setCurrentPage, currentPage }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    console.log("Fetching history...");
    try {
      const response = await fetch(`${API_URL}/history`);
      console.log("History response:", response);
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      console.log("History data:", data);
      setHistory(data);
      setError("");
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("HistoryPage mounted, currentPage:", currentPage);
    fetchHistory();
  }, [currentPage]);

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
            <button className={`nav-tab ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
            <button className={`nav-tab ${currentPage === 'history' ? 'active' : ''}`} onClick={() => setCurrentPage('history')}>History</button>
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
          <>
            <div className="history-stats">
              <span className="total-count">📊 Total Analyses: {history.length}</span>
              <button className="refresh-btn" onClick={fetchHistory} disabled={loading}>
                🔄 Refresh
              </button>
            </div>
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
                    <div className="history-section root-cause">
                      <h4>🎯 Root Cause</h4>
                      <p>{item.root_cause}</p>
                    </div>
                    <div className="history-section recommendation">
                      <h4>💡 Recommendation</h4>
                      <p>{item.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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
  const [historyKey, setHistoryKey] = useState(0);

  const refreshHistory = useCallback(() => {
    setHistoryKey(prev => prev + 1);
  }, []);

  if (currentPage === "history") {
    return <HistoryPage setCurrentPage={setCurrentPage} currentPage={currentPage} key={historyKey} />;
  }

  return <Dashboard currentPage={currentPage} setCurrentPage={setCurrentPage} onAnalysisComplete={refreshHistory} />;
}

export default App;
