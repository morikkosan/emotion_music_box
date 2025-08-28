# :nocov:
class LineLinkController < ApplicationController
  # GET /line_link?token=...&line_user_id=...
  # いまは未実装だが、CIのeager_loadで読み込まれるため最小スタブを置く
  def link
    # 将来実装するまでの暫定。テンプレート未用意でも200を返す。
    head :ok
  end
end

__END__
# ===== Draft (not loaded by Rails) =====
# （ドラフトはそのままでOK。ここは読み込まれません）
# ...
# :nocov:
