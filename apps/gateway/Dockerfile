FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY packages/shared /app/packages/shared
COPY apps/api /app/apps/api
COPY apps/gateway /app/apps/gateway

RUN pip install --no-cache-dir -e /app/packages/shared && pip install --no-cache-dir -r /app/apps/api/requirements.txt

ENV PYTHONPATH=/app/apps/api:/app/apps/gateway:/app/packages/shared
WORKDIR /app/apps/gateway

CMD ["python", "main.py"]
