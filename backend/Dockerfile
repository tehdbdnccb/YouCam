# backend/Dockerfile
FROM python:3.11-slim-bookworm

WORKDIR /app

# Enforce deterministic runtime invariants and read-only mount compatibility
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/tmp

# Install minimal C shared libraries required by Pillow and NumPy, then purge apt caches
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        libwebp7 \
        zlib1g && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --gid 10001 aurafit && \
    useradd --uid 10001 --gid 10001 --shell /sbin/nologin --no-create-home aurafit

# Isolate dependency installation layer for O(1) Docker rebuild caching
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy application source with strict ownership
COPY --chown=aurafit:aurafit . .

# Drop root privileges prior to exposing network sockets
USER 10001:10001

EXPOSE 8000

# Execute Uvicorn with bounded concurrency and Slowloris keep-alive protection
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--limit-concurrency", "64", "--timeout-keep-alive", "5"]