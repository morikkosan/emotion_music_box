# frozen_string_literal: true

class ApplicationMailer < ActionMailer::Base
  # ENVが未設定でもクラス定義時に落ちないよう、Procで遅延評価
  # 優先度: ENV["RESEND_FROM"] → credentials(:resend, :from) → デフォルト
  default from: -> { from_address }
  layout "mailer"

  private

  def from_address
    ENV["RESEND_FROM"].presence ||
      Rails.application.credentials.dig(:resend, :from).presence ||
      "no-reply@localhost"
  end
end
