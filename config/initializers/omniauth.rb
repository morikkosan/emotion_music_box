if Rails.env.test?
  # テスト用のダミーストラテジー定義（Gemなしで済ませる）
  module OmniAuth
    module Strategies
      class Soundcloud < OmniAuth::Strategies::OAuth2; end
    end
  end
  Rails.application.config.middleware.use OmniAuth::Builder do
    provider :soundcloud, ENV["SOUNDCLOUD_CLIENT_ID"], ENV["SOUNDCLOUD_SECRET"]
  end
end
