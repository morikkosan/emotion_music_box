class LineLinkController < ApplicationController
  before_action :authenticate_user!

  def link
    if params[:line_user_id].present?
      current_user.update(line_user_id: params[:line_user_id])
      redirect_to root_path, notice: "LINE連携が完了しました！"
    else
      redirect_to root_path, alert: "LINE連携に失敗しました。"
    end
  end
end

