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

   def create_line_link
    token = SecureRandom.uuid
    LineLinkToken.create!(user: current_user, token: token, used: false)

    # 連携用URLを生成（ドメインは環境に応じて調整）
  link_url = "https://moriappli-emotion.com/line_link?token=#{token}&line_user_id=#{current_user.line_user_id}"

    # LINEに送信
    if current_user.line_user_id.present?
      LineBotNotifier.push_message(
        to: current_user.line_user_id,
        message: "以下のURLをタップしてLINE連携を完了してください！\n#{link_url}"
      )
      redirect_to root_path, notice: "LINEにメッセージを送りました！"
    else
      redirect_to root_path, alert: "LINEユーザーIDが登録されていません。"
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
