class User < ApplicationRecord
  # devise関連
  devise :database_authenticatable, :registerable, :recoverable,
         :rememberable, :omniauthable, omniauth_providers: [:soundcloud, :google_oauth2]

  # ★ 開発/テストで使う ActiveStorage（本番で使わなくても宣言してOK）
  has_one_attached :avatar

  # 関連
  has_many :emotion_logs, dependent: :destroy
  has_many :identities, dependent: :destroy
  has_many :bookmarks, dependent: :destroy
  has_many :bookmarked_emotion_logs, through: :bookmarks, source: :emotion_log
  has_many :comment_reactions, dependent: :destroy
  has_many :comments, dependent: :destroy
  has_many :playlists, dependent: :destroy
  has_many :line_link_tokens
  has_one :push_subscription, dependent: :destroy

  # バリデーション
  validates :name, presence: true
  validates :name, length: { maximum: 6 }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :password, length: { minimum: 6 }, allow_nil: true
  validates :uid, presence: true
  validates :provider, presence: true

  attr_accessor :cropped_avatar_data
  attr_accessor :remove_avatar

  # プロフィール画像URLを返す（AS添付→URL→デフォルト の順でフォールバック）
  def profile_avatar_url
    if respond_to?(:avatar) && avatar.respond_to?(:attached?) && avatar.attached?
      # host不要で使えるパスを返す（image_tagにそのまま渡せる）
      Rails.application.routes.url_helpers.rails_blob_path(avatar, only_path: true)
    elsif avatar_url.present?
      avatar_url
    else
      ActionController::Base.helpers.asset_path('default_stick_figure.webp')
    end
  end

  # --- OAuth ログイン時のユーザー取得/作成 ---
  def self.from_omniauth(auth)
    identity = Identity.find_or_initialize_by(provider: auth.provider, uid: auth.uid)

    # Provider から来た表示名（6文字制限を適用）
    provider_name = (auth.info.name || "未設定")[0, 6]

    # まず Identity に紐づくユーザー、なければ email で既存ユーザーを探す
    user = identity.user || User.find_by(email: auth.info.email)

    if user.nil?
      # ★ 初回作成時のみ、プロバイダ名を user.name に採用
      user = User.new(
        email: auth.info.email.presence || "#{auth.uid}@soundcloud.com",
        name: provider_name,
        password: Devise.friendly_token[0, 20],
        provider: auth.provider,
        uid: auth.uid,
        soundcloud_uid: auth.uid
      )
      user.save
    else
      # ★ 以後のログインでは user.name を絶対に上書きしない
      # （プロフィール編集で設定した名前を尊重するため）
      # 何も書かないことが肝心
    end

    identity.user = user
    identity.save
    user
  end

  def push_enabled?
    self[:push_enabled]
  end

  def connected_with?(provider)
    identities.exists?(provider: provider)
  end

  def bookmark(emotion_log)
    bookmarks.create!(emotion_log: emotion_log)
  end

  def bookmark?(emotion_log)
    bookmarked_emotion_logs.exists?(emotion_log.id)
  end
end
