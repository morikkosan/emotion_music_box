# frozen_string_literal: true

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

  # 先頭の "OAuth " / "Bearer " を剥がして生トークンにする
  def strip_scheme_prefix(str)
    return "" if str.blank?
    str.to_s.strip.sub(/\A(?:OAuth|Bearer)\s+/i, "")
  end

  # Authorization ヘッダ値を正しく組み立てる
  # 入力が "OAuth xxx" / "Bearer xxx" / "xxx" のいずれでも OK
  def build_auth_header(raw)
    return nil if raw.blank?
    s = raw.to_s.strip
    return s if s =~ /\A(?:OAuth|Bearer)\s+/i
    "OAuth #{s}"
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

  # =========== トークン抽出（ヘッダ / Authorization / クエリ / Cookie） ===========
  def extract_oauth_token
    # 1) カスタムヘッダ
    h1 = request.get_header("HTTP_X_SC_OAUTH") || request.headers["X-SC-OAUTH"]

    # 2) Authorization: OAuth xxx / Bearer xxx
    auth = request.get_header("HTTP_AUTHORIZATION") || request.authorization
    h2 = strip_scheme_prefix(auth) if auth.present? && auth =~ /\A(?:OAuth|Bearer)\s+/i

    # 3) クエリ (?oauth=...) ― CDNがヘッダを落とす環境向けの保険
    q1 = params[:oauth]

    # 4) Cookie（同上）
    c1 = cookies[:sc_oauth]

    token = sanitize_oauth_token(h1.presence || h2.presence || q1.presence || c1.presence)

    # 取り込み経路の簡易ログ（本文は出さない）
    picked =
      if h1.present?
        :x_header
      elsif h2.present?
        :authorization
      elsif q1.present?
        :query
      elsif c1.present?
        :cookie
      else
        :none
      end
    Rails.logger.info("[sc_proxy] token source=#{picked}") unless picked == :none

    # レスポンスに情報（デバッグ用）
    set_token_source_headers(picked, token.present?)
    token
  end

  # ===== CDN向けキャッシュ無効化＆Vary =====
  def set_no_cache_headers!
    response.set_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
    response.set_header("Pragma", "no-cache")
    response.set_header("Expires", "0")
    # 認証手段によってレスポンスが変わるので Vary を明示
    vary = (%w[Authorization Cookie X-SC-OAUTH] + Array(response.get_header("Vary"))).flatten.uniq
    response.set_header("Vary", vary.join(", "))
  end

  # ===== デバッグ用レスポンスヘッダ（ブラウザNetworkで確認用） =====
  def set_token_source_headers(source, present)
    response.set_header("X-Proxy-Token-Present", present ? "true" : "false")
    response.set_header("X-Proxy-Token-From", source.to_s)
  end

  # =========== v2 解決（OAuth もしくは 匿名 client_id） ===========
  # token があれば Authorization で v2 を叩く。無ければ client_id を付けて匿名で叩く。
  def resolve_v2!(play_url, cid:, token: nil)
    u = URI.parse("https://api-v2.soundcloud.com/resolve")
    q = { url: play_url }
    q[:client_id] = cid if cid.present? && token.blank? # OAuth時は client_id 付けない
    u.query = Rack::Utils.build_query(q)

    headers = {
      "Accept"          => "application/json",
      "Accept-Encoding" => "identity",
      "User-Agent"      => "emomu-proxy/1.4"
    }
    if token.present?
      if (auth = build_auth_header(token)).present?
        headers["Authorization"] = auth
      end
    end

    res = http_get_follow(u, headers: headers)

    code  = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    if code.between?(200, 299)
      response.set_header("X-Proxy-V2-Auth", token.present? ? "oauth" : "client_id")
      render plain: res.body, status: code, content_type: ctype and return
    else
      render json: {
        error:  "upstream_error",
        stage:  "v2_resolve",
        status: code,
        rate:   { limit: res["x-ratelimit-limit"], remaining: res["x-ratelimit-remaining"], reset: res["x-ratelimit-reset"] },
        body:   res.body.to_s
      }, status: 502 and return
    end
  end

  public

  # GET /sc/resolve?url=...
  def resolve
    set_no_cache_headers!

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
    token = extract_oauth_token

    # ========= トークン有: v1 → 失敗時 v2(OAuth) フォールバック =========
    if token.present?
      begin
        v1_resolve = URI.parse("https://api.soundcloud.com/resolve?#{Rack::Utils.build_query(url: play_url)}")
        http1 = Net::HTTP.new(v1_resolve.host, v1_resolve.port)
        http1.use_ssl = true
        http1.open_timeout = 3
        http1.read_timeout = 8

        req1 = Net::HTTP::Get.new(v1_resolve.request_uri)
        req1["Accept"]          = "application/json"
        req1["Accept-Encoding"] = "identity"
        req1["User-Agent"]      = "emomu-proxy/1.4"
        if (auth = build_auth_header(token)).present?
          req1["Authorization"] = auth
        end

        res1  = http1.request(req1)
        code1 = res1.code.to_i
        loc   = res1["location"].to_s

        # 302 以外（=失敗）は v2(OAuth) に切り替え
        unless code1 == 302 && loc.present?
          Rails.logger.info("[sc_proxy#resolve] v1 resolve failed code=#{code1} → fallback v2(OAuth)")
          return resolve_v2!(play_url, cid: cid, token: token)
        end

        # 302 先（tracks/...）でトラックJSON取得
        track_uri = URI.parse(loc)
        http2 = Net::HTTP.new(track_uri.host, track_uri.port)
        http2.use_ssl = true
        http2.open_timeout = 3
        http2.read_timeout = 8

        req2 = Net::HTTP::Get.new(track_uri.request_uri)
        req2["Accept"]          = "application/json"
        req2["Accept-Encoding"] = "identity"
        req2["User-Agent"]      = "emomu-proxy/1.4"
        if (auth = build_auth_header(token)).present?
          req2["Authorization"] = auth
        end

        res2  = http2.request(req2)
        code2 = res2.code.to_i
        unless code2.between?(200, 299)
          Rails.logger.info("[sc_proxy#resolve] v1 track failed code=#{code2} → fallback v2(OAuth)")
          return resolve_v2!(play_url, cid: cid, token: token)
        end

        track = JSON.parse(res2.body) rescue nil
        return render json: { error: "parse_error" }, status: 502 unless track.is_a?(Hash)

        # v2風 media.transcodings を合成（progressive 1本）
        stream_locator = "#{track_uri}/stream" # https://api.soundcloud.com/tracks/.../stream
        v2ish = {
          "kind"  => "track",
          "id"    => track["id"],
          "title" => track["title"],
          "user"  => { "username" => track.dig("user", "username") },
          "media" => {
            "transcodings" => [
              {
                "url"      => stream_locator,
                "preset"   => "mp3_128",
                "duration" => track["duration"],
                "snipped"  => false,
                "format"   => { "protocol" => "progressive", "mime_type" => "audio/mpeg" }
              }
            ]
          }
        }

        return render json: v2ish, status: 200
      rescue => e
        Rails.logger.warn("[sc_proxy#resolve v1] #{e.class}: #{e.message} → fallback v2(OAuth)")
        return resolve_v2!(play_url, cid: cid, token: token)
      end
    end

    # ---- トークン無しは匿名（client_id）経路：v2 ----
    resolve_v2!(play_url, cid: cid, token: nil)
  end

  # GET /sc/stream?locator=...
  def stream
    set_no_cache_headers!

    locator = params[:locator].to_s
    return render json: { error: "missing locator" }, status: 400 if locator.blank?

    token = extract_oauth_token
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

    # ✅ トークンがある時は client_id を付けない / ない時は付与
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
    req["User-Agent"]       = "emomu-proxy/1.4"
    if (auth = build_auth_header(token)).present?
      req["Authorization"] = auth
    end

    res   = http.request(req)
    code  = res.code.to_i
    ctype = res["content-type"].presence || "application/json"

    # ✅ v1 /tracks/:id/stream は 302 Location → {url: ...} に変換
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
