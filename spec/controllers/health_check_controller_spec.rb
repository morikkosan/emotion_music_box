class HealthCheckController < ActionController::Base
  def up
    render plain: "OK"
  end
end
