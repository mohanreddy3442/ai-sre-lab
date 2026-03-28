"""
Backend API - FastAPI application
This API provides an /analyze endpoint that accepts logs and returns AI-generated root cause analysis.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.responses import Response, JSONResponse
from typing import List
import os
import time
import requests
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# AI Analyzer service URL - use deployed service
AI_ANALYZER_URL = os.getenv("AI_ANALYZER_URL", "https://ai-analyzer-kxo9.onrender.com/analyze")


def call_ai_analyzer(logs: List[str]) -> dict:
    """
    Call the AI analyzer service via HTTP.
    Returns analysis result or raises exception if service is unavailable.
    """
    try:
        response = requests.post(
            AI_ANALYZER_URL,
            json={"logs": logs},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI analyzer service unavailable: {str(e)}"
        )


# ================================================
# FASTAPI APP INITIALIZATION (must be before any @app)
# ================================================
app = FastAPI(title="AI SRE Lab Backend", version="1.0.0")

# CORS middleware - immediately after app init
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TEMP - fixes everything instantly
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Prometheus metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total number of HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_latency_seconds = Histogram(
    'http_request_latency_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint']
)

service_errors_total = Counter(
    'service_errors_total',
    'Total number of service errors',
    ['service', 'error_type']
)


class AnalyzeRequest(BaseModel):
    """Request model for log analysis"""
    logs: List[str]


class AnalyzeResponse(BaseModel):
    """Response model for log analysis"""
    analysis: str
    root_cause: str
    recommendation: str


@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    """Middleware to track request metrics"""
    start_time = time.time()
    method = request.method
    path = request.url.path
    
    response = await call_next(request)
    
    # Calculate latency
    latency = time.time() - start_time
    
    # Update metrics
    http_requests_total.labels(
        method=method,
        endpoint=path,
        status=str(response.status_code)
    ).inc()
    
    http_request_latency_seconds.labels(
        method=method,
        endpoint=path
    ).observe(latency)
    
    return response


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "AI SRE Lab Backend",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "/analyze (POST) - Analyze logs for root cause",
            "health": "/health (GET) - Health check",
            "metrics": "/metrics (GET) - Prometheus metrics"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    response = {"status": "healthy", "service": "backend"}
    return JSONResponse(
        content=response,
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/debug")
async def debug():
    """Debug endpoint to verify latest code deployment"""
    return JSONResponse(
        content={"message": "NEW CODE DEPLOYED"},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")


@app.get("/metrics/status")
async def metrics_status():
    """
    Fetch service health status from Prometheus.
    Queries the 'up' metric to get service availability.
    """
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": "up"},
            timeout=5
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to connect to Prometheus: {str(e)}"}


@app.get("/metrics/alerts")
async def metrics_alerts():
    """
    Fetch active alerts count from Prometheus.
    Queries for firing alerts.
    """
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": "count(ALERTS{alertstate=\"firing\"})"},
            timeout=5
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to connect to Prometheus: {str(e)}"}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Analyze endpoint - receives logs and returns AI-generated root cause analysis.
    
    This endpoint:
    1. Accepts a list of log messages
    2. Passes them to the AI analyzer service via HTTP
    3. Returns structured analysis results
    """
    try:
        # Call the AI analyzer service via HTTP with the logs list
        result = call_ai_analyzer(request.logs)
        
        return AnalyzeResponse(
            analysis=result.get("analysis", "No analysis available"),
            root_cause=result.get("root_cause", "No root cause identified"),
            recommendation=result.get("recommendation", "No recommendations available")
        )
    
    except HTTPException:
        # Re-raise HTTP exceptions (like 502 from call_ai_analyzer)
        raise
    except Exception as e:
        service_errors_total.labels(
            service="backend",
            error_type=type(e).__name__
        ).inc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
