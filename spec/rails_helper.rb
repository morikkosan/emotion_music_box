# This file is copied to spec/ when you run 'rails generate rspec:install'

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

# 本番環境でテストが実行されないようにする安全装置
abort("The Rails environment is running in production mode!") if Rails.env.production?

# ✅ カバレッジ計測（コードの網羅率を計測）
require 'simplecov'
SimpleCov.start 'rails'

# ✅ shoulda-matchers（ここが重要！）
require 'shoulda/matchers'

# ✅ RSpecとRailsの統合設定
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end

# Require the Rails testing framework
require 'rspec/rails'

# ✅ 外部APIをテストで呼ばないようにスタブ化（WebMock使用）
require 'webmock/rspec'
WebMock.disable_net_connect!(allow_localhost: true)

# `spec/support/`配下にあるファイルを全て読み込む
Rails.root.glob('spec/support/**/*.rb').sort_by(&:to_s).each { |f| require f }

Rails.application.routes.default_url_options[:host] = 'localhost'

# テスト前にDBのスキーマが最新か確認（マイグレーション漏れ対策）
begin
  ActiveRecord::Migration.maintain_test_schema!
rescue ActiveRecord::PendingMigrationError => e
  abort e.to_s.strip
end

RSpec.configure do |config|
  config.include FactoryBot::Syntax::Methods

  config.before(:each, type: :request) do
    allow_any_instance_of(ActionController::Base)
      .to receive(:protect_against_forgery?).and_return(false)
  end

  # データベースをテストごとにロールバックしてクリーンに保つ
  config.use_transactional_fixtures = true

  # テストファイルの場所から自動で `type: :model` などを推測
  # config.infer_spec_type_from_file_location!

  # バックトレースからRails内部の行を省略して見やすくする
  config.filter_rails_from_backtrace!
end
