# app/controllers/line_link_controller.rb
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
# 下は将来実装するための雛形です。__END__以降はRubyに読み込まれないため、
# CIのeager_load対象外になり、コードを保管しておけます。

# class LineLinkController < ActionController::Base
#   def link
#     token = params[:token]
#     line_user_id = params[:line_user_id]
#
#     link_token = LineLinkToken.find_by(token: token)
#     Rails.logger.info "📌 発行したLINE連携トークン: #{token}"
#
#     if link_token.present? && line_user_id.present?
#       user = link_token.user
#
#       if user.line_user_id.blank?
#         user.update!(line_user_id: line_user_id)
#         link_token.update!(used: true)
#         Rails.logger.info "✅ LINE ID を保存しました: #{line_user_id}"
#       else
#         Rails.logger.info "ℹ️ 既にLINE IDは登録済み: #{user.line_user_id}"
#       end
#
#       render :success
#     else
#       render plain: "⚠️ 無効なリンクまたは連携済みです。", status: :unprocessable_entity
#     end
#   end
# end
