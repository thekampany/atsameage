from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.generics import ListAPIView, RetrieveAPIView

from django.db.models import Q
from django.db.models import Count, Min, Max

from django.conf import settings
from django.utils.timezone import now

from .models import Person, Photo
from .serializers import PersonSerializer, PhotoSerializer
from .utils import calculate_age

import random
from collections import defaultdict

from rest_framework.decorators import api_view
from django_celery_beat.models import PeriodicTask
from atsameage.celery import app

from celery.result import AsyncResult
from django.http import JsonResponse
from people.tasks import sync_people_and_photos


def people_list(request):
    people = (
        Person.objects
        .annotate(
            photo_count=Count("photos"),
            earliest_photo=Min("photos__photo_date"),
            latest_photo=Max("photos__photo_date")
        )
    )

    result = []
    for p in people:
        oldest_age = (
            calculate_age(p.birth_date, p.earliest_photo)
            if p.earliest_photo else None
        )
        youngest_age = (
            calculate_age(p.birth_date, p.latest_photo)
            if p.latest_photo else None
        )

        result.append({
            "id": p.id,
            "name": p.name,
            "photo_count": p.photo_count,
            "oldest_age": oldest_age,
            "youngest_age": youngest_age,
            "thumbnail_path": p.thumbnail_path,
        })

    return JsonResponse(result, safe=False)


class PersonListView(ListAPIView):
    queryset = (
        Person.objects
        .annotate(
            photo_count=Count("photos"),
            earliest_photo=Min("photos__photo_date"),
            latest_photo=Max("photos__photo_date"),
        )
    )
    serializer_class = PersonSerializer


class PersonDetailView(RetrieveAPIView):
    queryset = (
        Person.objects
        .annotate(
            photo_count=Count("photos"),
            earliest_photo=Min("photos__photo_date"),
            latest_photo=Max("photos__photo_date"),
        )
    )
    serializer_class = PersonSerializer

    

class PhotosSameAgeView(APIView):
    def get(self, request):
        try:
            age_months = int(request.GET.get("age_months"))
        except:
            return Response({"error": "age_months parameter is required"}, status=400)

        delta = int(request.GET.get("delta", 1))

        people_param = request.GET.get("people")
        if people_param:
            person_ids = [int(x) for x in people_param.split(",") if x.isdigit()]
        else:
            person_ids = None

        qs = Photo.objects.filter(
            age_at_photo_months__gte=age_months - delta,
            age_at_photo_months__lte=age_months + delta,
        )

        if person_ids:
            qs = qs.filter(person_id__in=person_ids)

        qs = qs.exclude(metadata__type="VIDEO")

        photos = qs.order_by("age_at_photo_months")

        grouped = defaultdict(list)
        for photo in photos:
            grouped[photo.person_id].append(photo)

        selected = [random.choice(photo_list) for photo_list in grouped.values()]

        return Response(PhotoSerializer(selected, many=True).data)


def get_photos_per_month(person):
    photos = person.photos.order_by('age_at_photo_months')
    
    photos_by_month = {}
    
    for photo in photos:
        month = photo.age_at_photo_months
        if month is None or month < 0:  
            continue
        if month not in photos_by_month:
            photos_by_month[month] = {
                "age_in_months": month,
                "photo": {
                    "id": photo.id,
                    "url": photo.remote_url or "",
                    "source": photo.source,
                    "source_id": photo.source_id,
                    "person_face_box": photo.person_face_box  
                }
            }
    
    return [photos_by_month[m] for m in sorted(photos_by_month.keys())]


@api_view(['GET'])
def get_same_age_lane(request):
    people_param = request.query_params.get("people", None)

    if people_param:
        try:
            people_ids = [int(p.strip()) for p in people_param.split(",")]
        except ValueError:
            return Response({"error": "Invalid people parameter"}, status=400)
        people = Person.objects.filter(id__in=people_ids).prefetch_related('photos')
    else:
        people = Person.objects.prefetch_related('photos').all()

    data = []
    for person in people:
        data.append({
            "person_id": person.id,
            "person": person.name,
            "birth_date": person.birth_date,
            "agelane": get_photos_per_month(person)
        })

    return Response(data)


from django.http import HttpResponse
import requests

def photo_proxy(request, photo_id):
    headers = {"x-api-key": f"{settings.IMMICH_API_KEY}"}
    url = f"{settings.IMMICH_API_URL}/assets/{photo_id}/original"
    r = requests.get(url, headers=headers)
    if r.status_code == 200:
        return HttpResponse(r.content, content_type=r.headers["Content-Type"])
    return HttpResponse(status=r.status_code)


@api_view(['GET'])
def list_tasks(request):
    tasks = PeriodicTask.objects.all().values('id', 'name', 'task', 'enabled', 'last_run_at')
    return Response(list(tasks))

@api_view(['POST'])
def run_task(request, task_name):
    result = app.send_task(task_name)
    try:
        pt = PeriodicTask.objects.get(task=task_name)
        pt.last_run_at = now()
        pt.save()
    except PeriodicTask.DoesNotExist:
        pass

    return JsonResponse({"task_id": result.id, "status": result.status})

def task_status(request, task_id):
    result = AsyncResult(task_id)
    return JsonResponse({"task_id": task_id, "status": result.status})

