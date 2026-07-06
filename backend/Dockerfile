# Backend Dockerfile — Laravel 9 + PHP 8.2 FPM.
# Reference: docs/09-DeploymentGuide.md

# ---- Build stage: install composer deps ----
FROM composer:2.7 AS build
WORKDIR /app
COPY backend/composer.json backend/composer.lock* ./
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# ---- Runtime stage ----
FROM php:8.2-fpm-alpine AS runtime

# PHP extensions Pterodactyl requires
RUN apk add --no-cache \
        bash \
        curl \
        git \
        libpng-dev \
        libzip-dev \
        oniguruma-dev \
        libxml2-dev \
        bzip2-dev \
        icu-libs \
        icu-dev \
        freetype-dev \
        libjpeg-turbo-dev \
        libwebp-dev \
        mysql-client \
        redis \
        supervisor \
        nginx \
        $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mysqli \
        gd \
        mbstring \
        zip \
        bcmath \
        opcache \
        pcntl \
        intl \
        exif \
        sysvmsg \
        sysvsem \
        sysvshm \
    && pecl install redis && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS

# Configure PHP for production
RUN echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/pterodactyl.ini \
    && echo "upload_max_filesize = 100M" >> /usr/local/etc/php/conf.d/pterodactyl.ini \
    && echo "post_max_size = 100M" >> /usr/local/etc/php/conf.d/pterodactyl.ini \
    && echo "opcache.enable = 1" >> /usr/local/etc/php/conf.d/pterodactyl.ini \
    && echo "opcache.memory_consumption = 128" >> /usr/local/etc/php/conf.d/pterodactyl.ini \
    && echo "opcache.max_accelerated_files = 10000" >> /usr/local/etc/php/conf.d/pterodactyl.ini

WORKDIR /var/www/pterodactyl

# Copy application code
COPY backend/ /var/www/pterodactyl/

# Copy composer-installed vendor dir
COPY --from=build /app/vendor /var/www/pterodactyl/vendor

# Permissions
RUN chown -R www-data:www-data /var/www/pterodactyl \
    && chmod -R 755 /var/www/pterodactyl \
    && chmod -R 775 /var/www/pterodactyl/storage /var/www/pterodactyl/bootstrap/cache

# Entrypoint: runs migrations + caches config/routes then starts PHP-FPM
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN chmod +x /usr/local/bin/docker-entrypoint

EXPOSE 9000
ENTRYPOINT ["docker-entrypoint"]
CMD ["php-fpm"]
