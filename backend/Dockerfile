FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn aiosqlite

COPY . .

RUN mkdir -p uploads

EXPOSE 8000

# 数据库迁移 + Gunicorn 启动
CMD ["sh", "-c", "python -m alembic upgrade head && gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --timeout 120 --access-logfile - --error-logfile -"]
