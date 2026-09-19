from django.contrib import admin

from .models import ActividadTema, Area, Comentario, Estado, Responsable, Tema, TipoTema

admin.site.site_header = "Hospital Privado Santa Clara de Asís"
admin.site.site_title = "Administración institucional"
admin.site.index_title = "Usuarios y maestros"


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "color", "activa"]
    list_filter = ["activa"]
    search_fields = ["nombre"]


@admin.register(Responsable)
class ResponsableAdmin(admin.ModelAdmin):
    list_display = ["nombre", "usuario", "activo"]
    list_filter = ["activo"]
    search_fields = ["nombre", "usuario__username"]
    autocomplete_fields = ["usuario"]


@admin.register(TipoTema)
class TipoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "activo"]
    search_fields = ["nombre"]


@admin.register(Estado)
class EstadoAdmin(admin.ModelAdmin):
    list_display = ["nombre", "codigo", "orden", "es_inicial", "es_resuelto", "activo"]
    search_fields = ["nombre"]

    def get_readonly_fields(self, request, obj=None):
        # Cambiar la semántica de un estado usado alteraría temas sin un evento.
        if obj and obj.temas.exists():
            return ["codigo", "es_resuelto"]
        return []


class SoloLecturaAdmin(admin.ModelAdmin):
    """Las escrituras de temas pasan por la aplicación y su servicio auditado."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Tema)
class TemaAdmin(SoloLecturaAdmin):
    list_display = [
        "id",
        "titulo",
        "tipo",
        "estado",
        "prioridad",
        "area_origen",
        "responsable",
        "creador",
    ]
    list_filter = ["estado", "tipo", "prioridad", "area_origen"]
    search_fields = ["titulo", "descripcion", "clave_importacion"]
    list_select_related = ["tipo", "estado", "area_origen", "responsable", "creador"]


@admin.register(Comentario)
class ComentarioAdmin(SoloLecturaAdmin):
    list_display = ["tema", "usuario", "fecha", "es_historico"]
    search_fields = ["texto", "tema__titulo"]
    list_select_related = ["tema", "usuario"]


@admin.register(ActividadTema)
class ActividadAdmin(SoloLecturaAdmin):
    list_display = ["tema", "usuario", "tipo_evento", "campo", "fecha"]
    list_filter = ["tipo_evento", "campo"]
    search_fields = ["tema__titulo"]
    list_select_related = ["tema", "usuario"]
