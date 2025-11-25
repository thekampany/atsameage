import requests
from datetime import datetime
from celery import shared_task
from django.conf import settings
from .models import Person, Photo
import os
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

IMMICH_API_URL = os.environ.get('IMMICH_API_URL')
IMMICH_API_KEY = os.environ.get('IMMICH_API_KEY')


def immich_get(path):
    url = f"{IMMICH_API_URL}{path}"
    headers = {
        "x-api-key": IMMICH_API_KEY,
        "Accept": "application/json"
    }
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def immich_post(path, data):
    url = f"{IMMICH_API_URL}{path}"
    headers = {
        "x-api-key": IMMICH_API_KEY,
        "Accept": "application/json",
    }
    logger.info(f"POST {url} with data {data}")
    resp = requests.post(url, json=data, headers=headers, timeout=120)
    resp.raise_for_status()
    return resp.json()


@shared_task(bind=True, max_retries=3)
def sync_people_and_photos(self):
    try:
        people_json = immich_get("/people").get("people", [])
        logger.info(f"Found {len(people_json)} people in Immich")

        for p in people_json:
            birthdate_raw = p.get("birthDate")
            birthdate = None
            if birthdate_raw:
                try:
                    birthdate = datetime.fromisoformat(birthdate_raw).date()
                except Exception as e:
                    logger.warning(f"Could not parse birthdate for {p.get('name')}: {e}")

            if birthdate:

                try:
                    person, _ = Person.objects.update_or_create(
                        immich_id=str(UUID(p["id"])),
                        defaults={
                            "name": p.get("name", ""),
                            "birth_date": birthdate,
                            "thumbnail_path": p.get("thumbnailPath"),
                            "updated_at": datetime.fromisoformat(p["updatedAt"].replace("Z", "+00:00"))
                        }
                    )
                    logger.info(f"Processing person: {person.name} ({person.immich_id})")

                    data = {"personIds": [str(person.immich_id)]}
                    next_page = True

                    while next_page:
                        search_result = immich_post("/search/metadata", data)
                        assets = search_result.get("assets", {}).get("items", [])
                        logger.info(f"Found {len(assets)} assets for {person.name} on current page")

                        for asset in assets:
                            person_data = next(
                                (pd for pd in asset.get("people", []) if pd["id"] == str(person.immich_id)),
                                None
                            )
                            if not person_data:
                                continue

                            photo_id = asset.get("id")
                            taken_at_raw = asset.get("fileCreatedAt")
                            photo_date = None
                            if taken_at_raw:
                                try:
                                    photo_date = datetime.fromisoformat(taken_at_raw.replace("Z", "+00:00")).date()
                                except Exception as e:
                                    logger.warning(f"Failed to parse photo_date for photo {photo_id}: {e}")

                            faces = person_data.get("faces", [])
                            face_box = faces[0] if faces else None
                            remote_url = f"{IMMICH_API_URL}/assets/{photo_id}/original"

                            if photo_date and person.birth_date:
                                delta = photo_date - person.birth_date
                                age_years = delta.days / 365.25
                                age_months = int(delta.days / 30.44)
                            else:
                                age_years = None
                                age_months = None

                            Photo.objects.update_or_create(
                                person=person,
                                source="immich",
                                source_id=str(photo_id),
                                defaults={
                                    "photo_date": photo_date,
                                    "remote_url": remote_url,
                                    "person_face_box": face_box if face_box else [],
                                    "metadata": asset,
                                    "age_at_photo_years": age_years,
                                    "age_at_photo_months": age_months,
                                }
                            )
                            logger.info(f"Added/updated photo {photo_id} for {person.name}")

                        next_page = search_result.get("assets", {}).get("nextPage")
                        print(next_page)
                        if next_page:
                            print(f"Fetching next page {next_page} for {person.name}")
                            logger.info(f"Fetching next page {next_page} for {person.name}")
                            data["page"] = next_page

                except Exception as e:
                    logger.error(f"Error processing person {p.get('name')}: {e}")

        logger.info("Sync complete")
        return "Sync complete"

    except requests.RequestException as exc:
        logger.error(f"HTTP error during sync: {exc}")
        self.retry(exc=exc, countdown=60)
    except Exception as exc:
        logger.error(f"Unexpected error during sync: {exc}")
        self.retry(exc=exc, countdown=60)
