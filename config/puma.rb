# config/puma.rb

# ポート番号（Renderでは ENV["PORT"] が使われる）
port ENV.fetch("PORT")

# SSLバインド（ローカルで SSL を使う場合）
if ENV["USE_LOCAL_SSL"] == "true"
  ssl_bind '0.0.0.0', '3002', {
    key:  "config/ssl/moriappli-emotion.com-key.pem",
    cert: "config/ssl/moriappli-emotion.com.pem"
  }
end

threads_count = ENV.fetch("RAILS_MAX_THREADS", 3).to_i
threads threads_count, threads_count

plugin :tmp_restart
pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
