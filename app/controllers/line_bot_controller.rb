require 'line/bot'

class LineBotController < ApplicationController
  protect_from_forgery with: :null_session

  def callback
    body = request.body.read
    signature = request.env['HTTP_X_LINE_SIGNATURE']

    unless client.validate_signature(body, signature)
      head :bad_request
      return
    end

    events = client.parse_events_from(body)

    events.each do |event|
      case event
      when Line::Bot::Event::Follow
        user_id = event['source']['userId']
        # ユーザーIDを保存（ログインユーザーやDBに紐付け）
        User.find_by(line_user_id: user_id) || User.create(line_user_id: user_id)
      end
    end

    head :ok
  end

  def send_notification(user, message)
    client.push_message(user.line_user_id, { type: 'text', text: message })
  end

  def add_friends
    url = 'https://lin.ee/wEGjqmK9'
    qrcode = RQRCode::QRCode.new(url)
    @svg = qrcode.as_svg(
      offset: 0,                         # フチのズレ防止
      color: '000000',
      shape_rendering: 'crispEdges',
      module_size: 11,                  # ← サイズ調整でズレを防止
      standalone: true,
      use_viewbox: true
    )
  end

  private

  def client
    @client ||= Line::Bot::Client.new do |config|
      config.channel_secret = ENV['LINE_CHANNEL_SECRET']
      config.channel_token = ENV['LINE_CHANNEL_TOKEN']
    end
  end
end
