FROM python:3.12-slim
WORKDIR /app
COPY backend-courses/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend-courses/ .
COPY backend-core/auth_middleware.py /backend-core/auth_middleware.py
COPY backend-core/rbac.py /backend-core/rbac.py
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
