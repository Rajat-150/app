# Worker container — real Playwright automation for Google Flow + Grok,
# plus noVNC so you can see what's happening and log in once.
#
# Base image ships Playwright + all browser deps preinstalled.
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:99 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb x11vnc fluxbox \
      novnc websockify \
      supervisor \
      xdotool wmctrl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Google Chrome (real Chrome, not bundled Chromium — less bot-detectable)
RUN apt-get update && apt-get install -y wget gnupg \
    && wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

COPY . /app

# supervisord runs Xvfb + x11vnc + websockify(noVNC) + fluxbox WM + fastapi worker
COPY supervisord.conf /etc/supervisor/conf.d/worker.conf

EXPOSE 8002 6080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/worker.conf"]
