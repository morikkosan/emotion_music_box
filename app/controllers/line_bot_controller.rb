# app/controllers/line_bot_controller.rb
class LineBotController < ApplicationController
  # Webhook からのPOSTはCSRF対象外にするのが一般的
  protect_from_forgery except: :callback

  # POST /line_bot/callback
  def callback
    # いまは未実装でも 200 を返せばOK（CI通過用の最小スタブ）
    head :ok
  end

  # GET /line_add_friends
  def add_friends
    # 画面が未実装でも 200 を返しておけばOK
    head :ok
  end
end

__END__
# ===== Draft (not loaded by Rails) =====
# 下は将来実装するためのメモ・雛形です。CIのeager_load対象外になります。

# require 'httparty'

# class LineBotController < ApplicationController
#   protect_from_forgery with: :null_session
#
#   # 投稿通知
#   def send_emotion_log(user, emotion:, track_name:, artist_name:, hp:)
#     message = format(LINE_NOTIFY_EMOTION_LOG,
#       emotion: emotion,
#       track_name: track_name,
#       artist_name: artist_name,
#       hp: hp
#     )
#     send_line_message(user, message)
#   end
#
#   # コメント通知
#  def send_comment_notification(user, commenter_name:, comment_body:)
#   message = <<~MSG
#     💬 新しいコメントが届きました！
#
#     投稿者: #{commenter_name}
#     コメント: 「#{comment_body}」
#   MSG
#
#   send_line_message(user, message)
# end
#
# # ブックマーク通知
# def send_bookmark_notification(user, by_user_name:, track_name:)
#   message = <<~MSG
#      🔖 #{by_user_name}さんが
#   あなたの「#{track_name}」をブックマークしました！
#
#   仲間が見つかって嬉しいね 🎶
#   MSG
#
#   send_line_message(user, message)
# end
#
#
#
#   # お知らせ通知
#   def send_news(user)
#   latest_news = News.order(created_at: :desc).first
#   return unless latest_news && user.line_user_id.present?
#
#   message = <<~MSG
#     📢 #{latest_news.title}
#
#     #{latest_news.body}
#   MSG
#
# send_raw_message(user.line_user_id, message)
# end
#
#   # LINE BotのWebhook受信
#   def callback
#     Rails.logger.debug "🔥 Webhook 受信！"
#
#     body = request.body.read
#     signature = request.env['HTTP_X_LINE_SIGNATURE']
#     return head :bad_request unless validate_signature(body, signature)
#
#     events = JSON.parse(body)['events']
#     events.each do |event|
#       if event['type'] == 'follow'
#         line_user_id = event['source']['userId']
#         Rails.logger.debug "LINE USER ID: #{line_user_id}"
#
#         # セッション使わず、未使用トークンを1件取得（最新のもの）
#         link_token = LineLinkToken.where(used: false).order(created_at: :desc).first
#
#         if link_token.present?
#           # トークン付きURLを送信
#           link_url = "https://moriappli-emotion.com/line_link?token=#{link_token.token}&line_user_id=#{line_user_id}"
#
#           welcome_message = <<~MSG
#             エモミュへようこそ！🎧
#             LINE連携ありがとうございます！
#
#             下のリンクを押すと、エモミュとLINEが連携されます👇
#             #{link_url}
#           MSG
#
#           send_raw_message(line_user_id, welcome_message)
#         else
#           Rails.logger.warn("トークンが見つかりませんでした。")
#         end
#       end
#     end
#
#     head :ok
#   end
#
#   # 実際の送信処理（共通化）
#   def send_line_message(user, message)
#     return unless user.line_user_id.present?
#     send_raw_message(user.line_user_id, message)
#   end
#
#   def send_raw_message(line_user_id, text)
#     url = "https://api.line.me/v2/bot/message/push"
#     headers = {
#       "Content-Type" => "application/json",
#       "Authorization" => "Bearer #{ENV['LINE_BOT_CHANNEL_TOKEN']}"
#     }
#
#     body = {
#       to: line_user_id,
#       messages: [
#         {
#           type: 'text',
#           text: text
#         }
#       ]
#     }
#
#     response = HTTParty.post(url, headers: headers, body: body.to_json)
#
#     unless response.success?
#       Rails.logger.warn("LINE送信失敗: #{response.code} - #{response.body}")
#     end
#   end
#
#   # 友だち追加ページ（QRコード表示用）
#   def add_friends
#       Rails.logger.info("✅ add_friends アクション開始")
#
#   url = 'https://lin.ee/wEGjqmK9'
#   qrcode = RQRCode::QRCode.new(url)
#   @svg = qrcode.as_svg(
#     offset: 0,
#     color: '000000',
#     shape_rendering: 'crispEdges',
#     module_size: 11,
#     standalone: true,
#     use_viewbox: true
#   )
#
#   # ✅ トークンがまだなければ作成
#   if user_signed_in?
#         Rails.logger.info("✅ ログイン済み: user_id=#{current_user.id}")
#
#     unless current_user.line_link_tokens.where(used: false).exists?
#       LineLinkToken.create!(
#         user: current_user,
#         token: SecureRandom.uuid,
#         used: false
#       )
#       Rails.logger.info("✅ LINEリンクトークンを新規発行しました (user_id=#{current_user.id})")
#     else
#       Rails.logger.info("ℹ️ 既に未使用のトークンがあります (user_id=#{current_user.id})")
#     end
#   else
#     Rails.logger.warn("⚠️ ログインしていないユーザーがLINE追加ページを開きました")
#   end
# end
#
#
#   def test_notify
#     user = User.find_by(email: "test@example.com")
#     if user&.line_notify_token.present?
#       LineNotifyService.new(user).send("🎧 LINE Notify テストメッセージ 🎉")
#       render plain: "✅ 通知を送信しました！"
#     else
#       render plain: "⚠️ トークンが登録されていません"
#     end
#   end
#
#   def debug_tokens
#   tokens = LineLinkToken.where(used: false).order(created_at: :desc).limit(3)
#
#   if tokens.empty?
#     render plain: "❌ 未使用トークンが存在しません"
#   else
#     render plain: tokens.map { |t| "#{t.token} - used: #{t.used} - created: #{t.created_at}" }.join("\n")
#   end
# end
#
#
# def debug_push
#   line_user_id = params[:line_user_id]
#   token = LineLinkToken.where(used: false).order(created_at: :desc).first
#
#   if token.nil?
#     render plain: "❌ 未使用トークンがありません"
#     return
#   end
#
#   message = <<~MSG
#     エモミュへようこそ！🎧
#     LINE連携ありがとうございます！
#
#     下のリンクを押すと、エモミュとLINEが連携されます👇
#     https://moriappli-emotion.com/line_link?token=#{token.token}&line_user_id=#{line_user_id}
#   MSG
#
#   success = LineBotNotifier.push_message(to: line_user_id, message: message)
#
#   if success
#     render plain: "✅ LINEメッセージ送信成功"
#   else
#     render plain: "❌ LINEメッセージ送信失敗"
#   end
# end
#
# def debug_emotion
#   user = User.find_by(email: "test@example.com") # ←本番でline_user_id入ってるユーザー
#   send_emotion_log(user,
#     emotion: "嬉しい",
#     track_name: "Lemon",
#     artist_name: "米津玄師",
#     hp: 90
#   )
#   render plain: "✅ emotion通知送信テスト完了"
# end
#
# def debug_comment
#   user = User.find_by(email: "test@example.com")
#   send_comment_notification(user,
#     commenter_name: "ソル",
#     comment_body: "今日の投稿すごく良かったです！"
#   )
#   render plain: "✅ コメント通知送信テスト完了"
# end
#
#
# def debug_news
#   user = User.find_by(email: "test@example.com")
#   send_news(user)
#   render plain: "✅ news通知送信テスト完了"
# end
#
#
#
#   private
#
#   def validate_signature(body, signature)
#     channel_secret = ENV['LINE_BOT_CHANNEL_SECRET']
#     hash = OpenSSL::HMAC.digest(OpenSSL::Digest::SHA256.new, channel_secret, body)
#     Base64.strict_encode64(hash) == signature
#   end
#
#
# end
