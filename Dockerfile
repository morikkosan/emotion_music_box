# syntax = docker/dockerfile:1

# Base image setup
ARG RUBY_VERSION=3.2.3
FROM docker.io/library/ruby:$RUBY_VERSION-slim AS base

WORKDIR /rails

# Install base packages
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libjemalloc2 libvips postgresql-client ca-certificates && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Set development environment (SSL対応)
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development test"

# Start build stage
FROM base AS build

# Install packages for gem and node dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libpq-dev node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install JavaScript dependencies
ARG NODE_VERSION=20.18.0
ARG YARN_VERSION=1.22.22
ENV PATH=/usr/local/node/bin:$PATH
RUN curl -sL https://github.com/nodenv/node-build/archive/master.tar.gz | tar xz -C /tmp/ && \
    /tmp/node-build-master/bin/node-build "${NODE_VERSION}" /usr/local/node && \
    npm install -g yarn@$YARN_VERSION && \
    rm -rf /tmp/node-build-master

# Install required JavaScript tools globally (using yarn)
RUN yarn global add esbuild nodemon

# Add local node_modules/.bin to PATH for yarn executables
ENV PATH="/rails/node_modules/.bin:$PATH"

# Copy package.json and yarn.lock to install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Install application gems
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

# 他のファイルをコピー
COPY . .

# Precompile assets for production
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

# Final stage for app image
FROM base

# Copy built artifacts: gems, application
COPY --from=build "${BUNDLE_PATH}" "${BUNDLE_PATH}"
COPY --from=build /rails /rails

# SSL証明書のディレクトリを作成し、証明書をコピー（最終ステージのみ）
RUN mkdir -p /etc/ssl/certs /etc/ssl/private
COPY docker/certs/moriappli-emotion.com.pem /etc/ssl/certs/
COPY docker/certs/moriappli-emotion.com-key.pem /etc/ssl/private/

# ➡ root のまま、コピー確認
RUN ls -l /etc/ssl/private/ && ls -l /etc/ssl/certs/

# Run and own only the runtime files as a non-root user
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails /usr/local/bundle db log storage tmp

USER 1000:1000

# Entrypoint prepares the database.
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

# Expose default Rails port (HTTPS対応)
EXPOSE 3002

# HTTPS で Rails サーバーを起動
CMD ["bash", "-c", "bundle exec rails db:prepare && ./bin/rails server -b 'ssl://0.0.0.0:3002?key=/etc/ssl/private/moriappli-emotion.com-key.pem&cert=/etc/ssl/certs/moriappli-emotion.com.pem'"]
