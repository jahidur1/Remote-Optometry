# Use Python 3.12 slim image as the base
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Install system dependencies required by Google OR-Tools (C++ binaries)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Expose the port Cloud Run expects
EXPOSE 8080

# Command to run the application
# Cloud Run sets the PORT environment variable to 8080
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
    