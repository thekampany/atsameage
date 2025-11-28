from rest_framework import serializers
from .models import Person, Photo
from .utils import calculate_age
from django.utils import timezone

class PhotoSerializer(serializers.ModelSerializer):
    person_name = serializers.CharField(source="person.name", read_only=True)
    age_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = [
            "id",
            "remote_url",
            "photo_date",
            "metadata",
            "person_face_box",
            "age_at_photo_years",
            "age_at_photo_months",
            "age_formatted",
            "source_id",
            "person_name",
        ]
    def get_age_formatted(self, obj):
        if obj.age_at_photo_months is None:
            return None

        years = obj.age_at_photo_months // 12
        months = obj.age_at_photo_months % 12

        if years == 0:
            return f"{months}m"
        return f"{years}y {months}m"

class PersonSerializer(serializers.ModelSerializer):
    photo_count = serializers.SerializerMethodField()
    oldest_age = serializers.SerializerMethodField()
    youngest_age = serializers.SerializerMethodField()
    age_in_days = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = [
            "id",
            "name",
            "birth_date",
            "photo_count",
            "oldest_age",
            "youngest_age",
            "age_in_days",
        ]

    def get_photo_count(self, obj):
        return getattr(obj, "photo_count", 0)

    def get_oldest_age(self, obj):
        if not obj.earliest_photo:
            return None
        return calculate_age(obj.birth_date, obj.earliest_photo)

    def get_youngest_age(self, obj):
        if not obj.latest_photo:
            return None
        return calculate_age(obj.birth_date, obj.latest_photo)

    def get_age_in_days(self, obj):
        if not obj.birth_date:
            return None
        today = timezone.now().date()
        delta = today - obj.birth_date
        return delta.days