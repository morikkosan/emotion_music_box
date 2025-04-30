class DebugController < ApplicationController
  def session_info
    render json: { session_state: session['omniauth.state'], full_session: session.to_hash }
  end
end
