# Istanza WordPress di RIFERIMENTO per la parità visiva.
# Strumento di test: non fa parte del runtime del prodotto (DR-002).
FROM php:8.2-apache

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpng-dev libjpeg62-turbo-dev libfreetype6-dev \
        libzip-dev libonig-dev libicu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" mysqli gd zip exif intl mbstring opcache \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# Allineato al .user.ini del server di produzione.
RUN { \
        echo 'display_errors=Off'; \
        echo 'max_execution_time=120'; \
        echo 'max_input_time=60'; \
        echo 'memory_limit=256M'; \
        echo 'max_input_vars=1000'; \
        echo 'output_buffering=4096'; \
        echo 'post_max_size=100M'; \
        echo 'upload_max_filesize=100M'; \
        echo 'zlib.output_compression=Off'; \
        echo 'short_open_tag=Off'; \
    } > /usr/local/etc/php/conf.d/zz-production-parity.ini
