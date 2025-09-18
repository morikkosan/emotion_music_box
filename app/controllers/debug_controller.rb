class DebugController < ApplicationController
  before_action :restrict_in_production
  before_action :authenticate_user!  # ← dev/testでもログイン必須にするなら

  def session_info
    safe = session.to_hash.slice("warden.user.user.key", "omniauth.state")
    render json: {
      session_state: safe["omniauth.state"],
      user_session_key_present: safe["warden.user.user.key"].present?
    }
  end

  private

  def restrict_in_production
    head :not_found if Rails.env.production?
  end
end
