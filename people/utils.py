from datetime import date

def calculate_age(birth_date, reference_date):
    if not birth_date or not reference_date:
        return None

    years = reference_date.year - birth_date.year
    months = reference_date.month - birth_date.month
    days = reference_date.day - birth_date.day

    if days < 0:
        months -= 1
    if months < 0:
        years -= 1
        months += 12

    return {"years": years, "months": months}


