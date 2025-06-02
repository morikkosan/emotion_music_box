class HealthCheckController < ActionController::Base  # ← こっちに変える
  def up
    render plain: "OK"
  end
end
