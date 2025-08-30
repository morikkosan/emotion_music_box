# app/controllers/pages_controller.rb
class PagesController < ApplicationController
  # 誰でも見られるように（アプリ全体で認証を強制している場合の保険）
  skip_before_action :authenticate_user!, only: %i[terms privacy cookie], raise: false

  # レイアウトは通常の application.html.erb を使用
  def terms;   end
  def privacy; end
  def cookie;  end
end
