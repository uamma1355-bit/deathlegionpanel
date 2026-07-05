# Frontend Dockerfile — used for non-Vercel deployments (e.g. self-hosted CDN).
# For Vercel deployments, use the vercel.json in the repo root instead.

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install deps with cache
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source + shared types
COPY shared /shared
COPY frontend .

# Build
RUN npm run build

# Runtime stage — nginx serving static files
FROM nginx:1.27-alpine AS runtime
RUN rm /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
