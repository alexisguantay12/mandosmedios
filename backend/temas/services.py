"""Único punto de escritura de temas: transacción, concurrencia y auditoría."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from .models import ActividadTema, Comentario, Estado, Tema


class ConflictoEdicion(APIException):
    status_code = 409
    default_detail = "El tema cambió mientras lo editabas. Recargalo para ver la última versión."


def valor_auditable(value):
    if hasattr(value, "pk"):
        return {"id": value.pk, "nombre": str(value)}
    return value


def registrar(tema, usuario, evento, campo="", anterior=None, nuevo=None):
    return ActividadTema.objects.create(
        tema=tema,
        usuario=usuario,
        tipo_evento=evento,
        campo=campo,
        valor_anterior=anterior,
        valor_nuevo=nuevo,
    )


@transaction.atomic
def crear_tema(datos, usuario, *, estado=None, migracion=None, clave=None):
    datos = dict(datos)
    areas = datos.pop("areas_involucradas", [])
    if estado is None:
        estado = Estado.objects.filter(es_inicial=True, activo=True).first()
    if estado is None:
        raise ValidationError("No hay un estado inicial activo. Configuralo en Django Admin.")
    tema = Tema.objects.create(
        **datos,
        estado=estado,
        creador=usuario,
        fecha_resolucion=timezone.now() if estado.es_resuelto else None,
        datos_migracion=migracion or {},
        clave_importacion=clave,
    )
    tema.areas_involucradas.set(areas)
    registrar(
        tema,
        usuario,
        "importacion" if clave else "creacion",
        nuevo={
            "titulo": tema.titulo,
            "tipo": valor_auditable(tema.tipo),
            "descripcion": tema.descripcion,
            "impacto": tema.impacto,
            "prioridad": tema.prioridad,
            "estado": valor_auditable(tema.estado),
            "area_origen": valor_auditable(tema.area_origen),
            "areas_involucradas": [valor_auditable(a) for a in areas],
            "responsable": valor_auditable(tema.responsable),
        },
    )
    return tema


@transaction.atomic
def modificar_tema(tema_id, datos, usuario, version):
    tema = Tema.objects.select_for_update().get(pk=tema_id)
    if tema.version != version:
        raise ConflictoEdicion()
    datos = dict(datos)
    areas = datos.pop("areas_involucradas", None)
    hubo_cambios = False
    for campo, nuevo in datos.items():
        anterior = getattr(tema, campo)
        if anterior == nuevo:
            continue
        registrar(
            tema,
            usuario,
            "estado" if campo == "estado" else "edicion",
            campo,
            valor_auditable(anterior),
            valor_auditable(nuevo),
        )
        setattr(tema, campo, nuevo)
        hubo_cambios = True
        if campo == "estado":
            # Reabrir quita la resolución actual; las anteriores permanecen en el historial.
            tema.fecha_resolucion = timezone.now() if nuevo.es_resuelto else None
    if areas is not None:
        anteriores = {a.pk: a for a in tema.areas_involucradas.all()}
        nuevas = {a.pk: a for a in areas}
        for pk in anteriores.keys() - nuevas.keys():
            registrar(
                tema, usuario, "area_quitada", "areas_involucradas", valor_auditable(anteriores[pk])
            )
        for pk in nuevas.keys() - anteriores.keys():
            registrar(
                tema,
                usuario,
                "area_agregada",
                "areas_involucradas",
                nuevo=valor_auditable(nuevas[pk]),
            )
        if anteriores.keys() != nuevas.keys():
            tema.areas_involucradas.set(areas)
            hubo_cambios = True
    if hubo_cambios:
        tema.version += 1
        tema.save()
    return tema


@transaction.atomic
def agregar_comentario(tema_id, usuario, texto, *, historico=False):
    tema = Tema.objects.select_for_update().get(pk=tema_id)
    comentario = Comentario.objects.create(
        tema=tema,
        usuario=usuario,
        texto=texto,
        es_historico=historico,
    )
    # El comentario es una entidad humana separada; no se duplica como actividad.
    tema.version += 1
    tema.save(update_fields=["fecha_actualizacion", "version"])
    return comentario
