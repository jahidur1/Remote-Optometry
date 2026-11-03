# Use official Python 3.12 slim image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for OR-Tools and production
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port FastAPI will run on
EXPOSE 8080

# Command to run the application using Uvicorn
# Cloud Run expects the service to listen on 0.0.0.0:$PORT (default 8080)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
