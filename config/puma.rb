# config/puma.rb

max_threads = ENV.fetch("RAILS_MAX_THREADS", 5).to_i
threads max_threads, max_threads
workers ENV.fetch("WEB_CONCURRENCY", 2).to_i

preload_app!
on_worker_boot do
  ActiveRecord::Base.establish_connection
end

# 共通のホスト/ポートを環境変数で切り替え可能に
http_host = ENV.fetch("BIND", "0.0.0.0")
http_port = ENV.fetch("PORT", 3000).to_i

if ENV["SSL_BIND"] == "true"
  puts "🔒 SSLバインドを有効にしています"
  ssl_bind "0.0.0.0", "3002", {
    key: "/etc/ssl/private/moriappli-emotion.com-key.pem",
    cert: "/etc/ssl/certs/moriappli-emotion.com.pem"
  }
  # 明示しておく（任意）
  # port 3002
else
  puts "🌐 通常HTTPで起動: #{http_host}:#{http_port}"
  # ✅ ここがポイント: port ではなく bind を使って 0.0.0.0 にバインド
  bind "tcp://#{http_host}:#{http_port}"
end

plugin :tmp_restart
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
