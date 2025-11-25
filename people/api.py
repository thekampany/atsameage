from rest_framework.routers import SimpleRouter
from .views import PersonViewSet, PhotoViewSet

router = SimpleRouter()
router.register('people', PersonViewSet)
router.register('photos', PhotoViewSet)
urlpatterns = router.urls
