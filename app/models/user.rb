class User < ApplicationRecord
  devise :database_authenticatable, :registerable, :recoverable,
         :rememberable, :omniauthable, omniauth_providers: [:soundcloud, :google_oauth2]

  has_many :emotion_logs, dependent: :destroy        
  has_many :identities, dependent: :destroy
  has_many :bookmarks, dependent: :destroy

  has_many :bookmarked_emotion_logs, through: :bookmarks, source: :emotion_log
  has_many :comment_reactions, dependent: :destroy

  has_one_attached :avatar  # ✅ これを追加


  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  validates :password, length: { minimum: 6 }, allow_nil: true


  attr_accessor :cropped_avatar_data, :remove_avatar

  def self.from_omniauth(auth)
    identity = Identity.find_or_initialize_by(provider: auth.provider, uid: auth.uid)
  
    user = identity.user || User.find_by(email: auth.info.email)
  
    if user.nil?
      user = User.new(
        email: auth.info.email.presence || "#{auth.uid}@soundcloud.com",
        name: auth.info.name || "未設定",
        password: Devise.friendly_token[0, 20],
        provider: auth.provider,
        uid: auth.uid,
        soundcloud_uid: auth.uid # ← 追加！
      )
  
      if user.save
        Rails.logger.info "✅ User created successfully: #{user.email}"
      else
        Rails.logger.error "❌ User creation failed: #{user.errors.full_messages}"
      end
    end
  
    identity.user = user
    if identity.save
      Rails.logger.info "✅ Identity linked: #{identity.provider} - #{identity.uid}"
    else
      Rails.logger.error "❌ Identity linking failed: #{identity.errors.full_messages}"
    end
  
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

  def remove_avatar=(value)
    if value == "1" && avatar.attached?
      avatar.purge
    end
  end
end
