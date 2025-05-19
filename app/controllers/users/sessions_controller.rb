# app/controllers/users/sessions_controller.rb
class Users::SessionsController < Devise::SessionsController
  def destroy
    super do
      flash[:notice] = "ログアウトしました。また来てね！" if is_flashing_format?
    end
  end
end

