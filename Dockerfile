FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
