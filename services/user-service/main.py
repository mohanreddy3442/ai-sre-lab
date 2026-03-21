"""
User Service - A simple FastAPI microservice
This service logs a message when the /user endpoint is called.
"""

from fastapi import FastAPI, Request
import logging
import sys
import time
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="User Service", version="1.0.0")

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
        "service": "user-service",
        "version": "1.0.0",
        "endpoints": {
            "user": "/user (GET) - Get user data",
            "health": "/health (GET) - Health check",
            "metrics": "/metrics (GET) - Prometheus metrics"
        }
    }


@app.get("/user")
async def get_user():
    """
    User endpoint - returns a user object and logs the request.
    This simulates a normal operation with successful log output.
    """
    logger.info("User service: Successfully retrieved user data")
    
    return {
        "service": "user-service",
        "status": "success",
        "user": {
            "id": 1,
            "name": "John Doe",
            "email": "john@example.com"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "user-service"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
