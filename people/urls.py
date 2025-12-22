from django.urls import path
from .views import (
    PersonListView,
    PersonDetailView,
    PhotosSameAgeView,
    get_same_age_lane,
    photo_proxy,
    list_tasks,
    update_task,
    run_task,
    task_status,
    task_schedule,
    upload_json_view,
)

urlpatterns = [
    path("people/", PersonListView.as_view(), name="people"),
    path("people/<int:pk>/", PersonDetailView.as_view(), name="person-detail"),
    path("photos/same_age/", PhotosSameAgeView.as_view(), name="photos-same-age"),
    path("photos/proxy/<int:photo_id>/", photo_proxy),
    path('sameagelane/', get_same_age_lane, name='sameagelane'),
    path("tasks/", list_tasks, name='list_tasks'),
    path('tasks/<int:task_id>/', update_task, name='update_task'), 
    path('tasks/<int:task_id>/schedule/', task_schedule, name='task_schedule'),
    path("tasks/run/<str:task_name>/", run_task, name='run_task'),
    path("tasks/status/<str:task_id>/", task_status, name="task_status"),
    path('upload-json/', upload_json_view, name='upload-json'),
]

