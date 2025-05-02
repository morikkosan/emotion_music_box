# app/controllers/sound_cloud_controller.rb
class SoundCloudController < ApplicationController
  require 'httparty'
  # 認証不要にして誰でも使えるようにするか、
  # before_action :authenticate_user! を残すかはお好みで

  # POST /soundcloud/search?q=...
  def search
    query = params[:q].to_s.strip.presence || "relax"

    # 1) Client Credentials でアプリトークン取得
    token = fetch_app_token
    unless token
      render json: { error: "アプリ用トークン取得に失敗しました" }, status: :bad_request
      return
    end

    # 2) 取得したトークンで検索
    url = "https://api.soundcloud.com/tracks" +
          "?q=#{URI.encode_www_form_component(query)}&limit=20"
    sc_res = HTTParty.get(url, headers: { "Authorization" => "OAuth #{token}" })

    if sc_res.success?
      render json: JSON.parse(sc_res.body)
    else
      render json: {
        error: "SoundCloud APIエラー",
        code:  sc_res.code,
        body:  sc_res.parsed_response
      }, status: sc_res.code
    end
  rescue => e
    render json: { error: "例外発生: #{e.message}" }, status: :internal_server_error
  end

  private

  # アプリ単位トークンを取得
  def fetch_app_token
    res = HTTParty.post(
      "https://api.soundcloud.com/oauth2/token",
      body: {
        client_id:     ENV["SOUNDCLOUD_CLIENT_ID"],
        client_secret: ENV["SOUNDCLOUD_CLIENT_SECRET"],
        grant_type:    "client_credentials"
      }
    )
    return JSON.parse(res.body)["access_token"] if res.success?
    nil
  end
end
