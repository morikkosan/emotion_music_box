class PushSubscriptionsController < ApplicationController
  skip_before_action :verify_authenticity_token

  protect_from_forgery with: :null_session, if: -> { request.format.json? }

  before_action :authenticate_user!
  respond_to :json

  def create
  Rails.logger.debug "🐛 createアクションに入りました"
  Rails.logger.debug "🐛 current_user: #{current_user.inspect}"
  Rails.logger.debug "🐛 リクエスト形式: #{request.format}"
  Rails.logger.debug "🐛 リクエストヘッダー: #{request.headers.env.select { |k, _| k.to_s.start_with?('HTTP_') }}"
  Rails.logger.debug "🐛 params: #{params.inspect}"

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
