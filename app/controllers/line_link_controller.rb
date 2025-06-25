class LineLinkController < ActionController::Base
  def link
    token = params[:token]
    line_user_id = params[:line_user_id]

    link_token = LineLinkToken.find_by(token: token)
    Rails.logger.info "📌 発行したLINE連携トークン: #{token}"

    if link_token.present? && line_user_id.present?
      user = link_token.user

      if user.line_user_id.blank?
        user.update!(line_user_id: line_user_id)
        link_token.update!(used: true)
        Rails.logger.info "✅ LINE ID を保存しました: #{line_user_id}"
      else
        Rails.logger.info "ℹ️ 既にLINE IDは登録済み: #{user.line_user_id}"
      end

      render :success
    else
      render plain: "⚠️ 無効なリンクまたは連携済みです。", status: :unprocessable_entity
    end
  end
end
