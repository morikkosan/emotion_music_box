class User < ApplicationRecord
  devise :database_authenticatable, :registerable, :recoverable,
         :rememberable, :validatable, :omniauthable, omniauth_providers: [:soundcloud, :google_oauth2]

  has_many :emotion_logs, dependent: :destroy        
  has_many :identities, dependent: :destroy
  has_many :bookmarks, dependent: :destroy

  has_many :bookmarked_emotion_logs, through: :bookmarks, source: :emotion_log

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
end
