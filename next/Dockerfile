FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV HOST=0.0.0.0
EXPOSE 8088
VOLUME ["/app/data"]
CMD ["node","server/index.js"]
