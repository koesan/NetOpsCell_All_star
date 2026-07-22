FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .

# Faz 3: anahtarlar artik imaja gomulmuyor - Docker Compose secret olarak calisma
# zamaninda /run/secrets/ altina salt-okunur mount edilir (bkz. .dockerignore, docker-compose.yml).

USER node

EXPOSE 8080
CMD ["node", "src/index.js"]
