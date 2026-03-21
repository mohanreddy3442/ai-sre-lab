# Alert Receiver Service Dockerfile
# This Dockerfile builds the alert-receiver container

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Expose port
EXPOSE 8003

# Run the application
CMD ["python", "main.py"]
