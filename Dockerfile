FROM node:26-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++ vips-dev && npm ci && npm rebuild

COPY . .
RUN npm run build


FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html


COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
