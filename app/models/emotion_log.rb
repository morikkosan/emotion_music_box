# app/models/emotion_log.rb
require "cgi"

class EmotionLog < ApplicationRecord
  belongs_to :user
  has_many :bookmarks, dependent: :destroy
  has_many :bookmark_users, through: :bookmarks, source: :user
  has_many :comments,  dependent: :destroy
  has_many :emotion_log_tags, dependent: :destroy
  has_many :tags, through: :emotion_log_tags

  # タグ名をまとめて受け取るための仮属性
  attr_accessor :tag_names
  after_save :assign_tags

  # バリデーション
  validates :date, presence: true
  validates :emotion, presence: true
  validates :description, presence: true, length: { maximum: 50 }
  validates :music_url, presence: true
  validate  :date_cannot_be_in_the_future
  validate  :description_must_be_polite

  # 「音楽URLが変更されたとき」にアートワークを自動取得する
  before_save :set_music_art_url, if: -> { music_url_changed? && music_url.present? }

  # スコープ（例：今日／今週／今月の記録を絞り込むなど）
  scope :for_today,     -> { where(date: Date.current) }
  scope :for_week,      -> { where(date: 1.week.ago.to_date..Date.current) }
  scope :for_month,     -> { where(date: 1.month.ago.to_date..Date.current) }
  scope :for_half_year, -> { where(date: 6.months.ago.to_date..Date.current) }
  scope :for_year,      -> { where(date: 1.year.ago.to_date..Date.current) }

  scope :newest, -> { order(created_at: :desc) }
  scope :oldest, -> { order(created_at: :asc) }

  scope :by_bookmarks, -> {
    left_joins(:bookmarks, :user)
      .select(
        "emotion_logs.*, " \
        "users.id as user_id, " \
        "users.name as user_name, " \
        "users.avatar_url as user_avatar_url, " \
        "COUNT(bookmarks.id) AS bookmarks_count"
      )
      .group("emotion_logs.id, users.id, users.name, users.avatar_url")
      .order("COUNT(bookmarks.id) DESC")
  }

  scope :by_comments, -> {
    left_joins(:comments, :user)
      .select(
        "emotion_logs.*, " \
        "users.id as user_id, " \
        "users.name as user_name, " \
        "users.avatar_url as user_avatar_url, " \
        "COUNT(comments.id) AS comments_count"
      )
      .group("emotion_logs.id, users.id, users.name, users.avatar_url")
      .order("COUNT(comments.id) DESC")
  }

  # ==== モデル内メソッド ====

  # SoundCloud の oEmbed からジャケット（サムネイル）URLを取得
  def fetch_music_art_url_from_soundcloud
    return nil unless music_url&.include?("soundcloud.com")

    # oEmbed のエンドポイント（認証不要）
    # 例: https://soundcloud.com/oembed?format=json&url=<TRACK_URL>
    oembed_url = "https://soundcloud.com/oembed?format=json&url=#{CGI.escape(music_url)}"

    response = HTTParty.get(oembed_url)
    return nil unless response.success?

    # レスポンス例:
    # {
    #   "version"=>"1.0",
    #   "type"=>"rich",
    #   "width"=>600,
    #   "height"=>400,
    #   "title"=>"Track Title",
    #   "author_name"=>"Artist Name",
    #   "author_url"=>"https://soundcloud.com/artist",
    #   "provider_name"=>"SoundCloud",
    #   "provider_url"=>"https://soundcloud.com",
    #   "thumbnail_url"=>"https://i1.sndcdn.com/artworks-XXXXXX-large.jpg",
    #   ...
    # }
    thumbnail = response.parsed_response["thumbnail_url"]
    # "-large" を "-t500x500" に置き換えてより高解像度版を取得
    thumbnail&.gsub("-large", "-t500x500")
  rescue StandardError
    nil
  end

  # before_save で呼び出される：artwork_url が取れればそちらを設定
  # （oEmbed のみで十分なら ユーザーアイコン取得は省略可）
  def set_music_art_url
    fetched = fetch_music_art_url_from_soundcloud
    self.music_art_url = fetched if fetched.present?
  end

  private

  # 日付が未来にならないか検証
  def date_cannot_be_in_the_future
    if date.present? && date > Date.current
      errors.add(:date, "は未来の日付を選択できません")
    end
  end

  # description に過激な表現や特殊文字（記号）が含まれていないか検証
  def description_must_be_polite
    return if description.blank?

    forbidden_words = %w[死ね 殺す ぶっ殺す バカ やばい キモ うざ ちんこ まんこ]

    if forbidden_words.any? { |w| description.include?(w) }
      errors.add(:description, "に過激な表現が含まれています。やさしい言葉でお願いします。")
    end

    if description =~ /[!@#$%^&*()_+={}\[\]:;"'<>,.?\/\\|-]/
      errors.add(:description, "に記号や特殊文字は使用できません。")
    end
  end

  # タグを登録する（カンマ区切りで受け取った tag_names を保存）
  def assign_tags
    return if tag_names.blank?

    self.tags = tag_names.split(",").map do |tag_name|
      Tag.find_or_create_by(name: tag_name.strip)
    end
  end
end
