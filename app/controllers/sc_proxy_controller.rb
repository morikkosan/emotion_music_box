# app/controllers/sc_proxy_controller.rb
class ScProxyController < ApplicationController
  include ActionController::MimeResponds
  skip_before_action :verify_authenticity_token

  # ===== ホスト許可：末尾一致で判定（短縮・CDN含む） =====
  SC_HOST_SUFFIXES = %w[
    soundcloud.com
    snd.sc
    soundcloud.app.goo.gl
    sndcdn.com
    soundcloud.cloud
  ].freeze

  private

  def allowed_sc_host?(host)
    h = host.to_s.downcase
    return false if h.blank?
    SC_HOST_SUFFIXES.any? { |suf| h == suf || h.end_with?(".#{suf}") }
  end

  # "undefined" や "null"（文字列）を弾くサニタイズ
  def sanitize_oauth_token(raw)
    t = raw.to_s.strip
    return "" if t.blank?
    return "" if %w[undefined null].include?(t.downcase)
    t
  end

  # Net::HTTP GET（最大5回までリダイレクト追従）
  def http_get_follow(uri, headers: {}, limit: 5)
    raise "too many redirects" if limit <= 0
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = 5
    http.read_timeout = 15

    req = Net::HTTP::Get.new(uri.request_uri)
    headers.each { |k, v| req[k] = v }
    res = http.request(req)

    case res
    when Net::HTTPRedirection
      loc = res["location"]
      raise "redirect without location" if loc.blank?
      new_uri = URI.parse(loc)
      new_uri = uri + new_uri if new_uri.relative?
      http_get_follow(new_uri, headers: headers, limit: limit - 1)
    else
      res
    end
  end

  public

  # GET /sc/resolve?url=...
  def resolve
    play_url = params[:url].to_s
    return render json: { error: "missing url" }, status: 400 if play_url.blank?

    # ✅ SSRF防止
    begin
      u = URI.parse(play_url)
      return render json: { error: "invalid scheme" }, status: 400 unless %w[http https].include?(u.scheme)
      return render json: { error: "forbidden host", host: u.host }, status: 400 unless allowed_sc_host?(u.host)
    rescue URI::InvalidURIError
      return render json: { error: "invalid url" }, status: 400
    end

    cid   = ENV["SOUNDCLOUD_CLIENT_ID"].to_s.presence ||
            (Rails.application.credentials.dig(:soundcloud, :client_id) rescue nil).to_s
    token = sanitize_oauth_token(request.headers["HTTP_X_SC_OAUTH"] || request.headers["X-SC-OAUTH"])

    # ========= トークンの有無で分岐 =========
    if token.present?
      # ---- v1 /resolve → 302 Location（tracks/...）→ トラックJSON取得 ----
      begin
        # 1) v1 resolve（302 期待）
        v1_resolve = URI.parse("https://api.soundcloud.com/resolve?#{Rack::Utils.build_query(url: play_url)}")
        http1 = Net::HTTP.new(v1_resolve.host, v1_resolve.port)
        http1.use_ssl = true
        http1.open_timeout = 3
        http1.read_timeout = 8

        req1 = Net::HTTP::Get.new(v1_resolve.request_uri)
        req1["Accept"]          = "application/json"
        req1["Accept-Encoding"] = "identity"
        req1["User-Agent"]      = "emomu-proxy/1.3"
        req1["Authorization"]   = "OAuth #{token}"

        res1 = http1.request(req1)
        loc  = res1["location"].to_s

        unless res1.code.to_i == 302 && loc.present?
          return render json: { error: "upstream_error", stage: "v1_resolve", status: res1.code.to_i, body: res1.body.to_s }, status: 502
        end

        # 2) 302 先（tracks/...）でトラックJSON取得
        track_uri = URI.parse(loc)
        http2 = Net::HTTP.new(track_uri.host, track_uri.port)
        http2.use_ssl = true
        http2.open_timeout = 3
        http2.read_timeout = 8

        req2 = Net::HTTP::Get.new(track_uri.request_uri)
        req2["Accept"]          = "application/json"
        req2["Accept-Encoding"] = "identity"
        req2["User-Agent"]      = "emomu-proxy/1.3"
        req2["Authorization"]   = "OAuth #{token}"

        res2 = http2.request(req2)
        return render json: { error: "upstream_error", stage: "v1_track", status: res2.code.to_i, body: res2.body.to_s }, status: 502 unless res2.code.to_i.between?(200,299)

        track = JSON.parse(res2.body) rescue nil
        return render json: { error: "parse_error" }, status: 502 unless track.is_a?(Hash)

        # 3) v2風の media.transcodings を合成（progressive 1本だけでOK）
        stream_locator = "#{track_uri}/stream" # https://api.soundcloud.com/tracks/.../stream
        v2ish = {
          "kind"  => "track",
          "id"    => track["id"],
          "title" => track["title"],
          "user"  => { "username" => track.dig("user","username") },
          "media" => {
            "transcodings" => [
              {
                "url" => stream_locator,
                "preset" => "mp3_128",
                "duration" => track["duration"],
                "snipped" => false,
                "format" => { "protocol" => "progressive", "mime_type" => "audio/mpeg" }
              }
            ]
          }
        }

        return render json: v2ish, status: 200
      rescue => e
        Rails.logger.warn("[sc_proxy#resolve v1] #{e.class}: #{e.message}")
        return render json: { error: "proxy_error", message: e.message }, status: 502
      end
    end

    # ---- ここからは従来の匿名（client_id）経路：v2 ----
    begin
      u = URI.parse("https://api-v2.soundcloud.com/resolve")
      q = { url: play_url }
      q[:client_id] = cid if cid.present?
      u.query = Rack::Utils.build_query(q)

      res = http_get_follow(u, headers: {
        "Accept"          => "application/json",
        "Accept-Encoding" => "identity",
        "User-Agent"      => "emomu-proxy/1.3"
      })

      code  = res.code.to_i
      ctype = res["content-type"].presence || "application/json"

      if code.between?(200, 299)
        render plain: res.body, status: code, content_type: ctype
      else
        render json: {
          error:  "upstream_error",
          status: code,
          rate:   { limit: res["x-ratelimit-limit"], remaining: res["x-ratelimit-remaining"], reset: res["x-ratelimit-reset"] },
          body:   res.body.to_s
        }, status: 502
      end
    rescue => e
      Rails.logger.warn("[sc_proxy#resolve v2] #{e.class}: #{e.message}")
      render json: { error: "proxy_error", message: e.message }, status: 502
    end
  end

  # GET /sc/stream?locator=...
  def stream
    locator = params[:locator].to_s
    return render json: { error: "missing locator" }, status: 400 if locator.blank?

    token = sanitize_oauth_token(request.headers["HTTP_X_SC_OAUTH"] || request.headers["X-SC-OAUTH"])
    cid   = ENV["SOUNDCLOUD_CLIENT_ID"].to_s.presence ||
            (Rails.application.credentials.dig(:soundcloud, :client_id) rescue nil).to_s

    # ✅ SSRF防止
    begin
      uri = URI.parse(locator)
      return render json: { error: "invalid scheme" }, status: 400 unless %w[http https].include?(uri.scheme)
      return render json: { error: "forbidden host", host: uri.host }, status: 400 unless allowed_sc_host?(uri.host)
    rescue URI::InvalidURIError
      return render json: { error: "invalid locator" }, status: 400
    end

    # ✅ トークンがある時は client_id を絶対に付けない
    q = Rack::Utils.parse_nested_query(uri.query || "")
    if token.present?
      q.delete("client_id")
    else
      q["client_id"] ||= cid if cid.present?
    end
    uri.query = Rack::Utils.build_query(q)

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = 3
    http.read_timeout = 8

    req = Net::HTTP::Get.new(uri.request_uri)
    req["Accept"]           = "application/json"
    req["Accept-Encoding"]  = "identity"
    req["User-Agent"]       = "emomu-proxy/1.3"
    req["Authorization"]    = "OAuth #{token}" if token.present?

    res = http.request(req)
    code  = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    # ✅ v1 /tracks/:id/stream は 302 Location を返す仕様 → 200 で {url: ...} に変換
    if code == 302 && res["location"].present?
      return render json: { url: res["location"] }, status: 200
    end

    if code.between?(200, 299)
      render plain: res.body, status: code, content_type: ctype
    else
      render json: {
        error:  "upstream_error",
        status: code,
        rate:   {
          limit:     res["x-ratelimit-limit"],
          remaining: res["x-ratelimit-remaining"],
          reset:     res["x-ratelimit-reset"]
        },
        body:   res.body.to_s
      }, status: 502
    end
  rescue => e
    Rails.logger.warn("[sc_proxy#stream] #{e.class}: #{e.message}")
    render json: { error: "proxy_error", message: e.message }, status: 502
  end
end
