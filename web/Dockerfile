# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public API base URL is baked in at build time (no secrets here, ever).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL VITE_USE_MOCK=false
RUN npm run build

# Runtime stage: static files behind nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/healthz || exit 1
