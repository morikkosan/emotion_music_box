class LineLinkController < ActionController::Base
  def link
    token = params[:token]
    line_user_id = params[:line_user_id]

    link_token = LineLinkToken.find_by(token: token, used: false)

    if link_token.present? && line_user_id.present?
      link_token.user.update!(line_user_id: line_user_id)
      link_token.update!(used: true)
      render :success
    else
      render plain: "⚠️ 無効なリンクまたは連携済みです。", status: :unprocessable_entity
    end
  end
end
