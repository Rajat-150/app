FROM python:3.11-slim

WORKDIR /app

# System deps for Playwright + ffmpeg (Remotion) — optional but recommended
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg build-essential \
    libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Node.js (needed to run `npx remotion render`)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# emergentintegrations is an Emergent-internal package not on public PyPI — strip it before install
RUN grep -v -i "emergentintegrations" requirements.txt > /tmp/reqs.txt && \
    pip install --no-cache-dir -r /tmp/reqs.txt httpx playwright && \
    (playwright install chromium --with-deps || true)

COPY . .

EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
