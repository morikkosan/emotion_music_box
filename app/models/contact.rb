class Contact
  include ActiveModel::Model

  attr_accessor :name, :email, :message

  validates :name,    presence: true, length: { minimum: 2, maximum: 10 }
  validates :email,   presence: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :message, presence: true, length: { minimum: 5, maximum: 200 }

  def persisted?
    false
  end
end
