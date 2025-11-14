# app/controllers/concerns/api_rate_limitable.rb
module ApiRateLimitable
  extend ActiveSupport::Concern

  private

  # サービスクラスのラッパー
  def api_rate_limiter
    ApiRequestLimiter.new(session)
  end

  # 再生（stream）用のレート制限
  # 429 Too Many Requests を返して処理を中断する
  def enforce_stream_limit!
    allowed = api_rate_limiter.allow_stream_request!

    return if allowed

    render json: {
      error: "今日の再生リクエスト上限に達しました。日を改めてください。"
    }, status: :too_many_requests
  end

  # 検索（tracks）用のレート制限
  # 429 Too Many Requests を返して処理を中断する
  def enforce_search_limit!
    allowed = api_rate_limiter.allow_search_request!

    return if allowed

    render json: {
      error: "検索リクエストの上限に達しました。しばらく時間を空けてから再度お試しください。"
    }, status: :too_many_requests
  end
end
