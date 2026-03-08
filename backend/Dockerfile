FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npm run db:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
RUN npm run db:generate
RUN mkdir -p uploads
EXPOSE 3001
CMD ["node", "dist/index.js"]
