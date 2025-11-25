from django.db import models


class Person(models.Model):
    immich_id = models.UUIDField(unique=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    birth_date = models.DateField()
    thumbnail_path = models.CharField(max_length=500, blank=True, null=True)
    updated_at = models.DateTimeField()


class Photo(models.Model):
    person = models.ForeignKey(Person, related_name='photos', on_delete=models.CASCADE)
    photo_date = models.DateField(null=True, blank=True)

    source = models.CharField(max_length=100, blank=True)
    source_id = models.CharField(max_length=200, blank=True)

    remote_url = models.URLField(max_length=500, blank=True)  
    person_face_box = models.JSONField(default=list, blank=True)    

    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    age_at_photo_years = models.FloatField(null=True, blank=True)
    age_at_photo_months = models.IntegerField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['person', 'photo_date'])]

    def __str__(self):
        return f"Photo({self.person}, {self.photo_date})"
