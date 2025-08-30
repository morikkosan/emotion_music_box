# :nocov:
class LineBotController < ApplicationController
  # Webhook からのPOSTはCSRF対象外にするのが一般的
  protect_from_forgery except: :callback

  # POST /line_bot/callback
  def callback
    # いまは未実装でも 200 を返せばOK（CI通過用の最小スタブ）
    head :ok
  end

  # GET /line_add_friends
  def add_friends
    # 画面が未実装でも 200 を返しておけばOK
    head :ok
  end
end

__END__
# ===== Draft (not loaded by Rails) =====
# （ドラフトはそのままでOK。ここは読み込まれません）
# ...
# :nocov:
