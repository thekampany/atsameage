from django.apps import AppConfig

class PeopleConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'people'

    def ready(self):
        # Import local
        from django_celery_beat.models import PeriodicTask, CrontabSchedule
        import json

        try:
            if not PeriodicTask.objects.filter(name='my-immich-sync-task').exists():
                schedule, created = CrontabSchedule.objects.get_or_create(
                    minute='0',      
                    hour='3',
                    day_of_week='*',
                    day_of_month='3',
                    month_of_year='*',
                )

                PeriodicTask.objects.create(
                    crontab=schedule,
                    name='my-immich-sync-task',
                    task='people.tasks.sync_people_and_photos',
                    args=json.dumps([]),
                    queue='celery',
                )

            if not PeriodicTask.objects.filter(name='my-photoprism-sync-task').exists():
                schedule_photoprism, created = CrontabSchedule.objects.get_or_create(
                    minute='0',      
                    hour='4',
                    day_of_week='*',
                    day_of_month='3',
                    month_of_year='*',
                )

                PeriodicTask.objects.create(
                    crontab=schedule_photoprism,
                    name='my-photoprism-sync-task',
                    task='people.tasks.sync_photoprism_photos',
                    args=json.dumps([]),
                    queue='celery',
                )


        except Exception:
            pass
