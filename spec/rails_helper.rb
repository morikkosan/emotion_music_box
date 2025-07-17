# This file is copied to spec/ when you run 'rails generate rspec:install'



require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

# Prevent database truncation if the environment is production
# 本番環境でテストが実行されないようにする安全装置
abort("The Rails environment is running in production mode!") if Rails.env.production?

# ✅ カバレッジ計測（コードの網羅率を計測）
require 'simplecov'
SimpleCov.start 'rails'

# Require the Rails testing framework
require 'rspec/rails'

# ✅ 外部APIをテストで呼ばないようにスタブ化（WebMock使用）
require 'webmock/rspec'
WebMock.disable_net_connect!(allow_localhost: true)

# Add additional requires below this line. Rails is not loaded until this point!
# （ここより下に追加のrequireを書くとRails起動後に読み込まれる）

# Requires supporting ruby files with custom matchers and macros, etc, in
# spec/support/ and its subdirectories. Files matching `spec/**/*_spec.rb` are
# run as spec files by default. This means that files in spec/support that end
# in _spec.rb will both be required and run as specs, causing the specs to be
# run twice. It is recommended that you do not name files matching this glob to
# end with _spec.rb. You can configure this pattern with the --pattern
# option on the command line or in ~/.rspec, .rspec or `.rspec-local`.
#
# サポート系ファイルの自動読み込み
# `spec/support/`配下にあるファイルを全て読み込む（共通設定・ヘルパーなど）
Rails.root.glob('spec/support/**/*.rb').sort_by(&:to_s).each { |f| require f }

Rails.application.routes.default_url_options[:host] = 'localhost'

# Ensures that the test database schema matches the current schema file.
# If there are pending migrations it will invoke `db:test:prepare` to
# recreate the test database by loading the schema.
# If you are not using ActiveRecord, you can remove these lines.
#
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

  config.use_transactional_fixtures = true
  config.filter_rails_from_backtrace!
  # Remove this line if you're not using ActiveRecord or ActiveRecord fixtures
  # config.fixture_path = Rails.root.join('spec/fixtures')

  # If you're not using ActiveRecord, or you'd prefer not to run each of your
  # examples within a transaction, remove the following line or assign false
  # instead of true.
  #
  # データベースをテストごとにロールバックしてクリーンに保つ
  config.use_transactional_fixtures = true

  # You can uncomment this line to turn off ActiveRecord support entirely.
  # config.use_active_record = false

  # RSpec Rails uses metadata to mix in different behaviours to your tests,
  # for example enabling you to call `get` and `post` in request specs. e.g.:
  #
  #     RSpec.describe UsersController, type: :request do
  #       # ...
  #     end
  #
  # The different available types are documented in the features, such as in
  # https://rspec.info/features/8-0/rspec-rails
  #
  # You can also infer these behaviours automatically by location, e.g.
  # /spec/models would pull in the same behaviour as `type: :model` but this
  # behaviour is considered legacy and will be removed in a future version.
  #
  # テストのファイル場所から自動で `type: :model` などを推測
  # config.infer_spec_type_from_file_location!

  # Filter lines from Rails gems in backtraces.
  # バックトレースからRails内部の行を省略して見やすくする
  config.filter_rails_from_backtrace!

  # arbitrary gems may also be filtered via:
  # config.filter_gems_from_backtrace("gem name")

  
end

