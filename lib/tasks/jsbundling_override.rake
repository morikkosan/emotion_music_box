# lib/tasks/jsbundling_override.rake
# 本番環境の assets:precompile 中に、javascript:install で yarn install させないための上書き

if ENV["RAILS_ENV"] == "production"
  require "rake"

  namespace :javascript do
    # 既に定義されている javascript:install を消してから、空タスクで上書き
    if Rake::Task.task_defined?("javascript:install")
      Rake::Task["javascript:install"].clear
    end

    desc "Skip javascript:install in production (node_modules は事前に用意済み)"
    task :install do
      puts "[override] Skip javascript:install in production (yarn install は実行しない)"
    end
  end
end
