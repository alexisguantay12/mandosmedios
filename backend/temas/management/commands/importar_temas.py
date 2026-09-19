"""Importación deliberadamente explícita: no adivina la semántica del Excel.

COLUMNAS no es un esquema histórico aprobado. El JSON --mapping centraliza
encabezados y transformaciones; ver docs/IMPORTADOR.md y mapeo_ejemplo.json.
Cada celda original, incluso las no mapeadas, se conserva en datos_migracion.
"""

import hashlib
import json
import unicodedata
from collections import Counter
from datetime import date, datetime, time
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone
from openpyxl import load_workbook
from openpyxl.utils.datetime import from_excel
from rest_framework.exceptions import ValidationError

from temas.models import Area, Estado, Responsable, Tema, TipoTema
from temas.services import agregar_comentario, crear_tema

# Destinos admitidos. Los encabezados concretos se definen en --mapping.
COLUMNAS = {
    "titulo",
    "descripcion",
    "impacto",
    "tipo",
    "area_origen",
    "areas_involucradas",
    "responsable",
    "estado",
    "prioridad",
    "fecha_creacion",
    "fecha_resolucion",
    "remitente",
    "id_origen",
}


def texto(value):
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").strip()


def normalizar(value):
    value = unicodedata.normalize("NFKD", texto(value))
    return " ".join("".join(c for c in value if not unicodedata.combining(c)).casefold().split())


def serializable(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return value


def interpretar_fecha(value, epoch):
    if value is None or texto(value) == "":
        return None
    if isinstance(value, (int, float)):
        value = from_excel(value, epoch)
    if isinstance(value, str):
        parsed = None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            for fmt in ["%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%d-%m-%Y"]:
                try:
                    parsed = datetime.strptime(value.strip(), fmt)
                    break
                except ValueError:
                    continue
        if parsed is None:
            raise ValueError(f"Fecha no interpretable: {value!r}. Use día/mes/año o ISO 8601.")
        value = parsed
    if isinstance(value, date) and not isinstance(value, datetime):
        value = datetime.combine(value, time.min)
    if not isinstance(value, datetime):
        raise ValueError(f"Fecha no válida: {value!r}.")
    return timezone.make_aware(value) if timezone.is_naive(value) else value


class Command(BaseCommand):
    help = "Inspecciona o importa XLSX con mapeo explícito, transacciones y conservación íntegra."

    def add_arguments(self, parser):
        parser.add_argument("archivo")
        parser.add_argument(
            "--mapping", help="JSON de mapeo validado por el responsable de migración."
        )
        parser.add_argument(
            "--usuario", help="Login Django que ejecuta y queda como autor de la importación."
        )
        parser.add_argument(
            "--fuente", help="Identificador estable del origen, por ejemplo mandos-medios-2026."
        )
        parser.add_argument("--sheet", help="Nombre de la hoja; sin esta opción se recorren todas.")
        parser.add_argument("--header-row", type=int, default=1)
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--inspect",
            action="store_true",
            help="Lee todas las celdas y genera un diagnóstico sin importar.",
        )
        parser.add_argument(
            "--report",
            help="Guarda resumen y errores en JSON; con --inspect incluye todas las filas.",
        )

    def handle(self, *args, **options):
        path = Path(options["archivo"])
        if not path.is_file() or path.suffix.lower() != ".xlsx":
            raise CommandError(
                "Debe indicar un archivo .xlsx existente. Exporte Google Sheets a XLSX."
            )
        if options["header_row"] < 1:
            raise CommandError("--header-row debe ser mayor a cero.")
        try:
            # data_only=False evita reemplazar fórmulas sin caché por celdas vacías.
            book = load_workbook(path, read_only=True, data_only=False)
        except Exception as exc:
            raise CommandError(f"No se pudo leer el libro: {exc}") from exc
        try:
            self.ejecutar(book, path, options)
        finally:
            book.close()

    def ejecutar(self, book, path, options):
        if options["sheet"] and options["sheet"] not in book.sheetnames:
            raise CommandError(f"Hoja inexistente. Disponibles: {', '.join(book.sheetnames)}")
        sheets = [book[options["sheet"]]] if options["sheet"] else book.worksheets
        if options["inspect"]:
            report = {"archivo": path.name, "hojas": []}
            for sheet in sheets:
                rows = list(sheet.iter_rows(values_only=True))
                headers = (
                    rows[options["header_row"] - 1] if len(rows) >= options["header_row"] else []
                )
                content = rows[options["header_row"] :]
                columns = []
                for index, header in enumerate(headers):
                    vals = [row[index] if index < len(row) else None for row in content]
                    columns.append(
                        {
                            "columna": index + 1,
                            "encabezado": serializable(header),
                            "vacias": sum(v is None or texto(v) == "" for v in vals),
                            "tipos": dict(Counter(type(v).__name__ for v in vals if v is not None)),
                            "valores_distintos": len({texto(v) for v in vals if v is not None}),
                            "ejemplos": list(dict.fromkeys(texto(v) for v in vals if texto(v)))[:8],
                        }
                    )
                detail = {
                    "hoja": sheet.title,
                    "filas": len(content),
                    "columnas": columns,
                    "datos": [[serializable(v) for v in row] for row in content],
                }
                report["hojas"].append(detail)
                self.stdout.write(f"{sheet.title}: {len(content)} filas; {len(headers)} columnas.")
                for col in columns:
                    self.stdout.write(
                        f"  {col['columna']}. {col['encabezado']!r}; vacías: {col['vacias']}; tipos: {col['tipos']}"
                    )
            self.guardar_reporte(report, options)
            return
        if not all(options[key] for key in ["mapping", "usuario", "fuente"]):
            raise CommandError(
                "Para importar indique --mapping, --usuario y --fuente. Primero ejecute --inspect."
            )
        try:
            config = json.loads(Path(options["mapping"]).read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as exc:
            raise CommandError(f"Mapeo inválido: {exc}") from exc
        if not isinstance(config, dict):
            raise CommandError("El mapeo debe ser un objeto JSON.")
        for section in ["predeterminados", "valores"]:
            if not isinstance(config.get(section, {}), dict):
                raise CommandError(f"{section} debe ser un objeto JSON.")
        for field, mapping in config.get("valores", {}).items():
            if not isinstance(mapping, dict) or not all(
                isinstance(v, str) for v in mapping.values()
            ):
                raise CommandError(f"valores.{field} debe mapear valores históricos a textos.")
        campos = config.get("columnas", {})
        comentarios = config.get("comentarios", [])
        if not isinstance(campos, dict) or set(campos) - COLUMNAS:
            raise CommandError(f"Destinos admitidos en columnas: {', '.join(sorted(COLUMNAS))}")
        if not isinstance(comentarios, list) or not all(isinstance(x, str) for x in comentarios):
            raise CommandError("comentarios debe ser una lista de encabezados.")
        if not all(isinstance(v, str) for v in campos.values()):
            raise CommandError("Cada destino de columnas debe tener un único encabezado de texto.")
        for field in ["descripcion", "area_origen"]:
            if field not in campos:
                raise CommandError(f"Falta mapear {field}.")
        try:
            usuario = get_user_model().objects.get(username=options["usuario"], is_active=True)
        except get_user_model().DoesNotExist as exc:
            raise CommandError("El usuario importador no existe o está inactivo.") from exc
        resumen = {
            "dry_run": options["dry_run"],
            "procesadas": 0,
            "creadas": 0,
            "omitidas": 0,
            "vacias": 0,
            "errores": [],
            "areas_creadas": 0,
            "comentarios_historicos": 0,
            "advertencias": [],
        }
        # Un rollback exterior abarca también maestros y comentarios del simulacro.
        with transaction.atomic():
            for sheet in sheets:
                iterator = sheet.iter_rows(min_row=options["header_row"], values_only=True)
                raw_headers = next(iterator, ())
                headers = [texto(h) for h in raw_headers]
                normalized = [normalizar(h) for h in headers]
                required = list(campos.values()) + comentarios
                missing = [h for h in required if normalizar(h) not in normalized]
                nonempty = [h for h in normalized if h]
                if len(nonempty) != len(set(nonempty)):
                    raise CommandError(
                        f"{sheet.title}: hay encabezados duplicados; corregir o seleccionar otra hoja."
                    )
                if missing:
                    raise CommandError(
                        f"{sheet.title}: faltan encabezados: {', '.join(missing)}. Nada fue importado."
                    )
                indexes = {normalizar(h): i for i, h in enumerate(headers) if h}
                for rownum, row in enumerate(iterator, options["header_row"] + 1):
                    if not any(texto(v) for v in row):
                        resumen["vacias"] += 1
                        continue
                    resumen["procesadas"] += 1
                    try:
                        with transaction.atomic():
                            outcome = self.importar_fila(
                                row,
                                rownum,
                                headers,
                                indexes,
                                sheet.title,
                                campos,
                                comentarios,
                                config,
                                usuario,
                                options,
                                book.epoch,
                                path,
                            )
                        # Actualizar los contadores sólo después de confirmar el savepoint.
                        for key, value in outcome.items():
                            if key == "advertencias":
                                resumen[key].extend(value)
                            else:
                                resumen[key] += value
                    except (ValueError, ValidationError, IntegrityError) as exc:
                        error = {"hoja": sheet.title, "fila": rownum, "error": str(exc)}
                        resumen["errores"].append(error)
                        self.stderr.write(f"{sheet.title}, fila {rownum}: {exc}")
            if options["dry_run"]:
                transaction.set_rollback(True)
        self.guardar_reporte(resumen, options)
        self.stdout.write(json.dumps(resumen, ensure_ascii=False, indent=2))
        self.stdout.write(
            self.style.SUCCESS(
                "Simulación finalizada; no se guardaron registros."
                if options["dry_run"]
                else "Importación finalizada."
            )
        )
        if resumen["errores"]:
            raise CommandError(
                "Hubo filas rechazadas; las filas válidas se conservaron salvo en --dry-run. Revise el reporte."
            )

    def importar_fila(
        self,
        row,
        rownum,
        headers,
        indexes,
        sheet,
        campos,
        comentarios,
        config,
        usuario,
        options,
        epoch,
        path,
    ):
        defaults = config.get("predeterminados", {})

        def raw(field):
            header = campos.get(field)
            value = row[indexes[normalizar(header)]] if header else None
            return value if texto(value) else defaults.get(field)

        def mapped(field):
            value = texto(raw(field))
            if not value:
                return ""
            mapping = config.get("valores", {}).get(field, {})
            if not isinstance(mapping, dict):
                raise ValueError(f"El mapa valores.{field} debe ser un objeto.")
            normalized = {normalizar(k): v for k, v in mapping.items()}
            if normalizar(value) not in normalized:
                raise ValueError(f"{field}: valor {value!r} sin mapeo explícito.")
            return normalized[normalizar(value)]

        originales = [
            {
                "columna": i + 1,
                "encabezado": headers[i] if i < len(headers) else "",
                "valor": serializable(v),
            }
            for i, v in enumerate(row)
        ]
        content_hash = hashlib.sha256(
            json.dumps(originales, ensure_ascii=False, sort_keys=True).encode()
        ).hexdigest()
        identifier = texto(raw("id_origen"))
        # Con ID externo, cambiar una celda no crea un duplicado: exige revisión.
        # Sin ID, la identidad es hoja+fila; una reordenación requiere otro proceso.
        identity = [options["fuente"], sheet, identifier or f"fila:{rownum}"]
        key = hashlib.sha256(json.dumps(identity, ensure_ascii=False).encode()).hexdigest()
        existente = Tema.objects.filter(clave_importacion=key).first()
        if existente:
            if existente.datos_migracion.get("hash_contenido") != content_hash:
                raise ValueError(
                    "El registro ya se importó pero su contenido cambió. No se sobrescribe; revisar manualmente."
                )
            return {"omitidas": 1}
        for field in ["descripcion", "area_origen", "titulo", "impacto", "responsable"]:
            if texto(raw(field)).startswith("="):
                raise ValueError(
                    f"{field} contiene una fórmula. Exporte valores antes de importar."
                )
        descripcion = texto(raw("descripcion"))
        if not descripcion:
            raise ValueError("Descripción vacía.")
        titulo = texto(raw("titulo")) or " ".join(descripcion.split())[:197] + (
            "…" if len(" ".join(descripcion.split())) > 197 else ""
        )
        if len(titulo) > 200 or len(descripcion) > 30000 or len(texto(raw("impacto"))) > 15000:
            raise ValueError(
                "Título, descripción o impacto excede la longitud permitida; revisar sin truncar información."
            )
        estado = Estado.objects.filter(codigo=mapped("estado"), activo=True).first()
        tipo = TipoTema.objects.filter(nombre__iexact=mapped("tipo"), activo=True).first()
        prioridad = mapped("prioridad")
        if estado is None or tipo is None or prioridad not in Tema.Prioridad.values:
            raise ValueError(
                "Estado/tipo/prioridad sin correspondencia válida; revise valores y predeterminados."
            )
        created_areas = 0

        def area(nombre):
            nonlocal created_areas
            if not nombre or len(nombre) > 120:
                raise ValueError("Área vacía o mayor a 120 caracteres.")
            obj = Area.objects.filter(nombre__iexact=nombre).first()
            if obj is None:
                obj = Area.objects.create(nombre=nombre)
                created_areas += 1
            return obj

        origen = area(texto(raw("area_origen")))
        separador = config.get("separador_areas", ";")
        if not isinstance(separador, str) or not separador:
            raise ValueError("separador_areas debe ser texto no vacío.")
        areas = [
            area(v.strip()) for v in texto(raw("areas_involucradas")).split(separador) if v.strip()
        ]
        responsable = None
        nombre = texto(raw("responsable"))
        if nombre:
            if len(nombre) > 160:
                raise ValueError(
                    "Responsable supera 160 caracteres: puede contener seguimiento en vez de una persona."
                )
            responsable = Responsable.objects.filter(nombre__iexact=nombre).first()
            if responsable is None:
                responsable = Responsable.objects.create(nombre=nombre)
        fecha = interpretar_fecha(raw("fecha_creacion"), epoch)
        resolucion = interpretar_fecha(raw("fecha_resolucion"), epoch)
        if resolucion and not estado.es_resuelto:
            raise ValueError("Tiene fecha de resolución pero el estado no es resuelto.")
        if fecha and resolucion and resolucion < fecha:
            raise ValueError("La resolución es anterior a la creación.")
        warnings = []
        if not fecha:
            warnings.append(f"{sheet}:{rownum}: sin fecha histórica; se usa fecha de importación.")
        if estado.es_resuelto and not resolucion:
            warnings.append(
                f"{sheet}:{rownum}: resolución histórica desconocida; fecha_resolucion queda vacía."
            )
        tema = crear_tema(
            {
                "titulo": titulo,
                "descripcion": descripcion,
                "impacto": texto(raw("impacto")),
                "prioridad": prioridad,
                "tipo": tipo,
                "area_origen": origen,
                "areas_involucradas": areas,
                "responsable": responsable,
            },
            usuario,
            estado=estado,
            clave=key,
            migracion={
                "archivo": path.name,
                "fuente": options["fuente"],
                "hoja": sheet,
                "fila": rownum,
                "celdas": originales,
                "hash_contenido": content_hash,
                "remitente_historico": texto(raw("remitente")),
                "mapeo": config,
            },
        )
        # Sin evidencia no inventar fecha de resolución ni autor histórico.
        changes = {"fecha_resolucion": resolucion}
        if fecha:
            changes["fecha_creacion"] = fecha
        Tema.objects.filter(pk=tema.pk).update(**changes)
        comments = 0
        for header in comentarios:
            value = texto(row[indexes[normalizar(header)]])
            if value:
                # Un bloque largo se conserva completo en fragmentos identificados.
                for index in range(0, len(value), 9000):
                    fragment = value[index : index + 9000]
                    agregar_comentario(
                        tema.pk,
                        usuario,
                        f"Histórico · {header} · {sheet}, fila {rownum}\n{fragment}",
                        historico=True,
                    )
                    comments += 1
        return {
            "creadas": 1,
            "areas_creadas": created_areas,
            "comentarios_historicos": comments,
            "advertencias": warnings,
        }

    def guardar_reporte(self, report, options):
        if options["report"]:
            try:
                Path(options["report"]).write_text(
                    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
                )
            except OSError as exc:
                raise CommandError(f"No se pudo guardar el reporte: {exc}") from exc
