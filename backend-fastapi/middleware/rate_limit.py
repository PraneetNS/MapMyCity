import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

# Memory store for IP sliding window rate limiting
IP_REQUEST_LOGS = {}
MAX_REQUESTS_PER_MINUTE = 60

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()

        # Clean old timestamps
        if client_ip in IP_REQUEST_LOGS:
            IP_REQUEST_LOGS[client_ip] = [ts for ts in IP_REQUEST_LOGS[client_ip] if ts > now - 60]
        else:
            IP_REQUEST_LOGS[client_ip] = []

        if len(IP_REQUEST_LOGS[client_ip]) >= MAX_REQUESTS_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Too many requests. API rate limit exceeded.")

        IP_REQUEST_LOGS[client_ip].append(now)
        response = await call_next(request)
        return response
