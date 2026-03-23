const express = require("express");
const cors = require("cors");

const app = express();

// ✅ CORS (VERY IMPORTANT)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.options("*", cors());

// ✅ Body parser
app.use(express.json());

// ✅ Health route
app.get("/health", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ status: "ok" });
});

// ✅ Analyze route
app.post("/analyze", (req, res) => {
  const { logs } = req.body;

  let logsArray = [];

  if (typeof logs === "string") {
    logsArray = logs.trim() ? [logs] : [];
  } else if (Array.isArray(logs)) {
    logsArray = logs.filter(l => typeof l === "string" && l.trim());
  }

  if (logsArray.length === 0) {
    return res.status(400).json({ error: "No valid logs provided" });
  }

  // Dummy response (you can replace with AI logic later)
  res.json({
    analysis: "Logs analyzed successfully",
    root_cause: "Possible issue detected in logs",
    recommendation: "Check service and retry"
  });
});

// ✅ Server start
const PORT = process.env.PORT || 8000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});