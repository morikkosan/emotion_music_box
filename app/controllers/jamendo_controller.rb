class JamendoController < ApplicationController
  require "httparty"

  def search
    query = params[:q].to_s.strip.presence || "relax"  # デフォルトは "relax"
    client_id = ENV["JAMENDO_CLIENT_ID"] || "your_client_id_here"  # 環境変数から取得

    url = "https://api.jamendo.com/v3.0/tracks/?client_id=#{client_id}&format=json&search=#{URI.encode_www_form_component(query)}"

    begin
      response = HTTParty.get(url)

      if response.success?
        json_data = JSON.parse(response.body)
        @tracks = json_data["results"] || []
        render json: @tracks
      else
        render json: { error: "APIエラー: #{response.code}" }, status: :bad_request
      end

    rescue HTTParty::Error => e
      render json: { error: "HTTPエラー: #{e.message}" }, status: :internal_server_error
    rescue JSON::ParserError => e
      render json: { error: "JSON解析エラー: #{e.message}" }, status: :internal_server_error
    end
  end
end
