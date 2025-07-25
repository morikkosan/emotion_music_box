# This file is copied to spec/ when you run 'rails generate rspec:install'

require 'spec_helper'
require 'rails-controller-testing'

ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort("The Rails environment is running in production mode!") if Rails.env.production?

# ✅ カバレッジ計測（コードの網羅率を計測）
require 'simplecov'
SimpleCov.start 'rails'

# ✅ shoulda-matchers
require 'shoulda/matchers'
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end

require 'rspec/rails'

# ✅ 外部APIをテストで呼ばないようにスタブ化
require 'webmock/rspec'
WebMock.disable_net_connect!(allow_localhost: true)

# ✅ `spec/support/` を読み込む
Rails.root.glob('spec/support/**/*.rb').sort_by(&:to_s).each { |f| require f }

# ✅ 明示的にデフォルトURLホストを設定
Rails.application.routes.default_url_options[:host] = 'www.example.com'

# ✅ DBマイグレーションチェック
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods
  config.include Devise::Test::IntegrationHelpers, type: :request
  config.include Devise::Test::ControllerHelpers, type: :controller

  # ✅ リクエストスペック用
  config.before(:each, type: :request) do
    host! "www.example.com"
    allow_any_instance_of(ActionController::Base)
      .to receive(:protect_against_forgery?).and_return(false)
  end

  # ✅ コントローラスペック用
  config.before(:each, type: :controller) do
    request.host = "www.example.com"
  end

  config.use_transactional_fixtures = true
  config.filter_rails_from_backtrace!
end
