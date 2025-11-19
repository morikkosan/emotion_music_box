# lib/rack/x_robots_tag.rb
module Rack
  class XRobotsTag
    def initialize(app)
      @app = app
    end

    def call(env)
      status, headers, body = @app.call(env)
      code = status.to_i
      # 4xx/5xx には noindex, nofollow を必ず付ける（既に明示されていたら尊重）
      if code >= 400 && code < 600
        headers["X-Robots-Tag"] ||= "noindex, nofollow"
      end
      [ status, headers, body ]
    end
  end
end
