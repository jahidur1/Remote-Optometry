# Use Python 3.12 slim for a smaller, faster production image
FROM python:3.12-slim

# Institutional Security: Don't run as root
RUN groupadd -r solver && useradd -r -g solver solver

# Install system dependencies required for OR-Tools C++ binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin dependencies for reproducible builds
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Set environment variables for production
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose port for Cloud Run
EXPOSE 8080

# Switch to non-privileged user
USER solver

# Launch Uvicorn with optimized workers for Cloud Run (1 vCPU)
CMD exec uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 1 --log-level info
