FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Faz 3: anahtarlar artik imaja gomulmuyor - Docker Compose secret olarak calisma
# zamaninda /run/secrets/ altina salt-okunur mount edilir (bkz. docker-compose.yml).

USER node

EXPOSE 3002
CMD ["node", "dist/main.js"]
