# Placeholder זמני - צוות 4 יחליף בקוד מ-Google AI Studio.
# קוד מ-AI Studio הוא בדרך כלל React + Vite. Dockerfile מתאים:
#
#   FROM node:20-alpine
#   WORKDIR /app
#   COPY package*.json ./
#   RUN npm install
#   COPY . .
#   EXPOSE 3000
#   CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM nginx:alpine
COPY index.html /usr/share/nginx/html/index.html
RUN sed -i 's/listen       80;/listen       3000;/' /etc/nginx/conf.d/default.conf
EXPOSE 3000
