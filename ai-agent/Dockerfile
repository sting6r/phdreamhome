FROM python:3.11-slim

WORKDIR /app

# Copy requirements from the current directory (ai-agent/)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all files from the current directory to /app
COPY . .

# Note: If you need to serve the 'public' folder from the root, 
# you should handle that in the Railway build context or copy it separately.
# For now, we'll assume the AI Agent only needs its own files.

EXPOSE 8000

CMD ["python", "agent_api.py"]
