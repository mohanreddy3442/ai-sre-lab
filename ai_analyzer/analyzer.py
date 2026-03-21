"""
AI Analyzer - Log analysis using OpenAI API
This module analyzes log text and provides root cause explanations.
It supports both real OpenAI API and a mock implementation for testing.
"""

import os
import json
from typing import Dict

# Try to import OpenAI, fall back to mock if not available
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


def get_openai_client() -> 'OpenAI':
    """
    Get an OpenAI client instance using the API key from environment.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    return OpenAI(api_key=api_key)


def analyze_with_openai(log_text: str) -> Dict[str, str]:
    """
    Analyze logs using the real OpenAI API.
    
    Args:
        log_text: The log text to analyze
        
    Returns:
        Dictionary containing analysis, root_cause, and recommendation
    """
    if not OPENAI_AVAILABLE:
        raise RuntimeError("OpenAI package is not installed")
    
    client = get_openai_client()
    
    # Create a prompt for the AI
    prompt = f"""You are an SRE (Site Reliability Engineer) assistant. 
Analyze the following logs and provide:
1. A brief analysis of what's happening
2. The root cause of any errors
3. A recommendation to fix the issue

Logs to analyze:
{log_text}

Provide your response in JSON format with keys: analysis, root_cause, recommendation"""

    # Call OpenAI API
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an SRE assistant that helps analyze system logs and find root causes of errors."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7
    )
    
    # Parse the response
    result_text = response.choices[0].message.content
    
    # Try to parse as JSON
    try:
        result = json.loads(result_text)
    except json.JSONDecodeError:
        # If not valid JSON, create a structured response
        result = {
            "analysis": result_text,
            "root_cause": "See analysis",
            "recommendation": "Review the analysis"
        }
    
    return result


def analyze_with_mock(log_text: str) -> Dict[str, str]:
    """
    Mock analyzer for testing without OpenAI API key.
    
    This provides reasonable mock responses based on common error patterns
    in the log text. It detects the following error categories:
    1. Database connection errors
    2. Timeout errors
    3. Authentication or authorization failures
    4. Memory errors (out of memory)
    5. Disk space errors
    6. Service unavailable errors
    
    Args:
        log_text: The log text to analyze
        
    Returns:
        Dictionary containing analysis, root_cause, and recommendation
    """
    log_lower = log_text.lower()
    
    # Check for database connection errors
    if "database" in log_lower and "connection" in log_lower:
        return {
            "analysis": "database connection error detected",
            "root_cause": "service unable to connect to database - likely due to incorrect connection string, database server down, or network connectivity issues",
            "recommendation": "verify database server is running, check connection string configuration, verify network connectivity, and validate database credentials"
        }
    
    # Check for timeout errors
    elif "timeout" in log_lower:
        return {
            "analysis": "request timeout detected",
            "root_cause": "service dependency did not respond within time limit",
            "recommendation": "check network latency or increase timeout configuration"
        }
    
    # Check for authentication or authorization failures
    elif "authentication failed" in log_lower or "authentication failure" in log_lower or "unauthorized" in log_lower or "access denied" in log_lower or "invalid credentials" in log_lower or "authorization failed" in log_lower:
        return {
            "analysis": "authentication failure",
            "root_cause": "invalid credentials or expired token",
            "recommendation": "verify API keys or authentication configuration"
        }
    
    # Check for memory errors (out of memory)
    elif "out of memory" in log_lower or "memory exhausted" in log_lower or "oom" in log_lower or "memory limit" in log_lower:
        return {
            "analysis": "memory exhaustion detected",
            "root_cause": "container exceeded memory limit",
            "recommendation": "increase container memory or optimize service"
        }
    
    # Check for disk space errors
    elif "no space left" in log_lower or "disk full" in log_lower or "quota exceeded" in log_lower or "storage full" in log_lower or "disk space" in log_lower:
        return {
            "analysis": "disk space error detected",
            "root_cause": "server or container has run out of disk space",
            "recommendation": "clean up temporary files, delete old logs, or increase disk storage capacity"
        }
    
    # Check for service unavailable errors
    elif "service unavailable" in log_lower or "503" in log_lower or "temporarily unavailable" in log_lower:
        return {
            "analysis": "service unavailable error detected",
            "root_cause": "target service is currently unavailable or overloaded",
            "recommendation": "check service health status, verify service is running, and review service load metrics"
        }
    
    # Check for generic error
    elif "error" in log_lower:
        return {
            "analysis": "an error occurred in the service that requires investigation",
            "root_cause": "unknown error - more specific information needed in logs",
            "recommendation": "review full error stack trace, check service configuration, and verify all dependencies are available"
        }
    
    # No errors detected
    else:
        return {
            "analysis": "the logs show normal operation with no errors detected",
            "root_cause": "no root cause needed - operation was successful",
            "recommendation": "continue monitoring for any anomalies"
        }


def analyze_logs(log_text: str) -> Dict[str, str]:
    """
    Main function to analyze logs.
    
    This function checks if OPENAI_API_KEY is available:
    - If available: uses real OpenAI API
    - If not available: uses mock implementation for testing
    
    Args:
        log_text: The log text to analyze
        
    Returns:
        Dictionary containing analysis, root_cause, and recommendation
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    
    if api_key and OPENAI_AVAILABLE:
        try:
            return analyze_with_openai(log_text)
        except Exception as e:
            # If OpenAI fails, fall back to mock
            print(f"OpenAI analysis failed: {e}, using mock analyzer")
            return analyze_with_mock(log_text)
    else:
        # Use mock analyzer for testing
        return analyze_with_mock(log_text)


if __name__ == "__main__":
    # Test the analyzer with sample logs
    test_logs = """
    2024-01-15 10:30:45 - order-service - ERROR - Database connection failed - could not connect to postgres://orders-db:5432
    2024-01-15 10:30:45 - order-service - ERROR - Connection timeout after 30 seconds
    2024-01-15 10:30:45 - order-service - ERROR - Failed to retrieve order data - Service temporarily unavailable
    """
    
    print("Testing AI Analyzer...")
    print("=" * 50)
    result = analyze_logs(test_logs)
    print(json.dumps(result, indent=2))
