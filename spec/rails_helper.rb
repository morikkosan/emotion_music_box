# This file is copied to spec/ when you run 'rails generate rspec:install'

# ✅ SimpleCov は一番最初に
require 'simplecov'
SimpleCov.start 'rails'

# ✅ RSpec 基本
require 'spec_helper'

# ✅ テスト用ENVは environment 読み込み「より前」に用意
ENV['RAILS_ENV'] ||= 'test'
ENV['DISABLE_SPRING'] ||= '1' # テストではSpring無効化（Springエラー回避）

ENV['RESEND_FROM']      ||= 'no-reply@example.test'
ENV['CONTACT_TO']       ||= 'admin@example.test'
ENV['RESEND_REPLY_TO']  ||= 'support@example.test'

# ✅ Rails本体の読み込みは1回だけ（重複禁止）
require File.expand_path('../config/environment', __dir__)

# ✅ 安全装置
abort("The Rails environment is running in production mode!") if Rails.env.production?

# ✅ Rails系のRSpecヘルパ
require 'rspec/rails'
require 'rails-controller-testing'

# ✅ shoulda-matchers
require 'shoulda/matchers'
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end

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
