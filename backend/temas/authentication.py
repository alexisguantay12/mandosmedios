from rest_framework.authentication import SessionAuthentication


class InstitutionalSessionAuthentication(SessionAuthentication):
    # Diferencia sesión vencida (401) de CSRF/permisos insuficientes (403).
    def authenticate_header(self, request):
        return "Session"
