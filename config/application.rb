require_relative "boot"

require "rails/all"

Bundler.require(*Rails.groups)

module Myapp
  class Application < Rails::Application
    config.action_view.form_with_generates_remote_forms = false

    config.load_defaults 7.2
    config.api_only = false  # APIモードを無効にする
    config.assets.paths << Rails.root.join("app", "assets", "builds")
    config.i18n.load_path += Dir[Rails.root.join('config', 'locales', '**', '*.{rb,yml}')]
    config.autoload_paths += Dir[Rails.root.join('app', 'strategies', '**', '*.rb')]
config.eager_load_paths += %W(#{config.root}/app/strategies/omniauth/strategies)


    

    # CookieStore を使ってセッションを保存する設定に変更
    config.action_dispatch.session_store :cookie_store, 
      key: '_myapp_session', 
      secure: true, 
      same_site: :lax, 
      domain: 'localhost', 
      path: '/'

    # SoundCloud の環境変数をロード
    config.before_configuration do
      require 'dotenv/load'
      ENV['SOUNDCLOUD_CLIENT_ID'] ||= Rails.application.credentials.dig(:soundcloud, :client_id)
    end
  end
end
