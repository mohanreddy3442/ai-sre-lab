"""
AI Root Cause Analyzer Service
This service analyzes logs and provides root cause analysis.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import sys
import random

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Root Cause Analyzer", version="1.0.0")

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class AnalyzeRequest(BaseModel):
    logs: List[str]


class AnalyzeResponse(BaseModel):
    analysis: str
    root_cause: str
    recommendation: str


# Simple AI analysis function (no external dependencies)
def analyze_logs(logs: List[str]) -> dict:
    """Analyze log messages and determine root cause"""
    
    log_text = "\n".join(logs).lower()
    
    # Determine severity based on keywords
    severity = "normal"
    if any(word in log_text for word in ["error", "exception", "fail", "critical"]):
        severity = "critical"
    elif any(word in log_text for word in ["warning", "warn", "slow"]):
        severity = "warning"
    
    # Determine service from logs
    service = "unknown"
    if "user" in log_text:
        service = "user-service"
    elif "order" in log_text:
        service = "order-service"
    elif "backend" in log_text:
        service = "backend"
    elif "alert" in log_text:
        service = "monitoring"
    
    # Root cause analysis based on patterns
    root_cause = "Unknown issue detected in logs"
    recommendation = "Investigate logs further"
    
    if "connection" in log_text or "refused" in log_text:
        root_cause = "Service connection failure - service may be down or unreachable"
        recommendation = "Check if the target service is running and accessible"
    elif "timeout" in log_text:
        root_cause = "Request timeout - service taking too long to respond"
        recommendation = "Check service performance and network latency"
    elif "memory" in log_text or "oom" in log_text:
        root_cause = "Memory exhaustion - service running out of memory"
        recommendation = "Increase memory limits or optimize memory usage"
    elif "cpu" in log_text or "high" in log_text:
        root_cause = "High CPU usage detected"
        recommendation = "Scale service horizontally or optimize CPU-intensive operations"
    elif "database" in log_text or "sql" in log_text:
        root_cause = "Database query failure or connection pool exhausted"
        recommendation = "Check database connectivity and query performance"
    elif "unauthorized" in log_text or "auth" in log_text:
        root_cause = "Authentication or authorization failure"
        recommendation = "Verify credentials and permission settings"
    
    # Build analysis summary
    analysis = f"AI analysis of {len(logs)} log lines detected {severity} severity issue in {service}. "
    analysis += f"Primary issue: {root_cause}"
    
    return {
        "analysis": analysis,
        "root_cause": root_cause,
        "recommendation": recommendation,
        "service": service,
        "severity": severity
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Analyze logs and return root cause analysis.
    
    Accepts: {"logs": ["log line 1", "log line 2", ...]}
    Returns: {"analysis": "...", "root_cause": "...", "recommendation": "..."}
    """
    try:
        if not request.logs:
            raise HTTPException(status_code=400, detail="No logs provided")
        
        result = analyze_logs(request.logs)
        
        return AnalyzeResponse(
            analysis=result["analysis"],
            root_cause=result["root_cause"],
            recommendation=result["recommendation"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing logs: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-analyzer"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI Root Cause Analyzer",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "/analyze (POST) - Analyze logs and provide root cause",
            "health": "/health (GET) - Health check"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=10000)
