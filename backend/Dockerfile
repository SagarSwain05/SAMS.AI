FROM python:3.11-slim

# System deps for OpenCV + psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements_prod.txt .
RUN pip install --no-cache-dir -r requirements_prod.txt

# Copy application code
COPY . .

# Create directories that the app expects
RUN mkdir -p dataset models

# Hugging Face Spaces runs on port 7860
ENV PORT=7860
ENV FLASK_ENV=production

EXPOSE 7860

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", \
     "--bind", "0.0.0.0:7860", \
     "--timeout", "120", \
     "--log-level", "info", \
     "wsgi:app"]
