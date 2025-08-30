# :nocov:
class UsersController < ApplicationController
  before_action :authenticate_user!  # ログインしていない場合にアクセス不可

  # # ユーザー一覧ページ
  # def index
  #   @users = User.all
  # end

  # # ユーザー詳細ページ
  # def show
  #   @user = User.find(params[:id])
  # end

  # # ユーザー編集ページ
  # def edit
  #   @user = current_user
  # end

  # # ユーザー情報更新
  # def update
  #   @user = current_user
  #   if @user.update(user_params)
  #     redirect_to @user, notice: "プロフィールが更新されました"
  #   else
  #     render :edit
  #   end
  # end

  def enable_push_notifications
    current_user.update!(push_enabled: true)
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.replace(
          "notification-toggle",
          partial: "shared/notification_toggle",
          locals: { user: current_user }
        )
      end
      format.html { redirect_back fallback_location: root_path, notice: "通知をオンにしました" }
    end
  end

  def disable_push_notifications
    current_user.update!(push_enabled: false)
    respond_to do |format|
      format.turbo_stream do
        render turbo_stream: turbo_stream.replace(
          "notification-toggle",
          partial: "shared/notification_toggle",
          locals: { user: current_user }
        )
      end
      format.html { redirect_back fallback_location: root_path, notice: "通知をオフにしました" }
    end
  end

  private

  def user_params
    params.require(:user).permit(:name, :gender, :age, :email)
  end
end
# :nocov:
