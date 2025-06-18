user = User.find_or_create_by!(email: 'test@example.com') do |u|
  u.password = 'password'
  u.name = 'Test User'
  u.uid = 'test_User'
  u.provider = "email"
  u.profile_completed = true
end

tag = Tag.find_or_create_by!(name: "happy")

emotion_log = EmotionLog.find_or_create_by!(user: user, emotion: "happy", date: Date.today) do |log|
  log.description = "CI用のテスト投稿"
  log.track_name = "Test Song"
  log.music_url = "https://example.com/art.jpg"
end

EmotionLogTag.find_or_create_by!(emotion_log: emotion_log, tag: tag)

comment = Comment.find_or_create_by!(user: user, emotion_log: emotion_log, body: "テキストコメント")

CommentReaction.find_or_create_by!(user: user, comment: comment, kind: 1)

playlist = Playlist.find_or_create_by!(user: user, name: "Test Playlist")

PlaylistItem.find_or_create_by!(playlist: playlist, emotion_log: emotion_log)

Bookmark.find_or_create_by!(user: user, emotion_log: emotion_log)
