class UsersController < ApplicationController
  before_action :authenticate_user!  # ログインしていない場合にアクセス不可

  # ユーザー一覧ページ
  def index
    @users = User.all
  end

  # ユーザー詳細ページ
  def show
    @user = User.find(params[:id])
  end

  # ユーザー編集ページ
  def edit
    @user = current_user
  end

  # ユーザー情報更新
  def update
    @user = current_user
    if @user.update(user_params)
      redirect_to @user, notice: "プロフィールが更新されました"
    else
      render :edit
    end
  end

   def toggle_line_notification
    current_user.update(line_notification_enabled: !current_user.line_notification_enabled)
    redirect_back(fallback_location: root_path, notice: "通知設定を更新しました")
  end

  private

  def user_params
    params.require(:user).permit(:name, :gender, :age, :email)
  end
end
