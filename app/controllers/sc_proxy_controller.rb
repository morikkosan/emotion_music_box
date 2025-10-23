class ScProxyController < ApplicationController
  skip_before_action :verify_authenticity_token
  SC_V2 = "https://api-v2.soundcloud.com".freeze

  def resolve
    track_url = params[:url].to_s
    cid = ENV.fetch("SOUNDCLOUD_CLIENT_ID")
    return render json: { error: "missing url" }, status: 400 if track_url.blank?
    sc_url = "#{SC_V2}/resolve?url=#{CGI.escape(track_url)}&client_id=#{CGI.escape(cid)}"
    Rails.logger.info("[sc_proxy][resolve] GET #{sc_url}")
    forward_json(sc_url)
  end

  def stream
    locator = params[:locator].to_s
    cid = ENV.fetch("SOUNDCLOUD_CLIENT_ID")
    return render json: { error: "missing locator" }, status: 400 if locator.blank?
    sc_url = "#{locator}#{locator.include?('?') ? '&' : '?'}client_id=#{CGI.escape(cid)}"
    Rails.logger.info("[sc_proxy][stream] GET #{sc_url}")
    forward_json(sc_url)
  end

  private

  def forward_json(url)
    resp = Faraday.get(url) do |f|
      f.headers["Accept"] = "application/json"
      f.headers["Referrer-Policy"] = "no-referrer"
    end
    Rails.logger.info("[sc_proxy] status=#{resp.status} len=#{resp.body&.bytesize}")
    response.set_header("Cache-Control", "no-store") # ← 重要：署名URLの鮮度維持
    render json: JSON.parse(resp.body), status: resp.status
  rescue => e
    Rails.logger.warn("[sc_proxy] #{e.class}: #{e.message}")
    render json: { error: "proxy_error" }, status: 502
  end
end
