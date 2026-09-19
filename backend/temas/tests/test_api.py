from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from temas.models import ActividadTema, Area, Comentario, Estado, Responsable, TipoTema


class TemaAPITest(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("cargar_iniciales", stdout=StringIO())
        cls.user = get_user_model().objects.create_user("ana", password="Prueba-Segura-982!")
        cls.other = get_user_model().objects.create_user("alexis", password="Prueba-Segura-982!")
        cls.area = Area.objects.create(nombre="Enfermería", color="#16846F")
        cls.systems = Area.objects.create(nombre="Sistemas")
        cls.responsible = Responsable.objects.create(nombre="Alexis Guantay", usuario=cls.other)
        cls.tipo = TipoTema.objects.get(nombre="Problema")
        cls.nuevo = Estado.objects.get(codigo="nuevo")
        cls.curso = Estado.objects.get(codigo="en-curso")
        cls.resuelto = Estado.objects.get(codigo="resuelto")

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)
        self.payload = {
            "titulo": "Demoras en internación",
            "tipo": self.tipo.id,
            "descripcion": "Demoras en asignación de camas.",
            "impacto": "Aumenta la espera en Guardia.",
            "prioridad": "alta",
            "area_origen": self.area.id,
            "areas_involucradas": [self.area.id, self.systems.id],
            "responsable": self.responsible.id,
        }

    def create(self):
        response = self.client.post("/api/temas/", self.payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_requires_authentication_on_all_resources(self):
        self.client.logout()
        for endpoint in ["temas", "areas", "estados", "tipos", "responsables", "auth/yo"]:
            self.assertEqual(self.client.get(f"/api/{endpoint}/").status_code, 401)

    def test_creation_assigns_authenticated_creator_and_audits(self):
        self.payload["creador"] = self.other.id
        self.payload["estado"] = self.resuelto.id
        result = self.create()
        self.assertEqual(result["creador"]["id"], self.user.id)
        self.assertEqual(result["estado"]["id"], self.nuevo.id)
        self.assertEqual(result["impacto"], self.payload["impacto"])
        activity = ActividadTema.objects.get()
        self.assertEqual(activity.usuario, self.user)
        self.assertEqual(activity.valor_nuevo["areas_involucradas"][1]["id"], self.systems.id)

    def test_state_resolution_reopening_and_stale_version(self):
        topic = self.create()
        url = f"/api/temas/{topic['id']}/cambiar-estado/"
        result = self.client.post(url, {"estado": self.resuelto.id, "version": 1}, format="json")
        self.assertEqual(result.status_code, 200)
        self.assertIsNotNone(result.data["fecha_resolucion"])
        stale = self.client.post(url, {"estado": self.curso.id, "version": 1}, format="json")
        self.assertEqual(stale.status_code, 409)
        reopened = self.client.post(url, {"estado": self.curso.id, "version": 2}, format="json")
        self.assertIsNone(reopened.data["fecha_resolucion"])
        event = ActividadTema.objects.filter(tipo_evento="estado").first()
        self.assertEqual(event.valor_anterior["id"], self.nuevo.id)
        self.assertEqual(event.valor_nuevo["id"], self.resuelto.id)

    def test_update_fields_and_areas_have_separate_events(self):
        topic = self.create()
        response = self.client.patch(
            f"/api/temas/{topic['id']}/",
            {
                "version": 1,
                "responsable": None,
                "prioridad": "baja",
                "areas_involucradas": [self.systems.id],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ActividadTema.objects.filter(tipo_evento="area_quitada").count(), 1)
        self.assertEqual(ActividadTema.objects.filter(campo="responsable").count(), 1)
        self.assertEqual(response.data["version"], 2)

    def test_noop_does_not_increment_version(self):
        topic = self.create()
        result = self.client.patch(
            f"/api/temas/{topic['id']}/", {"version": 1, "titulo": topic["titulo"]}, format="json"
        )
        self.assertEqual(result.data["version"], 1)
        self.assertEqual(ActividadTema.objects.count(), 1)

    def test_version_required_for_editing(self):
        topic = self.create()
        self.assertEqual(
            self.client.patch(
                f"/api/temas/{topic['id']}/", {"titulo": "Otro"}, format="json"
            ).status_code,
            400,
        )

    def test_comment_separate_from_automatic_activity(self):
        topic = self.create()
        url = f"/api/temas/{topic['id']}/comentarios/"
        self.assertEqual(self.client.post(url, {"texto": "   "}, format="json").status_code, 400)
        result = self.client.post(
            url,
            {"texto": "Información aportada por otra persona.", "usuario": self.other.id},
            format="json",
        )
        self.assertEqual(result.status_code, 201)
        self.assertEqual(result.data["usuario"]["id"], self.user.id)
        self.assertEqual(ActividadTema.objects.count(), 1)
        self.assertEqual(Comentario.objects.count(), 1)
        self.assertEqual(self.client.get(url).data["count"], 1)
        self.assertEqual(self.client.get(f"/api/temas/{topic['id']}/").data["version"], 2)

    def test_mine_means_creator_not_responsible(self):
        topic = self.create()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get("/api/temas/mis-temas/").data["count"], 0)
        self.client.force_login(self.user)
        result = self.client.get("/api/temas/mis-temas/")
        self.assertEqual(result.data["results"][0]["id"], topic["id"])

    def test_resolved_board_only_five_and_list_all(self):
        for index in range(7):
            topic = self.create()
            self.client.post(
                f"/api/temas/{topic['id']}/cambiar-estado/",
                {"estado": self.resuelto.id, "version": 1},
                format="json",
            )
        board = self.client.get("/api/temas/tablero/").data
        resolved = next(c for c in board if c["estado"]["es_resuelto"])
        self.assertEqual(resolved["cantidad"], 7)
        self.assertEqual(len(resolved["temas"]), 5)
        self.assertEqual(self.client.get("/api/temas/?resueltos=1").data["count"], 7)
        self.assertGreater(resolved["temas"][0]["id"], resolved["temas"][-1]["id"])

    def test_search_filters_and_invalid_ids(self):
        topic = self.create()
        for query in [
            f"buscar=%23{topic['id']}",
            "buscar=Demoras",
            f"area={self.systems.id}",
            "prioridad=alta",
        ]:
            self.assertEqual(self.client.get("/api/temas/?" + query).data["count"], 1)
        self.assertEqual(self.client.get("/api/temas/?responsable=abc").status_code, 400)
        self.assertEqual(self.client.get("/api/temas/?prioridad=urgente").status_code, 400)

    def test_new_type_from_admin_data_and_inactive_validation(self):
        custom = TipoTema.objects.create(nombre="Propuesta")
        self.payload["tipo"] = custom.id
        self.create()
        custom.activo = False
        custom.save()
        self.assertEqual(
            self.client.post("/api/temas/", self.payload, format="json").status_code, 400
        )

    def test_no_deletion_or_audit_mutation(self):
        topic = self.create()
        self.assertEqual(self.client.delete(f"/api/temas/{topic['id']}/").status_code, 405)
        self.assertEqual(
            self.client.post(f"/api/temas/{topic['id']}/actividad/", {}, format="json").status_code,
            405,
        )
        self.assertEqual(
            self.client.post("/api/areas/", {"nombre": "Otra"}, format="json").status_code, 405
        )

    def test_missing_topic_returns_404(self):
        self.assertEqual(self.client.get("/api/temas/999999/").status_code, 404)

    def test_csrf_login_logout_password_real_session(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(
            client.post(
                "/api/auth/login/", {"username": "ana", "password": "Prueba-Segura-982!"}
            ).status_code,
            403,
        )
        token = client.get("/api/auth/csrf/").data["csrfToken"]
        response = client.post(
            "/api/auth/login/",
            {"username": "ana", "password": "Prueba-Segura-982!"},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(response.status_code, 200)
        token = response.data["csrfToken"]
        self.assertEqual(client.post("/api/temas/", self.payload, format="json").status_code, 403)
        changed = client.post(
            "/api/auth/password/",
            {
                "actual": "Prueba-Segura-982!",
                "nueva": "Nueva-Clave-873#",
                "confirmar": "Nueva-Clave-873#",
            },
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(client.get("/api/auth/yo/").status_code, 200)
        self.assertEqual(client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code, 204)
        self.assertEqual(client.get("/api/auth/yo/").status_code, 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Nueva-Clave-873#"))

    def test_password_wrong_current_weak_and_mismatch(self):
        for body in [
            {"actual": "incorrecta", "nueva": "Nueva-Clave-873#", "confirmar": "Nueva-Clave-873#"},
            {"actual": "Prueba-Segura-982!", "nueva": "123", "confirmar": "123"},
            {"actual": "Prueba-Segura-982!", "nueva": "Nueva-Clave-873#", "confirmar": "distinta"},
        ]:
            self.assertEqual(
                self.client.post("/api/auth/password/", body, format="json").status_code, 400
            )

    def test_seed_idempotent(self):
        call_command("cargar_iniciales", stdout=StringIO())
        self.assertEqual(Estado.objects.count(), 3)
        self.assertEqual(TipoTema.objects.count(), 2)
