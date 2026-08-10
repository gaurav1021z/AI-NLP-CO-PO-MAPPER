FROM python:3.10-slim

# System deps needed by opencv (used internally by easyocr) and Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first so Docker can cache this layer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Hugging Face Spaces expects the app to listen on port 7860
EXPOSE 7860

# Writable dirs some routes expect (uploads folder)
RUN mkdir -p /app/uploads

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
