# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2025_08_27_142947) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "bookmarks", force: :cascade do |t|
    t.bigint "user_id"
    t.bigint "emotion_log_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["emotion_log_id"], name: "index_bookmarks_on_emotion_log_id"
    t.index ["user_id", "emotion_log_id"], name: "index_bookmarks_on_user_id_and_emotion_log_id", unique: true
    t.index ["user_id"], name: "index_bookmarks_on_user_id"
  end

  create_table "comment_reactions", force: :cascade do |t|
    t.integer "kind"
    t.bigint "user_id", null: false
    t.bigint "comment_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["comment_id"], name: "index_comment_reactions_on_comment_id"
    t.index ["user_id"], name: "index_comment_reactions_on_user_id"
  end

  create_table "comments", force: :cascade do |t|
    t.text "body"
    t.bigint "user_id", null: false
    t.bigint "emotion_log_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "reactions_count", default: 0, null: false
    t.index ["emotion_log_id"], name: "index_comments_on_emotion_log_id"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "emotion_log_tags", force: :cascade do |t|
    t.bigint "emotion_log_id", null: false
    t.bigint "tag_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["emotion_log_id", "tag_id"], name: "index_emotion_log_tags_on_emotion_log_id_and_tag_id", unique: true
    t.index ["emotion_log_id"], name: "index_emotion_log_tags_on_emotion_log_id"
    t.index ["tag_id"], name: "index_emotion_log_tags_on_tag_id"
  end

  create_table "emotion_logs", force: :cascade do |t|
    t.string "emotion"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.date "date"
    t.string "music_url"
    t.bigint "user_id", null: false
    t.string "track_name"
    t.integer "comments_count", default: 0, null: false
    t.string "music_art_url"
    t.index ["user_id"], name: "index_emotion_logs_on_user_id"
  end

  create_table "identities", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "provider"
    t.string "uid"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_identities_on_user_id"
  end

  create_table "line_link_tokens", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "token"
    t.boolean "used"
    t.string "line_user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_line_link_tokens_on_user_id"
  end

  create_table "news", force: :cascade do |t|
    t.string "title"
    t.text "body"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "playlist_items", force: :cascade do |t|
    t.bigint "playlist_id", null: false
    t.bigint "emotion_log_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["emotion_log_id"], name: "index_playlist_items_on_emotion_log_id"
    t.index ["playlist_id", "emotion_log_id"], name: "index_playlist_items_on_playlist_and_emotion_log", unique: true
    t.index ["playlist_id"], name: "index_playlist_items_on_playlist_id"
  end

  create_table "playlists", force: :cascade do |t|
    t.string "name"
    t.bigint "user_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_playlists_on_user_id"
  end

  create_table "push_subscriptions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.text "endpoint"
    t.string "key_p256dh"
    t.string "key_auth"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_push_subscriptions_on_user_id"
  end

  create_table "sessions", force: :cascade do |t|
    t.string "session_id", null: false
    t.text "data"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["session_id"], name: "index_sessions_on_session_id", unique: true
    t.index ["updated_at"], name: "index_sessions_on_updated_at"
  end

  create_table "tags", force: :cascade do |t|
    t.string "name"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_tags_on_name", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "provider", default: "email", null: false
    t.string "uid", null: false
    t.string "name"
    t.string "gender"
    t.integer "age"
    t.string "soundcloud_uid"
    t.string "soundcloud_token"
    t.string "soundcloud_refresh_token"
    t.datetime "soundcloud_token_expires_at"
    t.boolean "profile_completed", default: false, null: false
    t.string "avatar_url"
    t.string "line_notify_token"
    t.string "line_user_id"
    t.boolean "line_notification_enabled"
    t.boolean "push_enabled", default: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "bookmarks", "emotion_logs"
  add_foreign_key "bookmarks", "users"
  add_foreign_key "comment_reactions", "comments"
  add_foreign_key "comment_reactions", "users"
  add_foreign_key "comments", "emotion_logs"
  add_foreign_key "comments", "users"
  add_foreign_key "emotion_log_tags", "emotion_logs"
  add_foreign_key "emotion_log_tags", "tags"
  add_foreign_key "emotion_logs", "users"
  add_foreign_key "identities", "users"
  add_foreign_key "line_link_tokens", "users"
  add_foreign_key "playlist_items", "emotion_logs", name: "fk_playlist_items_emotion_logs_cascade", on_delete: :cascade
  add_foreign_key "playlist_items", "playlists"
  add_foreign_key "playlists", "users"
  add_foreign_key "push_subscriptions", "users"
end
