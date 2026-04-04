from django.conf import settings


class SimpleCORSMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin", "")
        origin_allowed = origin and origin in getattr(settings, "CORS_ALLOWED_ORIGINS", [])

        if request.method == "OPTIONS":
            response = self._build_preflight_response(origin_allowed)
        else:
            response = self.get_response(request)

        if origin_allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
            response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return response

    def _build_preflight_response(self, origin_allowed):
        from django.http import HttpResponse

        return HttpResponse(status=204 if origin_allowed else 403)
