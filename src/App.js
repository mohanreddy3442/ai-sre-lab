import { useState, useRef } from "react";
import "./App.css";

// API URL from environment variable, fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

function App() {
  const [logs, setLogs] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

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

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setLogs(e.target.result);
      setResult(null);
    };
    reader.onerror = () => {
      setResult({ error: "Failed to read file" });
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = "";
  };

  const analyzeLogs = async () => {
    if (!logs.trim()) {
      setResult({ error: "Please enter some logs to analyze" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          logs: logs.split("\n")
        })
      });

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status >= 500) {
          throw new Error("Server error. Please try again later.");
        }
        if (response.status >= 400) {
          throw new Error("Invalid request. Please check your logs.");
        }
        throw new Error(`Request failed with status ${response.status}`);
      }

      // Handle invalid JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response from server");
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      // Determine user-friendly error message
      let errorMessage = "Failed to analyze logs";
      
      if (error.name === "TypeError" && error.message.includes("fetch")) {
        errorMessage = "Unable to connect to server. Please check your network.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setResult({ error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Get log lines for preview
  const logLines = logs.split("\n").filter(line => line.trim());

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">🤖 AI SRE Log Analyzer</h1>
        <p className="app-subtitle">Intelligent log analysis for site reliability engineering</p>
      </header>

      <main className="dashboard">
        {/* Left Panel - Log Input */}
        <section className="panel left-panel">
          <div className="panel-header">
            <h2>📝 Log Input</h2>
            <span className="panel-hint">Paste your logs below</span>
          </div>
          
          <div className="log-input-container">
            {/* Upload Button */}
            <div className="upload-section">
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt,.log"
                onChange={handleFileUpload}
                className="file-input"
                id="file-upload"
              />
              <button 
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                📁 Upload Log File
              </button>
              <span className="upload-hint">(.txt, .log)</span>
            </div>

            <textarea
              className="log-textarea"
              placeholder={`Paste your application logs here...\n\nExample:\n2024-01-15 10:23:45 ERROR Database connection failed\n2024-01-15 10:23:46 WARN Retrying connection...`}
              value={logs}
              onChange={(e) => { setLogs(e.target.value); setResult(null); }}
            />

            {/* Log Preview Section */}
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
            <button 
              className="analyze-btn" 
              onClick={analyzeLogs}
              disabled={loading || !logs.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Analyzing...
                </>
              ) : (
                <>🔍 Analyze Logs</>
              )}
            </button>
            <button 
              className="clear-btn"
              onClick={() => { setLogs(""); setResult(null); }}
              disabled={loading}
            >
              Clear
            </button>
          </div>
        </section>

        {/* Right Panel - Results */}
        <section className="panel right-panel">
          <div className="panel-header">
            <h2>📊 Analysis Results</h2>
            <span className="panel-hint">AI-powered insights</span>
          </div>

          <div className="results-container">
            {loading && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Analyzing your logs...</p>
                <span className="loading-hint">This may take a few seconds</span>
              </div>
            )}

            {!loading && result && (
              <div className="results-grid">
                {result.error ? (
                  <div className="error-card">
                    <span className="error-icon">⚠️</span>
                    <h3>Error</h3>
                    <p>{result.error}</p>
                  </div>
                ) : (
                  <>
                    <div className="result-card analysis-card">
                      <div className="card-icon">🔎</div>
                      <h3>Analysis</h3>
                      <p>{result.analysis || "No analysis available"}</p>
                    </div>

                    <div className="result-card cause-card">
                      <div className="card-icon">🎯</div>
                      <h3>Root Cause</h3>
                      <p>{result.root_cause || "No root cause identified"}</p>
                    </div>

                    <div className="result-card recommendation-card">
                      <div className="card-icon">💡</div>
                      <h3>Recommendation</h3>
                      <p>{result.recommendation || "No recommendations available"}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {!loading && !result && (
              <div className="empty-state">
                <span className="empty-icon">📋</span>
                <h3>Ready to Analyze</h3>
                <p>Enter logs in the left panel and click "Analyze Logs" to get AI-powered insights</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
