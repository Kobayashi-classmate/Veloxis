FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
# Explicitly install typescript globally in builder
RUN npm install && npm install -g typescript

COPY tsconfig.json ./
COPY src ./src
RUN tsc

FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
