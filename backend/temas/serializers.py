from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ActividadTema, Area, Comentario, Estado, Responsable, Tema, TipoTema


class UsuarioSerializer(serializers.ModelSerializer):
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ["id", "username", "nombre", "is_staff"]

    def get_nombre(self, obj):
        return obj.get_full_name() or obj.username


class AreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Area
        fields = ["id", "nombre", "color", "activa"]


class TipoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoTema
        fields = ["id", "nombre", "activo"]


class EstadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Estado
        fields = ["id", "nombre", "codigo", "es_inicial", "es_resuelto", "activo", "orden"]


class ResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsable
        fields = ["id", "nombre", "activo"]


class TemaSerializer(serializers.ModelSerializer):
    tipo = TipoSerializer(read_only=True)
    area_origen = AreaSerializer(read_only=True)
    areas_involucradas = AreaSerializer(many=True, read_only=True)
    responsable = ResponsableSerializer(read_only=True)
    estado = EstadoSerializer(read_only=True)
    creador = UsuarioSerializer(read_only=True)
    total_comentarios = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tema
        fields = [
            "id",
            "titulo",
            "tipo",
            "descripcion",
            "impacto",
            "prioridad",
            "area_origen",
            "areas_involucradas",
            "responsable",
            "estado",
            "creador",
            "fecha_creacion",
            "fecha_actualizacion",
            "fecha_resolucion",
            "version",
            "total_comentarios",
        ]


class TemaEscrituraSerializer(serializers.ModelSerializer):
    version = serializers.IntegerField(min_value=1, required=False)

    class Meta:
        model = Tema
        fields = [
            "titulo",
            "tipo",
            "descripcion",
            "impacto",
            "prioridad",
            "area_origen",
            "areas_involucradas",
            "responsable",
            "version",
        ]
        extra_kwargs = {
            "descripcion": {"max_length": 30000},
            "impacto": {"max_length": 15000},
        }

    def validate(self, attrs):
        for campo, active in [
            ("tipo", "activo"),
            ("area_origen", "activa"),
            ("responsable", "activo"),
        ]:
            value = attrs.get(campo)
            if value and not getattr(value, active):
                if not self.instance or getattr(self.instance, campo) != value:
                    raise serializers.ValidationError(
                        {campo: "El registro seleccionado está inactivo."}
                    )
        for area in attrs.get("areas_involucradas", []):
            if not area.activa and (
                not self.instance
                or not self.instance.areas_involucradas.filter(pk=area.pk).exists()
            ):
                raise serializers.ValidationError(
                    {"areas_involucradas": "No se pueden asignar áreas inactivas."}
                )
        if self.instance and "version" not in attrs:
            raise serializers.ValidationError(
                {"version": "Se requiere la versión actual del tema."}
            )
        return attrs


class CambioEstadoSerializer(serializers.Serializer):
    estado = serializers.PrimaryKeyRelatedField(queryset=Estado.objects.filter(activo=True))
    version = serializers.IntegerField(min_value=1)


class ComentarioSerializer(serializers.ModelSerializer):
    usuario = UsuarioSerializer(read_only=True)
    tipo_display = serializers.CharField(
        source="get_tipo_display",
        read_only=True,
    )

    class Meta:
        model = Comentario
        fields = [
            "id",
            "usuario",
            "texto",
            "tipo",
            "tipo_display",
            "fecha",
            "es_historico",
        ]

        read_only_fields = [
            "id",
            "usuario",
            "fecha",
            "es_historico",
            "tipo_display",
        ]


    
class ActividadSerializer(serializers.ModelSerializer):
    usuario = UsuarioSerializer(read_only=True)

    class Meta:
        model = ActividadTema
        fields = ["id", "usuario", "tipo_evento", "campo", "valor_anterior", "valor_nuevo", "fecha"]



 

from .models import Reunion, AsistenciaReunion


class AsistenciaReunionSerializer(serializers.ModelSerializer):
    responsable_nombre = serializers.CharField(
        source="responsable.nombre",
        read_only=True
    )

    class Meta:
        model = AsistenciaReunion
        fields = [
            "id",
            "responsable",
            "responsable_nombre",
            "condicion",
            "motivo_ausencia",
        ]
        read_only_fields = [
            "id",
            "responsable_nombre",
        ]

    def validate(self, attrs):
        condicion = attrs.get("condicion")
        motivo = attrs.get("motivo_ausencia", "").strip()

        if condicion in ("presente", "sin_registrar"):
            attrs["motivo_ausencia"] = ""

        elif condicion == "ausente":
            attrs["motivo_ausencia"] = motivo

        return attrs



class ReunionSerializer(serializers.ModelSerializer):
    moderador_nombre = serializers.SerializerMethodField()
    asistencias = AsistenciaReunionSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Reunion
        fields = [
            "id",
            "titulo",
            "fecha",
            "moderador",
            "moderador_nombre",
            "hora_inicio",
            "hora_fin",
            "estado_minuta",
            "observaciones",
            "fecha_confirmacion",
            "asistencias",
        ]
        read_only_fields = [
            "id",
            "moderador",
            "moderador_nombre",
            "estado_minuta",
            "fecha_confirmacion",
            "asistencias",
        ]

    def get_moderador_nombre(self, obj):
        return (
            obj.moderador.get_full_name()
            or obj.moderador.username
        )

    def validate(self, attrs):
        inicio = attrs.get(
            "hora_inicio",
            getattr(self.instance, "hora_inicio", None)
        )
        fin = attrs.get(
            "hora_fin",
            getattr(self.instance, "hora_fin", None)
        )

        if inicio and fin and fin <= inicio:
            raise serializers.ValidationError({
                "hora_fin": (
                    "La hora de finalización debe ser "
                    "posterior al inicio."
                )
            })

        return attrs

    def create(self, validated_data):
        validated_data["moderador"] = (
            self.context["request"].user
        )
        return super().create(validated_data)
