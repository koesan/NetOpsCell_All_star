FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# En az yetki ilkesi: konteyner root olarak calismaz.
RUN groupadd --gid 1000 appuser && useradd --uid 1000 --gid appuser --shell /bin/sh --create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
