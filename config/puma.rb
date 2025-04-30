# config/puma.rb

# Renderでは PORT 環境変数をそのまま使う（SSLバインドはしない）
port ENV.fetch("PORT") { 3000 }

threads_count = ENV.fetch("RAILS_MAX_THREADS", 3).to_i
threads threads_count, threads_count

plugin :tmp_restart
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]

# ✅ ローカル開発時だけSSL使いたいならこう書く（Render上では false になるように）
if ENV["USE_LOCAL_SSL"] == "true"
  ssl_bind '0.0.0.0', '3002', {
    key:  "config/ssl/moriappli-emotion.com-key.pem",
    cert: "config/ssl/moriappli-emotion.com.pem"
  }
end
