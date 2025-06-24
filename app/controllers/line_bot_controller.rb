require 'httparty'

class LineBotController < ApplicationController
  protect_from_forgery with: :null_session

  # 投稿通知
  def send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
    message = format(LINE_NOTIFY_EMOTION_LOG,
      emotion: emotion,
      track_name: track_name,
      artist_name: artist_name,
      hp: hp
    )
    send_line_message(user, message)
  end

  # リアクション通知
  def send_reaction(user, user_name:, bookmark:, comment_reaction:)
    message = format(LINE_NOTIFY_REACTION,
      user_name: user_name,
      bookmark: bookmark,
      comment_reaction: comment_reaction
    )
    send_line_message(user, message)
  end

  # お知らせ通知
  def send_news(user)
    send_line_message(user, LINE_NOTIFY_NEWS)
  end

  # LINE BotのWebhook受信
  def callback
    Rails.logger.debug "🔥 Webhook 受信！"

    body = request.body.read
    signature = request.env['HTTP_X_LINE_SIGNATURE']

    return head :bad_request unless validate_signature(body, signature)

    events = JSON.parse(body)['events']
    events.each do |event|
      if event['type'] == 'follow'
        line_user_id = event['source']['userId']
        Rails.logger.debug "LINE USER ID: #{line_user_id}"

        link_url = "https://moriappli-emotion.com/line_link?line_user_id=#{line_user_id}"

        welcome_message = <<~MSG
          エモミュへようこそ！🎧
          LINE連携ありがとうございます！

          下のリンクを押すと、エモミュから嬉しい通知が届くようになります👇
          #{link_url}
        MSG

        send_raw_message(line_user_id, welcome_message)
      end
    end

    head :ok
  end

  # 実際の送信処理（共通化）
  def send_line_message(user, message)
    return unless user.line_user_id.present?
    send_raw_message(user.line_user_id, message)
  end

  def send_raw_message(line_user_id, text)
    url = "https://api.line.me/v2/bot/message/push"
    headers = {
      "Content-Type" => "application/json",
      "Authorization" => "Bearer #{ENV['LINE_BOT_CHANNEL_TOKEN']}"
    }

    body = {
      to: line_user_id,
      messages: [
        {
          type: 'text',
          text: text
        }
      ]
    }

    response = HTTParty.post(url, headers: headers, body: body.to_json)

    unless response.success?
      Rails.logger.warn("LINE送信失敗: #{response.code} - #{response.body}")
    end
  end

  # 友だち追加ページ（QRコード表示用）
  def add_friends
    url = 'https://lin.ee/wEGjqmK9'
    qrcode = RQRCode::QRCode.new(url)
    @svg = qrcode.as_svg(
      offset: 0,
      color: '000000',
      shape_rendering: 'crispEdges',
      module_size: 11,
      standalone: true,
      use_viewbox: true
    )
  end

  def test_notify
  user = User.find_by(email: "test@example.com") # テスト用ユーザーのメールに合わせて変更
  if user&.line_notify_token.present?
    LineNotifyService.new(user).send("🎧 LINE Notify テストメッセージ 🎉")
    render plain: "✅ 通知を送信しました！"
  else
    render plain: "⚠️ トークンが登録されていません"
  end
end


  private

  def validate_signature(body, signature)
    channel_secret = ENV['LINE_BOT_CHANNEL_SECRET']
    hash = OpenSSL::HMAC.digest(OpenSSL::Digest::SHA256.new, channel_secret, body)
    Base64.strict_encode64(hash) == signature
  end
end
