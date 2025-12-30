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
from django_celery_beat.models import PeriodicTask, CrontabSchedule, IntervalSchedule
from atsameage.celery import app

from celery.result import AsyncResult

from people.tasks import sync_people_and_photos

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

import uuid
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from django.db import transaction
from django.core.exceptions import ValidationError
from django.core.files import File
from django.core.files.storage import default_storage

from django.core.cache import cache


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
    serializer_class = PersonSerializer
    queryset = (
        Person.objects
        .annotate(
            photo_count=Count("photos"),
            earliest_photo=Min("photos__photo_date"),
            latest_photo=Max("photos__photo_date"),
        )
        .order_by("-birth_date") 
    )

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

        qs = qs.exclude(metadata__type="VIDEO") | qs.filter(metadata={})

        photos = qs.order_by("age_at_photo_months")

        grouped = defaultdict(list)
        for photo in photos:
            grouped[photo.person_id].append(photo)

        selected = [random.choice(photo_list) for photo_list in grouped.values()]

        selected.sort(key=lambda photo: photo.person.birth_date, reverse=True) 

        return Response(PhotoSerializer(selected, many=True, context={'request': request}).data)

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

    cache_key = f'sameagelane_{people_param or "all"}'
    
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return Response(cached_data)

    if people_param:
        try:
            people_ids = [int(p.strip()) for p in people_param.split(",")]
        except ValueError:
            return Response({"error": "Invalid people parameter"}, status=400)
        people = Person.objects.filter(id__in=people_ids).prefetch_related('photos').order_by('-birth_date')
    else:
        people = Person.objects.prefetch_related('photos').all().order_by('-birth_date')

    data = []
    for person in people:
        data.append({
            "person_id": person.id,
            "person": person.name,
            "birth_date": person.birth_date,
            "agelane": get_photos_per_month(person)
        })

    cache.set(cache_key, data, 60 * 15)

    return Response(data)


from django.http import HttpResponse
import requests

def photo_proxy(request, photo_id):
    try:
        photo = Photo.objects.get(id=photo_id)
    except Photo.DoesNotExist:
        return HttpResponse(status=404)
    
    if photo.source == 'own_json' or photo.source == 'photoprism':
        if photo.file_path:
            try:
                from django.core.files.storage import default_storage
                
                if default_storage.exists(photo.file_path.name):
                    file = default_storage.open(photo.file_path.name, 'rb')
                    from django.http import FileResponse
                    import mimetypes
                    
                    content_type, _ = mimetypes.guess_type(photo.file_path.name)
                    return FileResponse(file, content_type=content_type or 'image/jpeg')
                else:
                    return HttpResponse(status=404)
            except Exception as e:
                print(f"Error serving file: {e}")
                return HttpResponse(status=500)
        return HttpResponse(status=404)
    else:
        headers = {"x-api-key": f"{settings.IMMICH_API_KEY}"}
        url = f"{settings.IMMICH_API_URL}/assets/{photo.source_id}/original"
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            return HttpResponse(r.content, content_type=r.headers["Content-Type"])
        return HttpResponse(status=r.status_code)

@api_view(['GET'])
def list_tasks(request):
    tasks = PeriodicTask.objects.all()
    task_list = []
    
    for task in tasks:
        schedule_info = None
        
        if task.crontab:
            schedule_info = {
                'type': 'crontab',
                'minute': task.crontab.minute,
                'hour': task.crontab.hour,
                'day_of_week': task.crontab.day_of_week,
                'day_of_month': task.crontab.day_of_month,
                'month_of_year': task.crontab.month_of_year,
            }
        elif task.interval:
            schedule_info = {
                'type': 'interval',
                'every': task.interval.every,
                'period': task.interval.period,
            }
        
        task_list.append({
            'id': task.id,
            'name': task.name,
            'task': task.task,
            'enabled': task.enabled,
            'last_run_at': task.last_run_at,
            'schedule': schedule_info,
        })
    
    return Response(task_list)

@api_view(['PATCH'])
def update_task(request, task_id):
    try:
        task = PeriodicTask.objects.get(id=task_id)
    except PeriodicTask.DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)
    
    if 'enabled' in request.data:
        task.enabled = request.data['enabled']
        task.save()
    
    return Response({
        'id': task.id,
        'name': task.name,
        'task': task.task,
        'enabled': task.enabled,
        'last_run_at': task.last_run_at,
    })

@api_view(['GET', 'PUT'])
def task_schedule(request, task_id):
    try:
        task = PeriodicTask.objects.get(id=task_id)
    except PeriodicTask.DoesNotExist:
        return Response({'error': 'Task not found'}, status=404)
    
    if request.method == 'GET':
        schedule_info = None
        
        if task.crontab:
            schedule_info = {
                'type': 'crontab',
                'minute': task.crontab.minute,
                'hour': task.crontab.hour,
                'day_of_week': task.crontab.day_of_week,
                'day_of_month': task.crontab.day_of_month,
                'month_of_year': task.crontab.month_of_year,
            }
        elif task.interval:
            schedule_info = {
                'type': 'interval',
                'every': task.interval.every,
                'period': task.interval.period,
            }
        
        return Response({
            'id': task.id,
            'name': task.name,
            'task': task.task,
            'enabled': task.enabled,
            'schedule': schedule_info,
        })
    
    elif request.method == 'PUT':
        schedule_type = request.data.get('schedule_type')
        
        if schedule_type == 'crontab':
            crontab, created = CrontabSchedule.objects.get_or_create(
                minute=request.data.get('minute', '*'),
                hour=request.data.get('hour', '*'),
                day_of_week=request.data.get('day_of_week', '*'),
                day_of_month=request.data.get('day_of_month', '*'),
                month_of_year=request.data.get('month_of_year', '*'),
            )
            task.crontab = crontab
            task.interval = None
            
        elif schedule_type == 'interval':
            interval, created = IntervalSchedule.objects.get_or_create(
                every=request.data.get('every'),
                period=request.data.get('period'),
            )
            task.interval = interval
            task.crontab = None
        
        if 'enabled' in request.data:
            task.enabled = request.data['enabled']
        
        task.save()
        
        return Response({
            'message': 'Schedule updated successfully',
            'id': task.id,
            'name': task.name,
        })

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

@api_view(['GET'])
def task_status(request, task_id):
    result = AsyncResult(task_id)
    return JsonResponse({"task_id": task_id, "status": result.status})

def process_json_upload(json_data, uploaded_files):
    stats = {
        'persons_created': 0,
        'persons_updated': 0,
        'photos_created': 0,
        'photos_skipped': 0,
        'errors': []
    }
    
    if 'persons' not in json_data:
        raise ValidationError("JSON needs a 'persons' array")
    
    with transaction.atomic():
        for person_data in json_data['persons']:
            try:
                if 'birth_date' not in person_data:
                    stats['errors'].append(f"Person without birth_date was skipped")
                    continue
                
                person_name = person_data.get('name', '')
                
                person = Person.objects.filter(name=person_name).first()
                
                if person:
                    stats['persons_updated'] += 1
                else:
                    person = Person.objects.create(
                        immich_id=uuid.uuid4(),
                        name=person_name,
                        birth_date=person_data['birth_date'],
                        thumbnail_path='',
                        updated_at=datetime.now()
                    )
                    stats['persons_created'] += 1
                
                photos = person_data.get('photos', [])
                for photo_data in photos:
                    try:
                        filename = photo_data.get('filename')
                        
                        if not filename:
                            stats['errors'].append(f"Photo without filename for {person.name}")
                            continue
                            
                        if filename not in uploaded_files:
                            stats['errors'].append(f"File {filename} not found in upload")
                            continue
                        
                        existing_photo = Photo.objects.filter(
                            file_path__icontains=filename
                        ).first()
                        
                        if existing_photo:
                            stats['photos_skipped'] += 1
                            continue 
                        
                        photo_date = photo_data.get('photo_date')
                        
                        age_years = None
                        age_months = None
                        if photo_date:
                            photo_date_obj = datetime.strptime(photo_date, '%Y-%m-%d').date()
                            birth_date_obj = datetime.strptime(person_data['birth_date'], '%Y-%m-%d').date()
                            
                            delta = relativedelta(photo_date_obj, birth_date_obj)
                            age_years = delta.years + delta.months / 12.0
                            age_months = delta.years * 12 + delta.months
                        
                        width = photo_data.get('width', 1920)
                        height = photo_data.get('height', 1080)
                        person_face_box = [0, 0, width, height]
                        
                        source_id = f"own_json_{uuid.uuid4().hex[:12]}"
                        
                        photo = Photo(
                            person=person,
                            photo_date=photo_date,
                            source='own_json',
                            source_id=source_id,
                            person_face_box=person_face_box,
                            metadata={},
                            age_at_photo_years=age_years,
                            age_at_photo_months=age_months
                        )
                        
                        photo.file_path.save(filename, uploaded_files[filename], save=False)
                        photo.save()
                        
                        stats['photos_created'] += 1
                        
                    except Exception as e:
                        stats['errors'].append(f"Error at photo {filename} for {person.name}: {str(e)}")
                        
            except Exception as e:
                stats['errors'].append(f"Error at person: {str(e)}")

    try:
        if hasattr(cache, 'delete_pattern'):
            cache.delete_pattern('sameagelane_*')
        else:
            from django_redis import get_redis_connection
            redis_conn = get_redis_connection('default')
            keys = redis_conn.keys('sameagelane_*')
            if keys:
                redis_conn.delete(*keys)
    except Exception as e:
        print(f"Cache clear warning: {e}")

    return stats

@csrf_exempt
def upload_json_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Only POST allowed'}, status=405)
    
    try:
        json_file = request.FILES.get('json')
        if not json_file:
            return JsonResponse({'error': 'No JSON file found'}, status=400)
        
        json_data = json.loads(json_file.read())
        
        uploaded_files = {}
        for key in request.FILES:
            if key != 'json':
                files = request.FILES.getlist(key)
                for file in files:                  
                    uploaded_files[file.name] = file
        
        stats = process_json_upload(json_data, uploaded_files) 
        
        return JsonResponse({
            'success': True,
            'stats': stats
        })
    except ValidationError as e:
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Unexpected error: {str(e)}'}, status=500)