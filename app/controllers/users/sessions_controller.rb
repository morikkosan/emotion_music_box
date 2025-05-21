# app/controllers/users/sessions_controller.rb
class Users::SessionsController < Devise::SessionsController
  def destroy
    super do
      flash[:notice] = "ログアウトしました。また来てね！" if is_flashing_format?
    end
  end

   def new
    @emotion_logs = EmotionLog.includes(:user, :bookmarks, :tags).order(date: :desc).limit(10)
    @mypage_title = "ようこそ"
    render 'emotion_logs/index'
  end
end

