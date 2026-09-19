from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, F, Q
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Area, Estado, Responsable, Tema, TipoTema
from .serializers import (
    ActividadSerializer,
    AreaSerializer,
    CambioEstadoSerializer,
    ComentarioSerializer,
    EstadoSerializer,
    ResponsableSerializer,
    TemaEscrituraSerializer,
    TemaSerializer,
    TipoSerializer,
    UsuarioSerializer,
)
from .services import agregar_comentario, crear_tema, modificar_tema


@method_decorator(never_cache, name="dispatch")
class CsrfView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        username = request.data.get("username", "")
        password = request.data.get("password", "")
        if not isinstance(username, str) or not isinstance(password, str):
            raise serializers.ValidationError("Credenciales inválidas.")
        usuario = authenticate(request, username=username, password=password)
        if usuario is None:
            return Response({"detail": "Usuario o contraseña incorrectos."}, status=400)
        login(request, usuario)
        return Response(
            {"usuario": UsuarioSerializer(usuario).data, "csrfToken": get_token(request)}
        )


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(never_cache, name="dispatch")
class UsuarioActualView(APIView):
    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)


class PasswordView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password"

    def post(self, request):
        actual = request.data.get("actual", "")
        nueva = request.data.get("nueva", "")
        confirmar = request.data.get("confirmar", "")
        if not all(isinstance(v, str) for v in [actual, nueva, confirmar]):
            raise serializers.ValidationError("Los campos deben ser texto.")
        if not request.user.check_password(actual):
            raise serializers.ValidationError({"actual": "La contraseña actual es incorrecta."})
        if nueva != confirmar:
            raise serializers.ValidationError({"confirmar": "Las contraseñas no coinciden."})
        try:
            validate_password(nueva, request.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"nueva": exc.messages})
        request.user.set_password(nueva)
        request.user.save(update_fields=["password"])
        update_session_auth_hash(request, request.user)
        return Response({"detail": "Contraseña actualizada."})


@method_decorator(never_cache, name="dispatch")
class MaestrosViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    pagination_class = None


class AreaViewSet(MaestrosViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer


class TipoViewSet(MaestrosViewSet):
    queryset = TipoTema.objects.all()
    serializer_class = TipoSerializer


class EstadoViewSet(MaestrosViewSet):
    queryset = Estado.objects.all()
    serializer_class = EstadoSerializer


class ResponsableViewSet(MaestrosViewSet):
    queryset = Responsable.objects.all()
    serializer_class = ResponsableSerializer


@method_decorator(never_cache, name="dispatch")
class TemaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = TemaSerializer

    def get_queryset(self):
        return (
            Tema.objects.select_related(
                "tipo",
                "area_origen",
                "responsable",
                "estado",
                "creador",
            )
            .prefetch_related("areas_involucradas")
            .annotate(total_comentarios=Count("comentarios", distinct=True))
            .order_by("-fecha_actualizacion", "-id")
        )

    def filtrados(self):
        query = self.get_queryset()
        params = self.request.query_params
        texto = params.get("buscar", "").strip()[:200]
        if texto:
            filtro = Q(titulo__icontains=texto) | Q(descripcion__icontains=texto)
            if texto.lstrip("#").isdigit():
                filtro |= Q(pk=int(texto.lstrip("#")))
            query = query.filter(filtro)
        for parametro, campo in [
            ("origen", "area_origen_id"),
            ("area", "areas_involucradas__id"),
            ("responsable", "responsable_id"),
            ("estado", "estado_id"),
        ]:
            if params.get(parametro):
                if not params[parametro].isdigit():
                    raise serializers.ValidationError(
                        {parametro: "Se esperaba un identificador numérico."}
                    )
                query = query.filter(**{campo: params[parametro]})
        if params.get("prioridad"):
            if params["prioridad"] not in Tema.Prioridad.values:
                raise serializers.ValidationError({"prioridad": "Prioridad no válida."})
            query = query.filter(prioridad=params["prioridad"])
        if params.get("mios") == "1" or self.action == "mis_temas":
            query = query.filter(creador=self.request.user)
        if params.get("resueltos") == "1":
            query = query.filter(estado__es_resuelto=True).order_by(
                F("fecha_resolucion").desc(nulls_last=True), "-id"
            )
        return query.distinct()

    def list(self, request):
        page = self.paginate_queryset(self.filtrados())
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @action(detail=False, url_path="mis-temas")
    def mis_temas(self, request):
        return self.list(request)

    @action(detail=False)
    def tablero(self, request):
        query = self.filtrados()
        columnas = []
        # Los maestros pueden ampliarse sin modificar JavaScript ni Python.
        for estado in Estado.objects.all():
            temas = query.filter(estado=estado)
            cantidad = temas.count()
            if not estado.activo and not cantidad:
                continue
            limite = 5 if estado.es_resuelto else 30
            if estado.es_resuelto:
                temas = temas.order_by(F("fecha_resolucion").desc(nulls_last=True), "-id")
            columnas.append(
                {
                    "estado": EstadoSerializer(estado).data,
                    "cantidad": cantidad,
                    "temas": TemaSerializer(temas[:limite], many=True).data,
                }
            )
        return Response(columnas)

    def create(self, request):
        serializer = TemaEscrituraSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        datos.pop("version", None)
        tema = crear_tema(datos, request.user)
        return Response(self.get_serializer(self.get_queryset().get(pk=tema.pk)).data, status=201)

    def partial_update(self, request, pk=None):
        instancia = self.get_object()
        serializer = TemaEscrituraSerializer(instancia, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        version = datos.pop("version")
        modificar_tema(instancia.pk, datos, request.user, version)
        return Response(self.get_serializer(self.get_queryset().get(pk=instancia.pk)).data)

    @action(detail=True, methods=["post"], url_path="cambiar-estado")
    def cambiar_estado(self, request, pk=None):
        tema = self.get_object()
        serializer = CambioEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        modificar_tema(tema.pk, {"estado": datos["estado"]}, request.user, datos["version"])
        return Response(self.get_serializer(self.get_queryset().get(pk=tema.pk)).data)

    @action(detail=True, methods=["get", "post"])
    def comentarios(self, request, pk=None):
        tema = self.get_object()
        if request.method == "POST":
            serializer = ComentarioSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            comentario = agregar_comentario(
                tema.pk, request.user, serializer.validated_data["texto"]
            )
            return Response(ComentarioSerializer(comentario).data, status=201)
        page = self.paginate_queryset(tema.comentarios.select_related("usuario").all())
        return self.get_paginated_response(ComentarioSerializer(page, many=True).data)

    @action(detail=True)
    def actividad(self, request, pk=None):
        tema = self.get_object()
        page = self.paginate_queryset(tema.actividades.select_related("usuario").all())
        return self.get_paginated_response(ActividadSerializer(page, many=True).data)
