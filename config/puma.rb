# config/puma.rb

threads_count = ENV.fetch("RAILS_MAX_THREADS", 3)
threads threads_count, threads_count

# ✅ 環境変数でSSLバインドの有無を切り替え
if ENV["SSL_BIND"] == "true"
  puts "🔒 SSLバインドを有効にしています"
  ssl_bind '0.0.0.0', '3002', {
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
