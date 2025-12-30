import requests
from datetime import datetime
from celery import shared_task
from django.conf import settings
from .models import Person, Photo
import os
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


from django.core.files.base import ContentFile
import time




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


PHOTOPRISM_BASE_URL = os.environ.get('PHOTOPRISM_BASE_URL')
PHOTOPRISM_TOKEN = os.environ.get('PHOTOPRISM_TOKEN')
PHOTOPRISM_SECURITY_TOKEN = os.environ.get('PHOTOPRISM_SECURITY_TOKEN')

def photoprism_get(endpoint, params=None):
    url = f"{PHOTOPRISM_BASE_URL}{endpoint}"
    headers = {}
    headers['Authorization'] = "Bearer " + PHOTOPRISM_TOKEN
    
    response = requests.get(url, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def photoprism_get_raw(url):
    headers = {}
    headers['Authorization'] = "Bearer " + PHOTOPRISM_TOKEN
    
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.content


@shared_task(bind=True, max_retries=3)
def sync_photoprism_photos(self):
    """
    Sync photos from PhotoPrism for all existing persons.
    For each person in the database, search PhotoPrism for photos containing that person.
    """
    try:
        persons = Person.objects.all()
        logger.info(f"Starting PhotoPrism sync for {persons.count()} persons")

        total_imported = 0
        total_skipped = 0

        for person in persons:
            if not person.name:
                logger.warning(f"Person {person.id} has no name, skipping")
                continue

            logger.info(f"Processing PhotoPrism photos for: {person.name}")
            
            try:
                imported, skipped = sync_person_photos(person)
                total_imported += imported
                total_skipped += skipped
                logger.info(f"Completed {person.name}: {imported} imported, {skipped} skipped")
            except Exception as e:
                logger.error(f"Error processing person {person.name}: {e}")
                continue

        logger.info(f"PhotoPrism sync complete: {total_imported} imported, {total_skipped} skipped")
        return f"Sync complete: {total_imported} imported, {total_skipped} skipped"

    except Exception as exc:
        logger.error(f"Unexpected error during PhotoPrism sync: {exc}")
        self.retry(exc=exc, countdown=60)


def sync_person_photos(person):
    """
    Sync all photos for a specific person from PhotoPrism
    Returns tuple: (imported_count, skipped_count)
    """
    offset = 0
    count = 200
    imported = 0
    skipped = 0

    while True:
        params = {
            'count': count,
            'offset': offset,
            'order': 'newest',
            'q': f'person:{person.name}',
            'video': 'false'
        }

        try:
            photos_data = photoprism_get("/api/v1/photos/", params=params)
        except requests.RequestException as e:
            logger.error(f"Error fetching photos for {person.name}: {e}")
            break

        if not photos_data:
            break

        logger.info(f"  Found {len(photos_data)} photos at offset {offset} for {person.name}")

        for photo_data in photos_data:
            file_hash = photo_data.get('Hash')
            if not file_hash:
                continue

            # Check if photo already exists
            if Photo.objects.filter(source='photoprism', source_id=file_hash, person=person).exists():
                skipped += 1
                continue

            # Process this photo
            if process_single_photo(person, photo_data, file_hash):
                imported += 1
            else:
                skipped += 1

            # Small delay to avoid overwhelming the server
            time.sleep(0.1)

        offset += count

        # If we got fewer results than requested, we're done
        if len(photos_data) < count:
            break

    return imported, skipped


def process_single_photo(person, photo_data, file_hash):
    """
    Process a single photo: check markers, download, and save
    Returns True if imported successfully, False otherwise
    """
    
    # Get file details with markers
    try:
        file_data = photoprism_get(f"/api/v1/files/{file_hash}/")
    except requests.RequestException as e:
        logger.warning(f"Error fetching file details for {file_hash}: {e}")
        return False

    # Check markers for matching person
    markers = file_data.get('Markers', [])
    matching_marker = None
    
    for marker in markers:
        if marker.get('Name') == person.name:
            matching_marker = marker
            break

    if not matching_marker:
        # Person not in this photo's markers
        return False

    # Get download token
    download_key = PHOTOPRISM_SECURITY_TOKEN
    if not download_key:
        logger.warning(f"No download token for {file_hash}")
        return False

    # Download the photo
    photo_url = f"{PHOTOPRISM_BASE_URL}/api/v1/t/{file_hash}/{download_key}/tile_500"
    
    try:
        photo_content = photoprism_get_raw(photo_url)
    except requests.RequestException as e:
        logger.warning(f"Error downloading photo {file_hash}: {e}")
        return False

    # Parse photo date
    photo_date = None
    taken_at = photo_data.get('TakenAt')
    if taken_at:
        try:
            photo_date = datetime.fromisoformat(taken_at.replace('Z', '+00:00')).date()
        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse photo_date for {file_hash}: {e}")

    # Calculate bounding box from marker
    person_face_box = {
        "imageWidth": 500,
        "imageHeight": 500,
        "boundingBoxX1": matching_marker.get('X', 0) * 500,
        "boundingBoxX2": matching_marker.get('X', 0) * 500 + matching_marker.get('W', 0) * 500,
        "boundingBoxY1": matching_marker.get('Y', 0) * 500,
        "boundingBoxY2": matching_marker.get('Y', 0) * 500 + matching_marker.get('H', 0) * 500,
    }

    # Calculate age
    age_years = None
    age_months = None
    if photo_date and person.birth_date:
        delta = photo_date - person.birth_date
        age_years = delta.days / 365.25
        age_months = int(delta.days / 30.44)

    # Create Photo object
    photo = Photo(
        person=person,
        photo_date=photo_date,
        source='photoprism',
        source_id=file_hash,
        person_face_box=person_face_box,
        metadata={
            'photoprism_photo': photo_data,
            'photoprism_file': file_data,
        },
        age_at_photo_years=age_years,
        age_at_photo_months=age_months,
    )

    # Save the image file
    filename = f"{file_hash}.jpg"
    photo.file_path.save(filename, ContentFile(photo_content), save=False)
    photo.save()
    
    logger.info(f"Imported photo {file_hash} for {person.name}")
    return True