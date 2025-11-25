FROM python:3.14-slim
WORKDIR /code
COPY requirements.txt /code/
RUN pip install --upgrade pip && pip install -r requirements.txt
COPY . /code
ENV PYTHONUNBUFFERED=1