class DebugController < ApplicationController
  before_action :restrict_in_production

  def session_info
    render json: { session_state: session["omniauth.state"], full_session: session.to_hash }
  end

  private

  def restrict_in_production
    head :forbidden if Rails.env.production?
  end
end
