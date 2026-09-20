FROM php:7.3-apache

# pdsinterop/php-solid-server (the exact version is pinned in setup.sh), with
# three changes from the upstream Dockerfile, each required by the benchmark:
#   - enable opcache, PHP's compiled-bytecode cache, so the server does not
#     recompile scripts on every request (zz-benchmark-tuning.ini activates it)
#   - record the host address in the self-signed certificate, so that a client on
#     another machine accepts the HTTPS connection
#   - optionally extend the login-token lifetime to 24 hours, for long unattended
#     runs (LONG_TOKEN=1)

COPY --from=composer:latest /usr/bin/composer /usr/local/bin/composer

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update && \
    apt-get install -y --no-install-recommends \
        git \
        libzip-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# A self-signed certificate is trusted only for the exact address it names. The
# benchmark connects by IP, so the host's IP is recorded in the certificate.
ARG HOST_IP=141.57.8.250
RUN mkdir /tls && openssl req -new -x509 -days 365 -nodes \
  -out /tls/server.cert \
  -keyout /tls/server.key \
  -subj "/C=NL/ST=Overijssel/L=Enschede/O=PDS Interop/OU=IT/CN=pdsinterop.org" \
  -addext "subjectAltName=IP:${HOST_IP}"

RUN docker-php-ext-install \
    opcache \
    bcmath \
    mbstring \
    mysqli \
    pdo \
    pdo_mysql \
    zip

RUN a2enmod headers rewrite ssl

COPY site.conf /etc/apache2/sites-enabled/site.conf

WORKDIR /app
EXPOSE 443

COPY . /app/

RUN composer install --no-dev --prefer-dist

# Optional: extend the login-token lifetime to 24 hours instead of the default
# one hour. This modifies a file within an installed dependency, so it must run
# after composer install has downloaded that dependency.
ARG LONG_TOKEN=0
RUN if [ "$LONG_TOKEN" = "1" ]; then \
      sed -i "s/Expiration(Time::HOURS_1,/Expiration('P1D',/" \
        vendor/pdsinterop/solid-auth/src/Factory/ConfigFactory.php; \
    fi

RUN chown -R www-data:www-data /app
