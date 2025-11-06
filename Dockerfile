# syntax=docker/dockerfile:1

ARG RUBY_VERSION=3.2.3
FROM ruby:${RUBY_VERSION}-bookworm AS base
WORKDIR /rails

# Base packages + Chrome + Chromedriver（現状維持）
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
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update -qq \
    && apt-get install --no-install-recommends -y google-chrome-stable \
    && apt-get install --no-install-recommends -y chromium-driver \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 共通ENV（本番向けに最適化されているが開発でも動く）
ENV RAILS_ENV="production" \
    NODE_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development test" \
    SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt" \
    RAILS_SERVE_STATIC_FILES="true"

# =========================
# Build ステージ
# =========================
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
      build-essential \
      git \
      libpq-dev \
      node-gyp \
      pkg-config \
      python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Node & Yarn（公式バイナリ）
ARG NODE_VERSION=20.18.0
ARG YARN_VERSION=1.22.22
RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) node_arch="linux-x64" ;; \
    arm64) node_arch="linux-arm64" ;; \
    *) echo "Unsupported arch: $arch" >&2; exit 1 ;; \
  esac; \
  url="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-${node_arch}.tar.xz"; \
  tmp="/tmp/node.tar.xz"; \
  for i in 1 2 3; do \
    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors "$url" -o "$tmp" && break; \
    echo "retry $i ..."; sleep 2; \
  done; \
  mkdir -p /usr/local/node; \
  tar -xJf "$tmp" -C /usr/local/node --strip-components=1; \
  rm -f "$tmp"; \
  ln -sf /usr/local/node/bin/node /usr/local/bin/node; \
  ln -sf /usr/local/node/bin/npm  /usr/local/bin/npm; \
  ln -sf /usr/local/node/bin/npx  /usr/local/bin/npx; \
  npm install -g "yarn@${YARN_VERSION}"; \
  ln -sf /usr/local/node/bin/yarn    /usr/local/bin/yarn; \
  ln -sf /usr/local/node/bin/yarnpkg /usr/local/bin/yarnpkg; \
  /usr/local/node/bin/yarn global add esbuild nodemon

ENV PATH="/usr/local/node/bin:/rails/node_modules/.bin:${PATH}"

# パッケージ
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false
RUN chown -R 1000:1000 /rails/node_modules

# Ruby gems
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local without 'development test' && bundle install

# アプリ全体
COPY . .

# ビルド順序：JS/CSS → precompile
RUN yarn run build:js && yarn run build:css
RUN rm -rf tmp/cache && SECRET_KEY_BASE=dummy ./bin/rails assets:precompile

# ★ 開発の即時反映のため node_modules は残す
# （本番運用的には削除でもよいが、開発利便性優先で keep）
# RUN rm -rf node_modules

# =========================
# Runtime ステージ
# =========================
FROM base

# build 成果物（アプリ & gems）
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

# ★ ランタイムにも Node/Yarn をコピー（開発で yarn build を動かせるように）
COPY --from=build /usr/local/node /usr/local/node
RUN ln -sf /usr/local/node/bin/node    /usr/local/bin/node && \
    ln -sf /usr/local/node/bin/npm     /usr/local/bin/npm && \
    ln -sf /usr/local/node/bin/npx     /usr/local/bin/npx && \
    ln -sf /usr/local/node/bin/yarn    /usr/local/bin/yarn && \
    ln -sf /usr/local/node/bin/yarnpkg /usr/local/bin/yarnpkg
ENV PATH="/usr/local/node/bin:${PATH}"

# ★ node_modules もランタイムへ
COPY --from=build /rails/node_modules /rails/node_modules

# （ローカル開発用）自己署名証明書を使う場合は保持
RUN mkdir -p /etc/ssl/certs /etc/ssl/private
COPY docker/certs/moriappli-emotion.com.pem     /etc/ssl/certs/
COPY docker/certs/moriappli-emotion.com-key.pem /etc/ssl/private/
RUN chmod 755 /etc/ssl/private \
 && chmod 644 /etc/ssl/certs/moriappli-emotion.com.pem \
 && chmod 600 /etc/ssl/private/moriappli-emotion.com-key.pem

# 権限
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails /usr/local/bundle db log storage tmp config

USER 1000:1000

# ★ ここがポイント：USE_SSL=1 なら HTTPS(443)、それ以外は HTTP($PORT)
#   - ローカル docker-compose では USE_SSL=1 を渡す → 443 で自己署名HTTPS
#   - Render では USE_SSL=0 を渡す → $PORT で HTTP（TLSはRender側で終端）
ENTRYPOINT ["/rails/bin/docker-entrypoint"]
EXPOSE 443
EXPOSE 3000
CMD ["bash", "-lc", "bundle exec rails db:prepare && if [ \"${USE_SSL:-1}\" = \"1\" ]; then ./bin/rails server -b 'ssl://0.0.0.0:443?key=/etc/ssl/private/moriappli-emotion.com-key.pem&cert=/etc/ssl/certs/moriappli-emotion.com.pem'; else ./bin/rails server -b 0.0.0.0 -p ${PORT:-3000}; fi"]
