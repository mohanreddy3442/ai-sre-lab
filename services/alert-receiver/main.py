"""
Alert Receiver Service - FastAPI application
This service receives Prometheus alert webhooks and logs them.
"""

from fastapi import FastAPI, Request
import logging
import sys
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Alert Receiver", version="1.0.0")


@app.post("/alert")
async def receive_alert(request: Request):
    """Endpoint to receive Prometheus alert webhooks"""
    payload = await request.json()

    logger.info("ALERT RECEIVED FROM ALERTMANAGER")
    logger.info(payload)

    # Forward alert to AI analyzer for root cause analysis
    try:
        response = requests.post(
            "http://ai-analyzer:8004/analyze",
            json=payload
        )
        logger.info("AI ANALYSIS RESULT")
        logger.info(response.json())
    except Exception as e:
        logger.error(f"Failed to send alert to AI analyzer: {e}")

    return {"status": "received"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "alert-receiver"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Alert Receiver",
        "version": "1.0.0",
        "endpoints": {
            "alert": "/alert (POST) - Receive Prometheus webhooks",
            "health": "/health (GET) - Health check"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
