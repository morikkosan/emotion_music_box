class User < ApplicationRecord
  # devise関連
  devise :database_authenticatable, :registerable, :recoverable,
         :rememberable, :omniauthable, omniauth_providers: [ :soundcloud, :google_oauth2 ]

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
  validates :uid, presence: true

  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :password, length: { minimum: 6 }, allow_nil: true

    attr_accessor :cropped_avatar_data
    attr_accessor :remove_avatar


  # プロフィール画像URLを返す（Cloudinary無ければデフォルト画像）
  def profile_avatar_url
    avatar_url.presence || "default_stick_figure.webp"
  end

  # --- ここから下は既存のロジックを残してOK ---
  def self.from_omniauth(auth)
    identity = Identity.find_or_initialize_by(provider: auth.provider, uid: auth.uid)
    user = identity.user || User.find_by(email: auth.info.email)

    if user.nil?
      name = (auth.info.name || "未設定")[0, 6]
      user = User.new(
        email: auth.info.email.presence || "#{auth.uid}@soundcloud.com",
        name: name,
        password: Devise.friendly_token[0, 20],
        provider: auth.provider,
        uid: auth.uid,
        soundcloud_uid: auth.uid # ← 追加
      )
      user.save
    end

    identity.user = user
    identity.save
    user
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
