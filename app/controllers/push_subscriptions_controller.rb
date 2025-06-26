# app/controllers/push_subscriptions_controller.rb
class PushSubscriptionsController < ApplicationController
  protect_from_forgery with: :null_session
  before_action :authenticate_user!

  def create
    sub = params[:subscription]

    current_user.push_subscription&.destroy

    current_user.create_push_subscription!(
      endpoint: sub[:endpoint],
      key_p256dh: sub[:keys][:p256dh],
      key_auth: sub[:keys][:auth]
    )

    render json: { success: true }
  rescue => e
    Rails.logger.error("Push購読登録エラー: #{e.message}")
    render json: { success: false, error: e.message }, status: :unprocessable_entity
  end
end
