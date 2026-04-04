from django.conf import settings


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin", "")
        origin_allowed = origin and origin in getattr(settings, "CORS_ALLOWED_ORIGINS", [])
        requested_headers = request.headers.get("Access-Control-Request-Headers", "Content-Type, Authorization")

        if origin:
            print(
                f"[cors] {request.method} {request.path} origin={origin} allowed={bool(origin_allowed)}",
                flush=True,
            )

        if request.method == "OPTIONS":
            response = self._build_preflight_response(origin_allowed)
        else:
            response = self.get_response(request)

        if origin_allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = requested_headers
            response["Access-Control-Max-Age"] = "86400"
            self._append_vary(response, "Origin")

            if request.method == "OPTIONS":
                self._append_vary(response, "Access-Control-Request-Headers")
        return response

    def _build_preflight_response(self, origin_allowed):
        from django.http import HttpResponse

        return HttpResponse(status=204 if origin_allowed else 403)

    def _append_vary(self, response, value):
        existing = response.get("Vary")
        if not existing:
            response["Vary"] = value
            return

        vary_values = [item.strip() for item in existing.split(",") if item.strip()]
        if value not in vary_values:
            vary_values.append(value)
            response["Vary"] = ", ".join(vary_values)
