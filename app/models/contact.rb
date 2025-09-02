# /app/models/contact.rb
class Contact
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :name, :string
  attribute :email, :string
  attribute :message, :string

  validates :name, presence: true, length: { maximum: 100 }
  validates :email, presence: true, length: { maximum: 255 }
  validates :message, presence: true, length: { maximum: 2000 }

  # 必要なら簡易メール形式チェック（厳格にしすぎると弾きすぎるので控えめに）
  validates_format_of :email, with: /\A[^@\s]+@[^@\s]+\z/
end
