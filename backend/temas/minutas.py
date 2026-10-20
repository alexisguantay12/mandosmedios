
"""
Motor de generación automática de minutas de Mandos Medios.

Recupera:
- Datos generales de la reunión.
- Asistentes y ausentes.
- Motivos de ausencia.
- Comentarios registrados durante la reunión.
- Cambios netos de estado.
- Observaciones finales.

No modifica temas, comentarios ni actividades originales.
No confirma ni guarda la minuta.
"""

from collections import defaultdict
from datetime import datetime

from django.utils import timezone

from .models import (
    ActividadTema,
    Comentario,
    AsistenciaReunion,
)


def obtener_intervalo_reunion(reunion):
    """
    Devuelve el intervalo [inicio, fin)
    usando la zona horaria configurada en Django.
    """

    zona = timezone.get_current_timezone()

    if timezone.is_aware(reunion.fecha):
        fecha_local = timezone.localtime(
            reunion.fecha, zona
        ).date()
    else:
        fecha_local = reunion.fecha.date()

    inicio = timezone.make_aware(
        datetime.combine(
            fecha_local,
            reunion.hora_inicio,
        ),
        zona,
    )

    fin = timezone.make_aware(
        datetime.combine(
            fecha_local,
            reunion.hora_fin,
        ),
        zona,
    )

    if fin <= inicio:
        raise ValueError(
            "La hora de finalización debe ser posterior "
            "a la hora de inicio."
        )

    return inicio, fin


def extraer_estado(valor):
    """
    Obtiene el ID y nombre de un estado auditado.

    Ejemplo:
    {"id": 1, "nombre": "Nuevo"}
    """

    if not isinstance(valor, dict):
        return None

    return {
        "id": valor.get("id"),
        "nombre": valor.get("nombre"),
    }


def obtener_asistencias(reunion):
    """
    Obtiene la asistencia registrada para la reunión.
    """

    registros = (
        AsistenciaReunion.objects
        .filter(reunion=reunion)
        .select_related("responsable")
        .order_by("responsable__nombre")
    )

    asistentes = []
    ausentes = []
    sin_registrar = []

    for registro in registros:
        persona = {
            "responsable_id": registro.responsable_id,
            "nombre": registro.responsable.nombre,
            "motivo": registro.motivo_ausencia or "",
        }

        if registro.condicion == "presente":
            asistentes.append(persona)

        elif registro.condicion == "ausente":
            ausentes.append(persona)

        else:
            sin_registrar.append(persona)

    return {
        "asistentes": asistentes,
        "ausentes": ausentes,
        "sin_registrar": sin_registrar,
        "cantidad_presentes": len(asistentes),
        "cantidad_ausentes": len(ausentes),
        "cantidad_sin_registrar": len(sin_registrar),
    }


def generar_datos_minuta(reunion):
    """
    Construye los datos de la minuta.

    La información se genera a partir de la actividad
    registrada durante el horario de la reunión.

    No guarda ni confirma la minuta.
    """

    inicio, fin = obtener_intervalo_reunion(reunion)

    movimientos = (
        ActividadTema.objects
        .filter(
            fecha__gte=inicio,
            fecha__lt=fin,
            tipo_evento="estado",
            campo="estado",
        )
        .select_related("tema", "usuario")
        .order_by("fecha", "id")
    )

    comentarios = (
        Comentario.objects
        .filter(
            fecha__gte=inicio,
            fecha__lt=fin,
            es_historico=False,
        )
        .select_related("tema", "usuario")
        .order_by("fecha", "id")
    )

    temas = {}
    grupos_movimientos = defaultdict(list)

    def obtener_tema(tema):
        if tema.pk not in temas:
            temas[tema.pk] = {
                "tema_id": tema.pk,
                "titulo": tema.titulo,
                "estado_inicial": None,
                "estado_final": None,
                "cambio_estado": False,
                "comentarios": [],
                "movimientos_detectados": 0,
                "primera_actividad": None,
            }

        return temas[tema.pk]

    # --------------------------------------------------
    # 1. AGRUPAR CAMBIOS DE ESTADO
    # --------------------------------------------------

    for movimiento in movimientos:
        grupos_movimientos[
            movimiento.tema_id
        ].append(movimiento)

        datos = obtener_tema(movimiento.tema)

        if datos["primera_actividad"] is None:
            datos["primera_actividad"] = movimiento.fecha
        else:
            datos["primera_actividad"] = min(
                datos["primera_actividad"],
                movimiento.fecha,
            )

    # --------------------------------------------------
    # 2. CALCULAR CAMBIOS NETOS
    # --------------------------------------------------

    for tema_id, eventos in grupos_movimientos.items():
        datos = temas[tema_id]

        primero = eventos[0]
        ultimo = eventos[-1]

        inicial = extraer_estado(
            primero.valor_anterior
        )

        final = extraer_estado(
            ultimo.valor_nuevo
        )

        datos["estado_inicial"] = inicial
        datos["estado_final"] = final

        datos["movimientos_detectados"] = len(eventos)

        if inicial and final:
            datos["cambio_estado"] = (
                inicial["id"] != final["id"]
            )

    # --------------------------------------------------
    # 3. INCORPORAR COMENTARIOS
    # --------------------------------------------------

    for comentario in comentarios:
        datos = obtener_tema(comentario.tema)

        if datos["primera_actividad"] is None:
            datos["primera_actividad"] = comentario.fecha
        else:
            datos["primera_actividad"] = min(
                datos["primera_actividad"],
                comentario.fecha,
            )

        if comentario.usuario:
            autor = (
                comentario.usuario.get_full_name()
                or comentario.usuario.username
            )
        else:
            autor = "Usuario no identificado"

        datos["comentarios"].append({
            "id": comentario.pk,
            "autor": autor,
            "fecha": timezone.localtime(
                comentario.fecha
            ).isoformat(),
            "texto": comentario.texto,
        })

    # --------------------------------------------------
    # 4. CONSERVAR SOLO TEMAS TRATADOS
    # --------------------------------------------------

    resultado = []

    for datos in temas.values():

        if (
            not datos["cambio_estado"]
            and not datos["comentarios"]
        ):
            continue

        datos["primera_actividad"] = (
            timezone.localtime(
                datos["primera_actividad"]
            ).isoformat()
        )

        resultado.append(datos)

    resultado.sort(
        key=lambda item: (
            item["primera_actividad"],
            item["tema_id"],
        )
    )

    # Numeración para el documento institucional.
    for numero, tema in enumerate(resultado, start=1):
        tema["numero"] = numero

        # Estado a mostrar en la minuta.
        # Se toma el último estado auditado dentro
        # de la reunión cuando existe.
        estado = tema["estado_final"]

        tema["estado_minuta"] = (
            estado["nombre"]
            if estado and estado.get("nombre")
            else "Sin cambio de estado registrado"
        )

    # --------------------------------------------------
    # 5. ASISTENCIAS
    # --------------------------------------------------

    asistencia = obtener_asistencias(reunion)

    # --------------------------------------------------
    # 6. DATOS GENERALES
    # --------------------------------------------------

    fecha_local = timezone.localtime(
        reunion.fecha
    ).date()

    moderador = (
        reunion.moderador.get_full_name()
        or reunion.moderador.username
    )

    return {
        "reunion_id": reunion.pk,
        "titulo": reunion.titulo,
        "fecha": fecha_local.isoformat(),
        "fecha_formateada": fecha_local.strftime(
            "%d/%m/%Y"
        ),
        "hora_inicio": reunion.hora_inicio.strftime(
            "%H:%M"
        ),
        "hora_fin": reunion.hora_fin.strftime(
            "%H:%M"
        ),
        "moderador": moderador,

        # Asistencia
        **asistencia,

        # Temas
        "cantidad_temas": len(resultado),
        "temas": resultado,

        # Observaciones finales
        "observaciones": reunion.observaciones or "",

        # Estado del documento
        "estado_minuta": reunion.estado_minuta,
    }
