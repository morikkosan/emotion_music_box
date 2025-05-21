require 'omniauth-oauth2'

module OmniAuth
  module Strategies
    class SoundCloud < OmniAuth::Strategies::OAuth2
      option :name, 'soundcloud'

      option :client_options, {
        site: 'https://api.soundcloud.com',
        authorize_url: 'https://secure.soundcloud.com/authorize',
        token_url: 'https://secure.soundcloud.com/oauth/token'
      }

      # 👇ここを追加する
      option :authorize_params, {
        client_id: ENV['SOUNDCLOUD_CLIENT_ID']
      }

      option :token_params, {
        client_id: ENV['SOUNDCLOUD_CLIENT_ID'],
        client_secret: ENV['SOUNDCLOUD_CLIENT_SECRET'], # ← これを追加！
        redirect_uri: ENV['SOUNDCLOUD_REDIRECT_URI']
      }
      


      uid { raw_info['id'] }

      info do
        {
          name: raw_info['username'],
          image: raw_info['avatar_url']
        }
      end

      def raw_info
        @raw_info ||= access_token.get('/me').parsed
      end
    end
  end
end
