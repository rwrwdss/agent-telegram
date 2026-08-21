FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY packages/shared /app/packages/shared
COPY apps/api /app/apps/api

RUN pip install --no-cache-dir -e /app/packages/shared && pip install --no-cache-dir -r /app/apps/api/requirements.txt

ENV PYTHONPATH=/app/apps/api:/app/packages/shared
WORKDIR /app/apps/api

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
