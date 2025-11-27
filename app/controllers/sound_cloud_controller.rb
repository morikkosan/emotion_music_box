# app/controllers/sound_cloud_controller.rb
class SoundCloudController < ApplicationController
  require "httparty"
  require "base64"  # Basic認証ヘッダ用
  include ApiRateLimitable

  # 🔹クラス変数でアプリ用トークンを共有（プロセス内だけで使い回す）
  @@soundcloud_app_token            = nil
  @@soundcloud_app_token_expires_at = nil

  # 認証不要にする場合は before_action を外すかコメントアウトしてください。
  # before_action :authenticate_user!, only: [:resolve, :search]

  # 🔹検索APIにだけレート制限をかける（アプリ側の独自リミット）
  before_action :enforce_search_limit!, only: [:search]

  # GET /sc_resolve?url=…
  # SoundCloudのページURLを、APIで扱いやすい曲データに**変換（resolve）する
  def resolve
    url   = params.require(:url)
    token = fetch_app_token
    unless token
      render json: { error: "アプリ用トークン取得に失敗しました" }, status: :bad_request
      return
    end

    # SoundCloud の /resolve を OAuth トークン付きで叩く
    resp = HTTParty.get(
      "https://api.soundcloud.com/resolve",
      query:   { url: url },
      headers: { "Authorization" => "OAuth #{token}" }
    )

    if resp.success?
      render json: resp.parsed_response
    else
      render json: {
        error: resp.parsed_response,
        code:  resp.code
      }, status: resp.code
    end
  rescue => e
    render json: { error: "例外発生: #{e.message}" }, status: :internal_server_error
  end

  # GET /soundcloud/search?q=…
  def search
    query = params[:q].to_s.strip.presence || "relax"
    token = fetch_app_token

    unless token
      render json: { error: "アプリ用トークン取得に失敗しました" }, status: :bad_request
      return
    end

    url = "https://api.soundcloud.com/tracks" +
          "?q=#{URI.encode_www_form_component(query)}&limit=20"

    sc_res = HTTParty.get(
      url,
      headers: { "Authorization" => "OAuth #{token}" }
    )

    if sc_res.success?
      render json: sc_res.parsed_response
    else
      # 🔹SoundCloud 本体からエラーが返ってきたときのユーザー向けメッセージ
      message =
        case sc_res.code
        when 401
          # client_credentials のトークンがおかしい / 一時的な認証エラーなど
          "SoundCloudへの接続に問題が発生しました。時間をおいて再度お試しください。"
        when 403
          "SoundCloudの権限エラーが発生しました。時間をおいて再度お試しください。"
        when 404
          "曲が見つかりませんでした。キーワードを変えて検索してみてください。"
        when 429
          # ← 今回みたいに「SoundCloud本体のレート制限」に引っかかった場合
          "現在、曲検索が混み合っています。しばらく時間を空けてから再度お試しください。"
        when 500..599
          "SoundCloud側でエラーが発生しました。時間をおいて再度お試しください。"
        else
          "SoundCloud APIエラーが発生しました。時間をおいて再度お試しください。"
        end

      render json: {
        error: message,
        code:  sc_res.code,
        body:  sc_res.parsed_response
      }, status: sc_res.code
    end
  rescue => e
    render json: { error: "例外発生: #{e.message}" }, status: :internal_server_error
  end

  private

  # アプリ単位トークンを取得（OAuth 2.1 / client_credentials）
  #
  # 1. まずクラス変数のトークンが有効ならそれを返す
  # 2. 切れていそうなら SoundCloud に取りに行く
  # 3. 成功したらクラス変数に保存して使い回す
  def fetch_app_token
    now = Time.current

    # 1️⃣ すでに取ってあるトークンがあって、有効期限内ならそれを使う
    if @@soundcloud_app_token.present? &&
       @@soundcloud_app_token_expires_at.present? &&
       now < @@soundcloud_app_token_expires_at
      return @@soundcloud_app_token
    end

    # 2️⃣ ここまで来たら新しく取りに行く
    client_id     = ENV["SOUNDCLOUD_CLIENT_ID"]
    client_secret = ENV["SOUNDCLOUD_CLIENT_SECRET"]

    credentials = "#{client_id}:#{client_secret}"
    basic_auth  = "Basic #{Base64.strict_encode64(credentials)}"

    res = HTTParty.post(
      "https://secure.soundcloud.com/oauth/token",
      headers: {
        "Authorization" => basic_auth,
        "Accept"        => "application/json; charset=utf-8",
        "Content-Type"  => "application/x-www-form-urlencoded"
      },
      body: {
        grant_type: "client_credentials"
      }
    )

    if res.success?
      body       = JSON.parse(res.body)
      token      = body["access_token"]
      expires_in = body["expires_in"].to_i # 秒数が帰ってくるはず

      Rails.logger.info "[SoundCloud] token ok status=#{res.code} body=#{body.inspect}"

      # 3️⃣ 有効期限：expires_in があればそれを基準に、少し余裕を持って短めにしておく
      #    ざっくり 50分〜ぐらいで十分（なければデフォルト 50 分）
      ttl_seconds = if expires_in.positive?
                      [expires_in - 60, 60].max # 1分マイナス、最低60秒
                    else
                      50.minutes.to_i
                    end

      @@soundcloud_app_token            = token
      @@soundcloud_app_token_expires_at = now + ttl_seconds

      token
    else
      Rails.logger.error "[SoundCloud] token error status=#{res.code} body=#{res.body}"
      nil
    end
  rescue => e
    Rails.logger.error "[SoundCloud] token exception #{e.class}: #{e.message}"
    nil
  end
end
