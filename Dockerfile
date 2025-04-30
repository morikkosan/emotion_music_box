# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.2.3
FROM ruby:$RUBY_VERSION-slim AS base

WORKDIR /rails

# Install base packages
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl \
    libjemalloc2 \
    libvips \
    postgresql-client \
    ca-certificates \
    openssl \
    gnupg \
    dirmngr && \
    update-ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV RAILS_ENV="production" \
    NODE_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development test" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"

FROM base AS build

# Install build tools & JS dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libpq-dev node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js and Yarn
ARG NODE_VERSION=20.18.0
ARG YARN_VERSION=1.22.22
ENV PATH=/usr/local/node/bin:$PATH
RUN curl -sL https://github.com/nodenv/node-build/archive/master.tar.gz | tar xz -C /tmp/ && \
    /tmp/node-build-master/bin/node-build "${NODE_VERSION}" /usr/local/node && \
    npm install -g yarn@$YARN_VERSION && \
    rm -rf /tmp/node-build-master && \
    yarn global add esbuild nodemon

ENV PATH="/rails/node_modules/.bin:$PATH"

# Install JS & Ruby dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' && bundle install

# Copy application code and precompile assets
COPY . .
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

FROM base

# Reinstall ca-certificates
RUN apt-get update -qq && apt-get install --no-install-recommends -y ca-certificates && update-ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy built artifacts
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

# Set up SSL certificates
RUN mkdir -p /etc/ssl/certs /etc/ssl/private
COPY docker/certs/moriappli-emotion.com.pem     /etc/ssl/certs/
COPY docker/certs/moriappli-emotion.com-key.pem /etc/ssl/private/

# ── 追加: SSL 証明書ディレクトリとファイル権限設定 ──
RUN chmod 755 /etc/ssl/private \
 && chmod 644 /etc/ssl/certs/moriappli-emotion.com.pem \
 && chmod 600 /etc/ssl/private/moriappli-emotion.com-key.pem
# ─────────────────────────────────────────────

# Verify
RUN ls -l /etc/ssl/certs/ && ls -l /etc/ssl/private/

# Setup non-root user
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails /usr/local/bundle db log storage tmp

USER 1000:1000
ENTRYPOINT ["/rails/bin/docker-entrypoint"]
EXPOSE 3002
CMD ["bash", "-c", "if [ ! -f tmp/migrated ]; then bundle exec rails db:prepare && touch tmp/migrated; fi && ./bin/rails server -b 'ssl://0.0.0.0:3002?key=/etc/ssl/private/moriappli-emotion.com-key.pem&cert=/etc/ssl/certs/moriappli-emotion.com.pem'"]

