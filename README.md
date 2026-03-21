# AI-SRE-Lab

A learning project that simulates a microservice system with logs and an AI analyzer that explains the root cause of errors.

## Overview

This project demonstrates:
- Microservices architecture with FastAPI
- Log generation from multiple services
- AI-powered root cause analysis using OpenAI API
- Docker containerization with docker-compose

## Project Structure

```
ai-sre-lab/
├── services/
│   ├── user-service/         # Healthy service (port 8001)
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── order-service/        # Service with errors (port 8002)
│       ├── main.py
│       ├── requirements.txt
│       └── Dockerfile
├── backend/                  # Main API with /analyze endpoint (port 8000)
│   ├── app.py
│   └── requirements.txt
├── ai-analyzer/              # AI analysis module
│   ├── analyzer.py
│   └── requirements.txt
├── docker-compose.yml
└── README.md
```

## Prerequisites

- Python 3.11+
- Docker and Docker Compose
- OpenAI API key (optional for testing)

## Installation

### Option 1: Using Docker (Recommended)

1. Clone or navigate to the project directory:
   ```bash
   cd ai-sre-lab
   ```

2. (Optional) Set your OpenAI API key:
   ```bash
   # Windows
   set OPENAI_API_KEY=your_api_key_here
   
   # Linux/Mac
   export OPENAI_API_KEY=your_api_key_here
   ```

3. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```

### Option 2: Running Locally (Without Docker)

1. Install Python dependencies:

   ```bash
   # Install user-service dependencies
   cd services/user-service
   pip install -r requirements.txt
   
   # Install order-service dependencies
   cd ../order-service
   pip install -r requirements.txt
   
   # Install backend dependencies
   cd ../../backend
   pip install -r requirements.txt
   
   # Install ai-analyzer dependencies
   cd ../ai-analyzer
   pip install -r requirements.txt
   ```

2. (Optional) Set OpenAI API key:
   ```bash
   # Windows
   set OPENAI_API_KEY=your_api_key_here
   
   # Linux/Mac
   export OPENAI_API_KEY=your_api_key_here
   ```

3. Run the services:

   Terminal 1 - User Service:
   ```bash
   cd services/user-service
   python main.py
   ```

   Terminal 2 - Order Service:
   ```bash
   cd services/order-service
   python main.py
   ```

   Terminal 3 - Backend:
   ```bash
   cd backend
   python app.py
   ```

## Testing the Services

### 1. Test User Service (Healthy)

Visit: http://localhost:8001/user

Expected response:
```json
{
  "service": "user-service",
  "status": "success",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### 2. Test Order Service (With Errors)

Visit: http://localhost:8002/order

Expected response (check console for error logs):
```json
{
  "service": "order-service",
  "status": "error",
  "message": "Database connection failed"
}
```

Console logs will show:
```
ERROR - Order service: Database connection failed - could not connect to postgres://orders-db:5432
ERROR - Order service: Connection timeout after 30 seconds
ERROR - Order service: Failed to retrieve order data - Service temporarily unavailable
```

### 3. Test the AI Analyzer

Send a POST request to analyze logs:

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      "2024-01-15 10:30:45 - order-service - ERROR - Database connection failed - could not connect to postgres://orders-db:5432",
      "2024-01-15 10:30:45 - order-service - ERROR - Connection timeout after 30 seconds",
      "2024-01-15 10:30:45 - order-service - ERROR - Failed to retrieve order data - Service temporarily unavailable"
    ]
  }'
```

Or using Python:
```python
import requests

response = requests.post(
    "http://localhost:8000/analyze",
    json={
        "logs": [
            "ERROR - Database connection failed - could not connect to postgres://orders-db:5432",
            "ERROR - Connection timeout after 30 seconds"
        ]
    }
)
print(response.json())
```

Expected response (with mock analyzer):
```json
{
  "analysis": "The service is unable to connect to the database. Multiple connection attempts have failed.",
  "root_cause": "Database connection failure - likely due to incorrect connection string, database server being down, or network connectivity issues.",
  "recommendation": "1. Verify database server is running\n2. Check connection string configuration\n3. Verify network connectivity to database\n4. Check database credentials"
}
```

## How It Works

### Services

1. **User Service** (`services/user-service`): A simple FastAPI service that returns user data and logs successful operations.

2. **Order Service** (`services/order-service`): A FastAPI service that simulates a database connection failure by logging error messages.

3. **Backend** (`backend`): The main API that provides the `/analyze` endpoint. It accepts log text and forwards it to the AI analyzer.

### AI Analyzer

The AI analyzer (`ai-analyzer/analyzer.py`) works in two modes:

1. **With OpenAI API**: If `OPENAI_API_KEY` environment variable is set, it uses the real OpenAI API to analyze logs.

2. **Mock Mode (Testing)**: If no API key is provided, it uses a mock analyzer that provides reasonable responses based on common error patterns.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for AI analysis | No (uses mock if not set) |

## API Endpoints

### Backend (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint with API info |
| `/health` | GET | Health check |
| `/analyze` | POST | Analyze logs and return root cause |

### User Service (Port 8001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/user` | GET | Get user data |
| `/health` | GET | Health check |

### Order Service (Port 8002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/order` | GET | Get order (simulates error) |
| `/health` | GET | Health check |

## Learning Objectives

This project helps you understand:

1. **Microservices Architecture**: How multiple services work together
2. **Logging**: How to structure and interpret logs
3. **Error Analysis**: How to identify root causes from error messages
4. **AI in SRE**: How AI can assist in debugging and troubleshooting
5. **Docker**: Containerization of microservices

## Cleanup

To stop all services:

```bash
# If using Docker Compose
docker-compose down

# If running locally
# Stop the Python processes in each terminal
```

## Troubleshooting

### OpenAI API Error
If you see an error about the OpenAI API key, make sure to set it:
```bash
# Windows
set OPENAI_API_KEY=your_api_key

# Linux/Mac
export OPENAI_API_KEY=your_api_key
```

### Port Already in Use
If you get port conflicts, modify the port mappings in `docker-compose.yml` or the port numbers in the service files.

### Mock Analyzer Not Working
The mock analyzer should work automatically. Check the console output for any error messages.

## License

This is a learning project for educational purposes.
