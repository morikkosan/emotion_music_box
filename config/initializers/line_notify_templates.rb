# config/initializers/line_notify_templates.rb

LINE_NOTIFY_EMOTION_LOG = <<~MSG.freeze
  今日も記録、おつかれさま！がんばったね！！
  「%{emotion}」で「%{track_name} / %{artist_name}」を登録しました。

  HPゲージは今%{hp}％。
  明日も負けないように頑張ろう！！
MSG

LINE_NOTIFY_REACTION = <<~MSG.freeze
  %{user_name}さんがあなたの投稿に
  %{bookmark}（%{comment_reaction}）をしました。

  共感者として共に戦っていこう！！
MSG

LINE_NOTIFY_NEWS = "アプリに新しい機能が追加されました！\n詳細はWEBでご確認ください。".freeze
