# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.2.3
FROM ruby:${RUBY_VERSION}-bookworm AS base
WORKDIR /rails

# Install base packages + Chrome + Chromedriver
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl \
    libjemalloc2 \
    libvips \
    postgresql-client \
    ca-certificates \
    openssl \
    gnupg \
    dirmngr \
    wget \
    fonts-ipafont-gothic \
    fonts-ipafont-mincho \
    # 以下「公式Google Chrome」を追加
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update -qq \
    && apt-get install --no-install-recommends -y google-chrome-stable \
    && apt-get install --no-install-recommends -y chromium-driver \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV RAILS_ENV="production" \
    NODE_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development test" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"\
    RAILS_SERVE_STATIC_FILES="true"

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
RUN chown -R 1000:1000 /rails/node_modules
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' && bundle install

# Copy application code and precompile assets
COPY . .
RUN rm -rf tmp/cache && SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

FROM base

# Install Node.js (for Yarn)
ARG NODE_VERSION=20.18.0
RUN curl -sL https://github.com/nodenv/node-build/archive/master.tar.gz | tar xz -C /tmp/ && \
    /tmp/node-build-master/bin/node-build "${NODE_VERSION}" /usr/local/node && \
    rm -rf /tmp/node-build-master

ENV PATH="/usr/local/node/bin:$PATH"

# Install Yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update -qq && apt-get install --no-install-recommends -y yarn && \
    rm -rf /var/lib/apt/lists/*

RUN yarn global add esbuild

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

# ── 追加: mkcert rootCAをシステムのCAストアに追加 ──
COPY docker/certs/rootCA.pem /usr/local/share/ca-certificates/rootCA.crt
RUN update-ca-certificates

# Verify
RUN ls -l /etc/ssl/certs/ && ls -l /etc/ssl/private/

# Setup non-root user
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails /usr/local/bundle db log storage tmp

USER 1000:1000
ENTRYPOINT ["/rails/bin/docker-entrypoint"]
EXPOSE 3002
CMD ["bash", "-c", "bundle exec rails db:prepare && ./bin/rails server -b 'ssl://0.0.0.0:3002?key=/etc/ssl/private/moriappli-emotion.com-key.pem&cert=/etc/ssl/certs/moriappli-emotion.com.pem'"]
