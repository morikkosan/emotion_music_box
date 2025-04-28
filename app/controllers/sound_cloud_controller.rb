class SoundCloudController < ApplicationController
  require 'httparty'

  # SoundCloud APIからのclient_idを取得する
  def client_id
    render json: { client_id: ENV["SOUNDCLOUD_CLIENT_ID"] }
  end

  # ユーザーのアクセストークンを使って検索
  def search
    # クエリパラメータがなければデフォルトを使用
    query = params[:q].to_s.strip.presence || "relax"

    # 現在のユーザーからアクセストークンを取得
    access_token = current_user.soundcloud_token

    if access_token.nil?
      render json: { error: "SoundCloudのアクセストークンがありません。ログインしてから検索してください。" }, status: :unauthorized
      return
    end

    # SoundCloud APIの検索URL（アクセストークンを使用）
    url = "https://api.soundcloud.com/tracks?q=#{URI.encode_www_form_component(query)}&limit=20"

    begin
      # リクエストにアクセストークンを追加
      response = HTTParty.get(url, headers: { "Authorization" => "OAuth #{access_token}" })

      # 成功した場合
      if response.success?
        json_data = JSON.parse(response.body)
        @tracks = json_data || []  # もし結果がない場合は空配列を返す
        render json: @tracks
      else
        # エラーの場合
        render json: { error: "APIエラー: #{response.code}" }, status: :bad_request
      end

    rescue HTTParty::Error => e
      # HTTPエラーの処理
      render json: { error: "HTTPエラー: #{e.message}" }, status: :internal_server_error
    rescue JSON::ParserError => e
      # JSON解析エラーの処理
      render json: { error: "JSON解析エラー: #{e.message}" }, status: :internal_server_error
    end
  end
end
