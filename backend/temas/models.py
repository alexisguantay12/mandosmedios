from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models
from django.db.models.functions import Lower


class Area(models.Model):
    nombre = models.CharField(max_length=120, unique=True)
    color = models.CharField(
        max_length=7,
        default="#2563EB",
        validators=[RegexValidator(r"^#[0-9a-fA-F]{6}$", "Utilice un color hexadecimal #RRGGBB.")],
    )
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "área"
        constraints = [models.UniqueConstraint(Lower("nombre"), name="area_nombre_ci")]

    def __str__(self):
        return self.nombre


class Responsable(models.Model):
    nombre = models.CharField(max_length=160, unique=True)
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="responsable_institucional",
    )
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        constraints = [models.UniqueConstraint(Lower("nombre"), name="responsable_nombre_ci")]

    def __str__(self):
        return self.nombre


class TipoTema(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "tipo de tema"
        verbose_name_plural = "tipos de tema"
        constraints = [models.UniqueConstraint(Lower("nombre"), name="tipo_nombre_ci")]

    def __str__(self):
        return self.nombre


class Estado(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    codigo = models.SlugField(unique=True)
    orden = models.PositiveSmallIntegerField(default=0)
    es_inicial = models.BooleanField(default=False)
    es_resuelto = models.BooleanField(default=False)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["orden", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["es_inicial"], condition=models.Q(es_inicial=True), name="un_estado_inicial"
            ),
            models.CheckConstraint(
                condition=~models.Q(es_inicial=True, es_resuelto=True), name="inicial_no_resuelto"
            ),
        ]

    def __str__(self):
        return self.nombre



class Reunion(models.Model):
    class EstadoMinuta(models.TextChoices):
        BORRADOR = "borrador", "Borrador"
        CONFIRMADA = "confirmada", "Confirmada"

    titulo = models.CharField(
        max_length=200,
        default="Reunión Miércoles"
    )

    fecha = models.DateTimeField()

    moderador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reuniones_moderadas",
    )

    hora_inicio = models.TimeField(default="09:00")
    hora_fin = models.TimeField(default="12:00")

    estado_minuta = models.CharField(
        max_length=12,
        choices=EstadoMinuta.choices,
        default=EstadoMinuta.BORRADOR
    )

    observaciones = models.TextField(blank=True)

    minuta_contenido = models.JSONField(
        null=True,
        blank=True
    )

    fecha_confirmacion = models.DateTimeField(
        null=True,
        blank=True
    )

    class Meta:
        ordering = ["-fecha", "-id"]
        verbose_name = "reunión"
        verbose_name_plural = "reuniones"

    def __str__(self):
        return f"{self.titulo} - {self.fecha:%d/%m/%Y}"


class AsistenciaReunion(models.Model):
    class Condicion(models.TextChoices):
        SIN_REGISTRAR = "sin_registrar", "Sin registrar"
        PRESENTE = "presente", "Presente"
        AUSENTE = "ausente", "Ausente"

    reunion = models.ForeignKey(
        Reunion,
        on_delete=models.CASCADE,
        related_name="asistencias"
    )

    responsable = models.ForeignKey(
        Responsable,
        on_delete=models.PROTECT,
        related_name="asistencias_reuniones"
    )

    condicion = models.CharField(
        max_length=15,
        choices=Condicion.choices,
        default=Condicion.SIN_REGISTRAR,
    )

    motivo_ausencia = models.TextField(blank=True)

    class Meta:
        ordering = ["responsable__nombre"]
        verbose_name = "asistencia a reunión"
        verbose_name_plural = "asistencias a reuniones"
        constraints = [
            models.UniqueConstraint(
                fields=["reunion", "responsable"],
                name="asistencia_unica_por_reunion"
            )
        ]

    def __str__(self):
        return (
            f"{self.responsable.nombre} - "
            f"{self.get_condicion_display()}"
        )


class Tema(models.Model):
    class Prioridad(models.TextChoices):
        ALTA = "alta", "Alta"
        MEDIA = "media", "Media"
        BAJA = "baja", "Baja"

    titulo = models.CharField(max_length=200)
    tipo = models.ForeignKey(TipoTema, on_delete=models.PROTECT, related_name="temas")
    descripcion = models.TextField()
    impacto = models.TextField(blank=True)
    prioridad = models.CharField(max_length=5, choices=Prioridad.choices, default=Prioridad.MEDIA)
    area_origen = models.ForeignKey(Area, on_delete=models.PROTECT, related_name="temas_originados")
    areas_involucradas = models.ManyToManyField(Area, blank=True, related_name="temas_involucrados")
    responsable = models.ForeignKey(
        Responsable,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="temas",
    )
    estado = models.ForeignKey(Estado, on_delete=models.PROTECT, related_name="temas")
    creador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="temas_creados",
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    version = models.PositiveIntegerField(default=1)
    # Permite auditar la importación sin atribuir un remitente histórico a un login.
    datos_migracion = models.JSONField(default=dict, blank=True)
    clave_importacion = models.CharField(max_length=64, unique=True, null=True, blank=True)

    class Meta:
        ordering = ["-fecha_actualizacion", "-id"]
        indexes = [
            models.Index(fields=["estado", "-fecha_resolucion"]),
            models.Index(fields=["creador", "-fecha_creacion"]),
        ]

    def __str__(self):
        return f"#{self.pk} · {self.titulo}"


class Comentario(models.Model):

    class Tipo(models.TextChoices):
        COMENTARIO = "comentario", "Comentario"
        SOLUCION_PROPUESTA = "solucion", "Solución propuesta"
        ACUERDO = "acuerdo", "Acuerdo"
        SEGUIMIENTO = "seguimiento", "Seguimiento"

    tema = models.ForeignKey(
        Tema,
        on_delete=models.PROTECT,
        related_name="comentarios",
    )

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
    )

    texto = models.TextField(max_length=10000)

    tipo = models.CharField(
        max_length=20,
        choices=Tipo.choices,
        default=Tipo.COMENTARIO,
    )

    fecha = models.DateTimeField(auto_now_add=True)

    es_historico = models.BooleanField(default=False)

    reunion = models.ForeignKey(
        Reunion,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )

    class Meta:
        ordering = ["fecha", "id"]

        
class ActividadTema(models.Model):
    tema = models.ForeignKey(Tema, on_delete=models.PROTECT, related_name="actividades")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    tipo_evento = models.CharField(max_length=40)
    campo = models.CharField(max_length=60, blank=True)
    valor_anterior = models.JSONField(null=True, blank=True)
    valor_nuevo = models.JSONField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)
    reunion = models.ForeignKey(Reunion, null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        ordering = ["fecha", "id"]
        verbose_name = "actividad del tema"
        verbose_name_plural = "actividades de temas"
