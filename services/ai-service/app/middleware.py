import json

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

PASSTHROUGH_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class EnvelopeMiddleware(BaseHTTPMiddleware):
    """Tum servislerde ortak standart response zarfi: {success, data, error}
    (bkz. ARCHITECTURE.md Bolum 6)."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)

        if request.url.path in PASSTHROUGH_PATHS:
            return response

        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("application/json"):
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = None

        if isinstance(payload, dict) and "success" in payload:
            wrapped = payload
        elif response.status_code >= 400:
            message = payload.get("detail") if isinstance(payload, dict) else str(payload)
            wrapped = {"success": False, "data": None, "error": {"code": "ERROR", "message": message}}
        else:
            wrapped = {"success": True, "data": payload, "error": None}

        return JSONResponse(content=wrapped, status_code=response.status_code)
