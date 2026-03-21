FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ./app ./app

# Copy scripts for admin user creation and database setup
COPY ./scripts ./scripts

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8000

# Run application with gunicorn for production (4 workers with uvicorn worker class)
# For development, override with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
CMD ["gunicorn", "app.main:app", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
