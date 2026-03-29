"""
Backend API - FastAPI application
This API provides an /analyze endpoint that accepts logs and returns AI-generated root cause analysis.
Includes JWT authentication and SQLite database for history storage.
"""

from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from starlette.responses import Response, JSONResponse
from typing import List, Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import time
import requests
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# ========================
# CONFIGURATION
# ========================

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

AI_ANALYZER_URL = os.getenv("AI_ANALYZER_URL", "https://ai-analyzer-kxo9.onrender.com/analyze")

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./analysis_history.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ========================
# DATABASE MODELS
# ========================

class Analysis(Base):
    __tablename__ = "analyses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    logs = Column(Text)
    analysis = Column(Text)
    root_cause = Column(Text)
    recommendation = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# ========================
# HELPER FUNCTIONS
# ========================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = users_db.get(email)
    if user is None:
        raise credentials_exception
    return user

# In-memory user store
users_db = {}

def call_ai_analyzer(logs: List[str]) -> dict:
    """
    Call the AI analyzer service with retry logic.
    Retries 4 times with 3 second delay between attempts.
    """
    import time
    
    retries = 4
    delay = 3

    for attempt in range(retries):
        try:
            response = requests.post(
                AI_ANALYZER_URL,
                json={"logs": logs},
                timeout=30
            )
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise HTTPException(
                    status_code=502,
                    detail="AI analyzer is waking up. Please retry in a few seconds."
                )


# ================================================
# FASTAPI APP
# ================================================

app = FastAPI(title="AI SRE Lab Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# ================================================
# PYDANTIC MODELS
# ================================================

class AnalyzeRequest(BaseModel):
    logs: List[str]

class AnalyzeResponse(BaseModel):
    analysis: str
    root_cause: str
    recommendation: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    email: str
    created_at: str

class HistoryResponse(BaseModel):
    id: int
    logs: str
    analysis: str
    root_cause: str
    recommendation: str
    created_at: datetime

    class Config:
        from_attributes = True


# ================================================
# MIDDLEWARE
# ================================================

@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    start_time = time.time()
    method = request.method
    path = request.url.path
    
    response = await call_next(request)
    
    latency = time.time() - start_time
    
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


# ================================================
# PUBLIC ENDPOINTS
# ================================================

@app.get("/")
async def root():
    return {
        "service": "AI SRE Lab Backend",
        "version": "1.0.0",
        "endpoints": {
            "signup": "/signup (POST)",
            "login": "/login (POST)",
            "analyze": "/analyze (POST) - requires auth",
            "history": "/history (GET) - requires auth",
            "history": "/history/{id} (DELETE) - requires auth",
            "health": "/health (GET)",
        }
    }


@app.get("/health")
async def health_check():
    return JSONResponse(
        content={"status": "healthy", "service": "backend"},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/debug")
async def debug():
    return JSONResponse(
        content={"message": "NEW CODE DEPLOYED"},
        headers={"Access-Control-Allow-Origin": "*"}
    )


@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ================================================
# AUTH ENDPOINTS
# ================================================

@app.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest):
    if request.email in users_db:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )
    
    hashed_password = get_password_hash(request.password)
    users_db[request.email] = {
        "email": request.email,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow().isoformat()
    }
    
    return UserResponse(
        email=request.email,
        created_at=users_db[request.email]["created_at"]
    )


@app.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = users_db.get(form_data.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"]},
        expires_delta=access_token_expires
    )
    
    return TokenResponse(access_token=access_token, token_type="bearer")


@app.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        email=current_user["email"],
        created_at=current_user["created_at"]
    )


# ================================================
# PROTECTED ENDPOINTS
# ================================================

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest, db = Depends(get_db)):
    """Analyze logs and save to history (no auth required)"""
    try:
        result = call_ai_analyzer(request.logs)
        
        # Save to database
        db_analysis = Analysis(
            user_id="anonymous",
            logs="\n".join(request.logs),
            analysis=result.get("analysis", "No analysis available"),
            root_cause=result.get("root_cause", "No root cause identified"),
            recommendation=result.get("recommendation", "No recommendations available"),
            created_at=datetime.utcnow()
        )
        db.add(db_analysis)
        db.commit()
        db.refresh(db_analysis)
        
        return AnalyzeResponse(
            analysis=result.get("analysis", "No analysis available"),
            root_cause=result.get("root_cause", "No root cause identified"),
            recommendation=result.get("recommendation", "No recommendations available")
        )
    
    except HTTPException:
        raise
    except Exception as e:
        service_errors_total.labels(
            service="backend",
            error_type=type(e).__name__
        ).inc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/history", response_model=List[HistoryResponse])
async def get_history(db = Depends(get_db)):
    """Get all analysis history (no auth required)"""
    analyses = db.query(Analysis).order_by(Analysis.created_at.desc()).all()
    
    return analyses


@app.delete("/history/{analysis_id}")
async def delete_history(analysis_id: int, db = Depends(get_db)):
    """Delete a specific analysis (no auth required)"""
    analysis = db.query(Analysis).filter(
        Analysis.id == analysis_id
    ).first()
    
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )
    
    db.delete(analysis)
    db.commit()
    
    return {"message": "Analysis deleted successfully"}


# ================================================
# PROMETHEUS METRICS
# ================================================

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")


@app.get("/metrics/status")
async def metrics_status():
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
