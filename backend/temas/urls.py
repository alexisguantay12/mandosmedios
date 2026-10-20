from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("temas", views.TemaViewSet, basename="tema")
router.register("areas", views.AreaViewSet)
router.register("tipos", views.TipoViewSet)
router.register("estados", views.EstadoViewSet)
router.register("responsables", views.ResponsableViewSet)
router.register("reuniones",views.ReunionViewSet,basename="reunion")
urlpatterns = [
    path("auth/csrf/", views.CsrfView.as_view()),
    path("auth/login/", views.LoginView.as_view()),
    path("auth/logout/", views.LogoutView.as_view()),
    path("auth/yo/", views.UsuarioActualView.as_view()),
    path("auth/password/", views.PasswordView.as_view()),
    path("", include(router.urls)),
]
