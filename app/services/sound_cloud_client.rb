# app/services/sound_cloud_client.rb
class SoundCloudClient
  include HTTParty
  base_uri "https://api.soundcloud.com"

  def self.refresh_token(user)
    response = HTTParty.post("https://api.soundcloud.com/oauth2/token", {
      body: {
        grant_type: "refresh_token",
        client_id: ENV["SOUNDCLOUD_CLIENT_ID"],
        client_secret: ENV["SOUNDCLOUD_CLIENT_SECRET"],
        refresh_token: user.soundcloud_refresh_token
      }
    })

    if response.code == 200 && response.parsed_response["access_token"]
      user.update!(
        soundcloud_token: response.parsed_response["access_token"],
        soundcloud_refresh_token: response.parsed_response["refresh_token"],
        soundcloud_token_expires_at: Time.current + response.parsed_response["expires_in"].to_i.seconds
      )
        Rails.logger.info "✅ SoundCloudトークンリフレッシュ成功 user_id: #{user.id} expires_at: #{user.soundcloud_token_expires_at}"

      true
    else
      Rails.logger.error "❌ リフレッシュ失敗: #{response.body}"
      false
    end
  end
end
