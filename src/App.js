import { useState } from "react";

function App() {
  const [logs, setLogs] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeLogs = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("https://ai-backend-1gq9.onrender.com/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          logs: [logs]
        })
      });

      // Check if response is OK
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('API Error:', error);
      setResult({ error: error.message || "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>AI SRE Log Analyzer</h1>

      <textarea
        rows="10"
        cols="80"
        placeholder="Paste your logs here..."
        value={logs}
        onChange={(e) => setLogs(e.target.value)}
      />

      <br /><br />

      <button onClick={analyzeLogs}>
        Analyze Logs
      </button>

      <br /><br />

      {loading && <p>Analyzing...</p>}

      {result && (
        <div>
          {result.error ? (
            <p style={{ color: "red" }}>{result.error}</p>
          ) : (
            <>
              <h3>Analysis:</h3>
              <p>{result.analysis}</p>
              
              <h3>Root Cause:</h3>
              <p>{result.root_cause}</p>
              
              <h3>Recommendation:</h3>
              <p>{result.recommendation}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
