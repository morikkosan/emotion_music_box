# app/services/api_request_limiter.rb
class ApiRequestLimiter
  # ENVが未設定でもアプリが落ちないよう、デフォルト値を入れておく
  STREAM_DAILY_LIMIT  = ENV.fetch("EMOMU_STREAM_DAILY_LIMIT", "60").to_i
  SEARCH_DAILY_LIMIT  = ENV.fetch("EMOMU_SEARCH_DAILY_LIMIT", "250").to_i
  SEARCH_HOURLY_LIMIT = ENV.fetch("EMOMU_SEARCH_HOURLY_LIMIT", "30").to_i

  # @param session [ActionDispatch::Request::Session]
  # @param now [Time] テストしやすいよう注入可能に
  def initialize(session, now: Time.zone.now)
    @session = session
    @now     = now

    # 初期化（nilだと << や []= ができないので、必ずハッシュにしておく）
    @session[:api_usage] ||= {}
  end

  # ==== 再生（stream）用：1日上限だけ見る ==========================
  #
  # 戻り値: true なら許可、false なら上限超過
  #
  def allow_stream_request!
    daily_key = daily_key_for(:stream)
    increment_and_check!(daily_key, STREAM_DAILY_LIMIT)
  end

  # ==== 検索（tracks）用：日次 + 時間あたりの両方を見る ============
  #
  # 戻り値: true なら許可、false ならどちらかの上限超過
  #
  def allow_search_request!
    daily_key  = daily_key_for(:search)
    hourly_key = hourly_key_for(:search)

    daily_ok  = increment_and_check!(daily_key,  SEARCH_DAILY_LIMIT)
    hourly_ok = increment_and_check!(hourly_key, SEARCH_HOURLY_LIMIT)

    daily_ok && hourly_ok
  end

  private

  # kind: :stream / :search
  # 例: "stream_daily_20251114"
  def daily_key_for(kind)
    date_str = @now.strftime("%Y%m%d")
    "#{kind}_daily_#{date_str}"
  end

  # 例: "search_hourly_2025111421" （2025/11/14 21時台）
  def hourly_key_for(kind)
    hour_str = @now.strftime("%Y%m%d%H")
    "#{kind}_hourly_#{hour_str}"
  end

  # カウンタを1増やして、limit以内かどうかを返す
  #
  # @param key [String]
  # @param limit [Integer]
  # @return [Boolean]
  #
  def increment_and_check!(key, limit)
    usage = @session[:api_usage]

    usage[key] ||= 0
    usage[key]  += 1

    usage[key] <= limit
  end
end
