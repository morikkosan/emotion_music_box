require "#{Rails.root}/app/strategies/omniauth/strategies/sound_cloud"

OmniAuth::Strategies::SoundCloud.class_eval do
  def authorize_params
    super.tap do |params|
      # デフォルトが "non-expiring" になっている場合は、空文字に変更する
      params[:scope] = "" if params[:scope].to_s == "non-expiring"
    end
  end
end
