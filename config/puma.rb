# config/puma.rb

# ① 同時スレッド数（「1店員あたりの席数」）: まずは5でOK
max_threads = ENV.fetch("RAILS_MAX_THREADS", 5).to_i
threads max_threads, max_threads

# ② ワーカー数（「店員の人数」）: まずは2でOK（Renderの環境変数で変えられる）
workers ENV.fetch("WEB_CONCURRENCY", 2).to_i

# ③ アプリをプリロード & ワーカー起動後にDB再接続（Neon Poolerと相性◎）
preload_app!
on_worker_boot do
  ActiveRecord::Base.establish_connection
end

# ✅ 環境変数でSSLバインドの有無を切り替え（あなたの設定をそのまま利用）
if ENV["SSL_BIND"] == "true"
  puts "🔒 SSLバインドを有効にしています"
  ssl_bind "0.0.0.0", "3002", {
    key: "/etc/ssl/private/moriappli-emotion.com-key.pem",
    cert: "/etc/ssl/certs/moriappli-emotion.com.pem"
  }
  port 3002  # 明示しておく
else
  puts "🌐 通常のHTTPポートで起動（SSLバインドなし）"
  port ENV.fetch("PORT") { 3000 }
end

plugin :tmp_restart
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
