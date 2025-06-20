class LineWebhookController < ApplicationController
  protect_from_forgery with: :null_session  # Webhook用にCSRF無効化

  def callback
    body = request.body.read
    events = JSON.parse(body)["events"]

    events.each do |event|
      user_id = event["source"]["userId"]
      Rails.logger.info("Received LINE userId: #{user_id}")
    end

    head :ok
  end
end
