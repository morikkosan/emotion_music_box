# Puma configuration for SSL and app server

ssl_bind '0.0.0.0', '3002', {
  key: "/etc/ssl/private/moriappli-emotion.com-key.pem",
  cert: "/etc/ssl/certs/moriappli-emotion.com.pem"
}

threads_count = ENV.fetch("RAILS_MAX_THREADS", 3)
threads threads_count, threads_count

port ENV.fetch("PORT", 3002) # 念のためportも明示しておく

plugin :tmp_restart

pidfile ENV["PIDFILE"] if ENV["PIDFILE"]
