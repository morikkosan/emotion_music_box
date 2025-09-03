# /app/models/contact.rb
class Contact
  include ActiveModel::Model
  include ActiveModel::Attributes

  attribute :name, :string
  attribute :email, :string
  attribute :message, :string

  # ✅ テスト期待に合わせる
  # 名前：必須・2〜10文字
  validates :name, presence: true, length: { minimum: 2, maximum: 10 }

  # メール：任意（空OK）。入っていれば形式チェック＆長さ制限
  validates :email, allow_blank: true, length: { maximum: 255 }, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }

  # メッセージ：必須・5〜200文字
  validates :message, presence: true, length: { minimum: 5, maximum: 200 }
end
