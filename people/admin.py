# people/admin.py
from django.contrib import admin
from .models import Person, Photo

@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("name", "immich_id", "birth_date", "updated_at")
    search_fields = ("name", "immich_id")
    list_filter = ("birth_date",)

@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ("person", "photo_date", "source", "source_id")
    search_fields = ("person__name", "source_id")
    list_filter = ("photo_date", "source")
