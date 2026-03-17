FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend /app/backend
COPY prompts /app/prompts
COPY prompts.json /app/prompts.json

ENV PYTHONPATH=/app
ENV OLLAMA_BASE_URL=http://host.docker.internal:11434

EXPOSE 8001
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
