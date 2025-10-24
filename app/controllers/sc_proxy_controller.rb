# app/controllers/sc_proxy_controller.rb
class ScProxyController < ApplicationController
  include ActionController::MimeResponds
  skip_before_action :verify_authenticity_token

  def resolve
    play_url = params[:url].to_s
    return render json: { error: "missing url" }, status: 400 if play_url.blank?

    cid   = ENV["SOUNDCLOUD_CLIENT_ID"].to_s.presence ||
            (Rails.application.credentials.dig(:soundcloud, :client_id) rescue nil).to_s
    token = request.headers["HTTP_X_SC_OAUTH"].to_s.presence ||
            request.headers["X-SC-OAUTH"].to_s.presence

    upstream = URI.parse("https://api-v2.soundcloud.com/resolve")
    # ✅ OAuth があっても client_id を常に付ける（通る可能性を最大化）
    qp = { url: play_url }
    qp[:client_id] = cid if cid.present?

    http = Net::HTTP.new(upstream.host, upstream.port)
    http.use_ssl = true

    req = Net::HTTP::Get.new("#{upstream.path}?#{Rack::Utils.build_query(qp)}")
    req["Accept"]           = "application/json"
    req["Accept-Encoding"]  = "identity"           # ✅ 圧縮を避けて中身を見えるように
    req["User-Agent"]       = "emomu-proxy/1.1"
    req["Authorization"]    = "OAuth #{token}" if token.present?

    res = http.request(req)
    code = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    if code >= 200 && code < 300
      render plain: res.body, status: code, content_type: ctype
    else
      # ✅ 失敗時は “何が返ってきたか” を JSON で露出
      render json: { error: "upstream_error", status: code, body: res.body.to_s }, status: 502
    end
  rescue => e
    Rails.logger.warn("[sc_proxy#resolve] #{e.class}: #{e.message}")
    render json: { error: "proxy_error", message: e.message }, status: 502
  end

  def stream
    locator = params[:locator].to_s
    return render json: { error: "missing locator" }, status: 400 if locator.blank?

    token = request.headers["HTTP_X_SC_OAUTH"].to_s.presence ||
            request.headers["X-SC-OAUTH"].to_s.presence
    cid   = ENV["SOUNDCLOUD_CLIENT_ID"].to_s.presence ||
            (Rails.application.credentials.dig(:soundcloud, :client_id) rescue nil).to_s

    uri = URI.parse(locator)
    q   = Rack::Utils.parse_nested_query(uri.query || "")
    # ✅ locator に client_id が無ければ付与（“要らないケース”でも害はない）
    q["client_id"] ||= cid if cid.present?
    uri.query = Rack::Utils.build_query(q)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")

    req = Net::HTTP::Get.new(uri.request_uri)
    req["Accept"]           = "application/json"
    req["Accept-Encoding"]  = "identity"
    req["User-Agent"]       = "emomu-proxy/1.1"
    req["Authorization"]    = "OAuth #{token}" if token.present?

    res = http.request(req)
    code = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    if code >= 200 && code < 300
      render plain: res.body, status: code, content_type: ctype
    else
      render json: { error: "upstream_error", status: code, body: res.body.to_s }, status: 502
    end
  rescue => e
    Rails.logger.warn("[sc_proxy#stream] #{e.class}: #{e.message}")
    render json: { error: "proxy_error", message: e.message }, status: 502
  end
end
