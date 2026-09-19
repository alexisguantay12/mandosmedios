from django.core.management.base import BaseCommand
from django.db import transaction

from temas.models import Estado, TipoTema


class Command(BaseCommand):
    help = "Crea tipos y estados iniciales; no sobrescribe maestros existentes."

    @transaction.atomic
    def handle(self, *args, **options):
        for nombre in ["Problema", "Tema Informativo"]:
            TipoTema.objects.get_or_create(nombre=nombre)
        for orden, (codigo, nombre, inicial, resuelto) in enumerate(
            [
                ("nuevo", "Nuevo", True, False),
                ("en-curso", "En curso", False, False),
                ("resuelto", "Resuelto", False, True),
            ]
        ):
            Estado.objects.get_or_create(
                codigo=codigo,
                defaults={
                    "nombre": nombre,
                    "orden": orden,
                    "es_inicial": inicial and not Estado.objects.filter(es_inicial=True).exists(),
                    "es_resuelto": resuelto,
                },
            )
        self.stdout.write(self.style.SUCCESS("Tipos y estados iniciales disponibles."))
