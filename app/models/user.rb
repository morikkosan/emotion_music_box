# app/models/user.rb
# frozen_string_literal: true

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

  # バリデーション（編集画面でも“見た目6文字以内”で統一）
  validates :name, presence: true
  validate  :name_grapheme_length_within_6
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :password, length: { minimum: 6 }, allow_nil: true
  validates :uid, presence: true
  validates :provider, presence: true

  attr_accessor :cropped_avatar_data
  attr_accessor :remove_avatar

  # プロフィール画像URLを返す（AS添付→URL→デフォルト の順でフォールバック）
  def profile_avatar_url
    if respond_to?(:avatar) && avatar.respond_to?(:attached?) && avatar.attached?
      Rails.application.routes.url_helpers.rails_blob_path(avatar, only_path: true)
    elsif avatar_url.present?
      avatar_url
    else
      ActionController::Base.helpers.asset_path("default_stick_figure.webp")
    end
  end

  # --- OAuth ログイン時のユーザー取得/作成 ---
  def self.from_omniauth(auth)
    identity = Identity.find_or_initialize_by(provider: auth.provider, uid: auth.uid)

    # Provider から来た表示名（👩🏽‍🎤等の結合文字/肌色修飾を考慮して字素単位で6に丸める）
    raw = auth.info.name.presence || "未設定"
    provider_name = truncate_grapheme(raw, 6)

    # email 照合は大小無視で（DBは LOWER(email) ユニーク）
    email = auth.info.email.to_s.strip
    user_by_email =
      if email.present?
        User.where("LOWER(email) = ?", email.downcase).first
      else
        nil
      end

    # まず Identity に紐づくユーザー、なければ email で既存ユーザーを探す（nil誤ヒット防止）
    user = identity.user || user_by_email

    if user.nil?
      # ★ 初回作成：省略済みの name を採用。email 無ければ nil に（ダミーを入れない）
      user = User.new(
        email: email.presence,                              # ← nil 許可（DB/アプリ方針と一致）
        name: provider_name,
        password: Devise.friendly_token[0, 20],
        provider: auth.provider,
        uid: auth.uid,
        soundcloud_uid: auth.uid
      )
      user.save!  # ← 失敗を握りつぶさない（422の原因がわかる）
    else
      # 以後のログインでは user.name を絶対に上書きしない（編集で設定した名前を尊重）
      # ここで save はしない（不要な再検証を避ける）
    end

    # Identity 保存（ユニーク衝突レース対策）
    begin
      identity.user = user
      identity.save!
    rescue ActiveRecord::RecordNotUnique
      # 他プロセスが先に作った場合：取り直して紐付け確認
      identity = Identity.find_by!(provider: auth.provider, uid: auth.uid)
      identity.update!(user: user) unless identity.user_id == user.id
    end

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

  private

  # “見た目の1文字”（字素）で6以内かを検証
  def name_grapheme_length_within_6
    s = name.to_s
    grapheme_len = s.mb_chars.grapheme_clusters.length
    errors.add(:name, "は6文字以内で入力してください") if grapheme_len > 6
  end

  # 字素単位で安全に切る（見た目の“1文字”を壊さない）
  # 例）"👩🏽‍🎤ABC" を 3 に切ると "👩🏽‍🎤AB" になる
  def self.truncate_grapheme(str, max)
    s = str.to_s
    clusters = s.mb_chars.grapheme_clusters
    clusters[0, max].join
  end
end
