# ROC Workforce Solver: Production Container Definition
# Optimized for Google Cloud Run and Google OR-Tools CP-SAT

FROM python:3.12-slim

# Install system dependencies required for OR-Tools C++ binaries
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin dependencies for institutional stability
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application logic
COPY . .

# Set environment variables for production
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Expose the standard Cloud Run port
EXPOSE 8080

# Launch Uvicorn on 0.0.0.0 for Cloud Run ingress
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
