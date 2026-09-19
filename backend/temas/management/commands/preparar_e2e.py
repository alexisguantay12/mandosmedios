import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from temas.models import Area, Estado, Responsable, Tema, TipoTema
from temas.services import agregar_comentario, crear_tema, modificar_tema


class Command(BaseCommand):
    help = "Genera datos exclusivamente ficticios para las pruebas E2E aisladas."

    @transaction.atomic
    def handle(self, *args, **options):
        if settings.SETTINGS_MODULE != "config.e2e_settings":
            raise CommandError("Sólo se permite con --settings=config.e2e_settings.")
        password = os.environ.get("E2E_PASSWORD")
        if not password:
            raise CommandError("Defina E2E_PASSWORD para las cuentas ficticias.")
        if Tema.objects.exists():
            raise CommandError(
                "La base E2E debe estar vacía. Use flush sólo sobre esta base de pruebas."
            )
        call_command("cargar_iniciales")
        user = get_user_model().objects.create_user(
            "pruebas",
            password=password,
            first_name="Ana",
            last_name="Gudiño",
            is_staff=True,
            is_superuser=True,
        )
        other = get_user_model().objects.create_user(
            "otro", password=password, first_name="Usuario", last_name="de prueba"
        )
        areas = {}
        for nombre, color in [
            ("Enfermería", "#0F9278"),
            ("Sistemas", "#2563EB"),
            ("Admisión", "#3B82C4"),
            ("Guardia", "#D75263"),
            ("Farmacia", "#BD577D"),
            ("Mantenimiento", "#A07632"),
            ("Compras", "#9771BF"),
            ("Contabilidad", "#4D7D9C"),
        ]:
            areas[nombre] = Area.objects.create(nombre=nombre, color=color)
        responsible = Responsable.objects.create(nombre="Alexis Guantay")
        laura = Responsable.objects.create(nombre="Laura Pérez")
        curso = Estado.objects.get(codigo="en-curso")
        resuelto = Estado.objects.get(codigo="resuelto")
        tipo = TipoTema.objects.get(nombre="Problema")
        titles = [
            (
                "Demoras en internación",
                "Enfermería",
                ["Enfermería", "Admisión", "Guardia"],
                "alta",
                None,
            ),
            ("Falta de stock de insumos", "Farmacia", ["Farmacia", "Compras"], "alta", None),
            ("Error de acceso a Innova", "Sistemas", ["Sistemas"], "media", None),
            ("Iluminación en estacionamiento", "Mantenimiento", ["Mantenimiento"], "baja", None),
            (
                "Identificación de pacientes",
                "Enfermería",
                ["Enfermería", "Sistemas"],
                "alta",
                curso,
            ),
            (
                "Actualización de puestos de trabajo",
                "Sistemas",
                ["Sistemas", "Compras"],
                "media",
                curso,
            ),
            (
                "Organización del circuito de admisión",
                "Admisión",
                ["Admisión", "Guardia"],
                "media",
                curso,
            ),
        ]
        for title, origin, tags, priority, state in titles:
            topic = crear_tema(
                {
                    "titulo": title,
                    "tipo": tipo,
                    "descripcion": "Registro de demostración con datos ficticios. Se detectan demoras durante los horarios de mayor demanda. Se propone revisar el circuito con las áreas involucradas.",
                    "impacto": "Genera demoras en la asignación de camas, prolonga la permanencia en Guardia y aumenta la carga operativa de los equipos.",
                    "prioridad": priority,
                    "area_origen": areas[origin],
                    "areas_involucradas": [areas[name] for name in tags],
                    "responsable": laura if state is None else responsible,
                },
                user,
            )
            if state:
                modificar_tema(topic.pk, {"estado": state}, user, topic.version)
            agregar_comentario(
                topic.pk, user, "Ejemplo ficticio: se revisará el circuito en la próxima reunión."
            )
        for index in range(7):
            topic = crear_tema(
                {
                    "titulo": f"Mejora resuelta de prueba {index + 1}",
                    "tipo": tipo,
                    "descripcion": "Datos sintéticos para verificar el historial de temas resueltos.",
                    "impacto": "",
                    "prioridad": "baja",
                    "area_origen": areas["Sistemas"],
                    "areas_involucradas": [areas["Sistemas"]],
                    "responsable": responsible,
                },
                other,
            )
            modificar_tema(topic.pk, {"estado": resuelto}, other, topic.version)
        self.stdout.write(self.style.SUCCESS("Datos E2E ficticios preparados."))
