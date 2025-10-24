# app/controllers/sc_proxy_controller.rb
class ScProxyController < ApplicationController
  include ActionController::MimeResponds
  skip_before_action :verify_authenticity_token

  # SoundCloudだけを許可（必要なら追加）
  SC_HOST_ALLOWLIST = %w[
    soundcloud.com www.soundcloud.com m.soundcloud.com
    api-v2.soundcloud.com api.soundcloud.com
    w.soundcloud.com cf-hls-media.sndcdn.com cf-media.sndcdn.com
  ].freeze

  def resolve
    play_url = params[:url].to_s
    return render json: { error: "missing url" }, status: 400 if play_url.blank?

    # ✅ SSRF防止: 入力URLのホストを許可リストでチェック
    begin
      u = URI.parse(play_url)
      return render json: { error: "invalid scheme" }, status: 400 unless %w[http https].include?(u.scheme)
      return render json: { error: "forbidden host" }, status: 400 unless SC_HOST_ALLOWLIST.include?(u.host)
    rescue URI::InvalidURIError
      return render json: { error: "invalid url" }, status: 400
    end

    cid   = ENV["SOUNDCLOUD_CLIENT_ID"].to_s.presence ||
            (Rails.application.credentials.dig(:soundcloud, :client_id) rescue nil).to_s
    token = request.headers["HTTP_X_SC_OAUTH"].to_s.presence ||
            request.headers["X-SC-OAUTH"].to_s.presence

    upstream = URI.parse("https://api-v2.soundcloud.com/resolve")
    qp = { url: play_url }
    qp[:client_id] = cid if cid.present?

    http = Net::HTTP.new(upstream.host, upstream.port)
    http.use_ssl = true
    http.open_timeout = 3    # ✅ 追記
    http.read_timeout = 8    # ✅ 追記

    req = Net::HTTP::Get.new("#{upstream.path}?#{Rack::Utils.build_query(qp)}")
    req["Accept"]           = "application/json"
    req["Accept-Encoding"]  = "identity"
    req["User-Agent"]       = "emomu-proxy/1.1"
    req["Authorization"]    = "OAuth #{token}" if token.present?

    res = http.request(req)
    code  = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    if code.between?(200, 299)
      # res.body は JSON 文字列。ここではそのまま生返しでOK
      render plain: res.body, status: code, content_type: ctype
    else
      render json: {
        error:  "upstream_error",
        status: code,
        # ✅ レート制限が分かると原因追跡しやすい
        rate:   {
          limit: res["x-ratelimit-limit"],
          remaining: res["x-ratelimit-remaining"],
          reset: res["x-ratelimit-reset"]
        },
        body:   res.body.to_s
      }, status: 502
    end
  rescue => e
    Rails.logger.warn("[sc_proxy#resolve] #{e.class}: #{e.message}") # ✅ トークンはログ出力しない
    render json: { error: "proxy_error", message: e.message }, status: 502
  end

  def stream
    locator = params[:locator].to_s
    return render json: { error: "missing locator" }, status: 400 if locator.blank?

    token = request.headers["HTTP_X_SC_OAUTH"].to_s.presence ||
            request.headers["X-SC-OAUTH"].to_s.presence
    cid   = ENV["SOUNDCLOUD_CLIENT_ID"].to_s.presence ||
            (Rails.application.credentials.dig(:soundcloud, :client_id) rescue nil).to_s

    # ✅ SSRF防止: locater のホストも許可制
    begin
      uri = URI.parse(locator)
      return render json: { error: "invalid scheme" }, status: 400 unless %w[http https].include?(uri.scheme)
      return render json: { error: "forbidden host" }, status: 400 unless SC_HOST_ALLOWLIST.include?(uri.host)
    rescue URI::InvalidURIError
      return render json: { error: "invalid locator" }, status: 400
    end

    q = Rack::Utils.parse_nested_query(uri.query || "")
    q["client_id"] ||= cid if cid.present?
    uri.query = Rack::Utils.build_query(q)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = 3   # ✅ 追記
    http.read_timeout = 8   # ✅ 追記

    req = Net::HTTP::Get.new(uri.request_uri)
    req["Accept"]           = "application/json"
    req["Accept-Encoding"]  = "identity"
    req["User-Agent"]       = "emomu-proxy/1.1"
    req["Authorization"]    = "OAuth #{token}" if token.present?

    res = http.request(req)
    code  = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    if code.between?(200, 299)
      render plain: res.body, status: code, content_type: ctype
    else
      render json: {
        error:  "upstream_error",
        status: code,
        rate:   {
          limit: res["x-ratelimit-limit"],
          remaining: res["x-ratelimit-remaining"],
          reset: res["x-ratelimit-reset"]
        },
        body:   res.body.to_s
      }, status: 502
    end
  rescue => e
    Rails.logger.warn("[sc_proxy#stream] #{e.class}: #{e.message}")
    render json: { error: "proxy_error", message: e.message }, status: 502
  end
end
