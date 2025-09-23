# app/services/line_bot_notifier.rb
class LineBotNotifier
  require "faraday"
  require "json"

  def self.push_message(to:, message:)
    token = ENV["LINE_BOT_CHANNEL_TOKEN"]
    return unless token && to && message

    body = {
      to: to,
      messages: [
        {
          type: "text",
          text: message
        }
      ]
    }

    response = Faraday.post(
      "https://api.line.me/v2/bot/message/push",
      body.to_json,
      {
        "Content-Type" => "application/json",
        "Authorization" => "Bearer #{token}"
      }
    )

    # 応答のログ（必要に応じて）
    Rails.logger.info("LINE Push Response Status: #{response.status}")
    Rails.logger.info("LINE Push Response Body: #{response.body}")

    response.success?
  end
end
