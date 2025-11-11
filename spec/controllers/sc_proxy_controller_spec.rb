# frozen_string_literal: true
require "rails_helper"

RSpec.describe ScProxyController, type: :controller do
  # Net::HTTP の戻り値っぽい簡易ダミー
  class FakeHTTPResponse
    attr_reader :code
    def initialize(code:, body: "", headers: {})
      @code    = code.to_s
      @body    = body
      @headers = headers
    end
    def [](k)                 = @headers[k]
    def body                  = @body
    def to_hash               = @headers
  end

  # Net::HTTP.new を差し替えるための簡易ダミー
  let(:http_double) do
    instance_double(Net::HTTP).tap do |http|
      allow(http).to receive(:use_ssl=)
      allow(http).to receive(:open_timeout=)
      allow(http).to receive(:read_timeout=)
    end
  end

  before do
    # ルーティング（config/routes.rb で resources :sc, only: [] do ... がある前提）
    @routes = Rails.application.routes

    # CSRF を無効化しているので devise 認証等は不要
  end

  describe "私有メソッドのユーティリティ（最小）" do
    it "allowed_sc_host? は許可ドメイン末尾一致で true/false を返す" do
      c = controller
      expect(c.send(:allowed_sc_host?, "api.soundcloud.com")).to be true
      expect(c.send(:allowed_sc_host?, "x.sndcdn.com")).to be true
      expect(c.send(:allowed_sc_host?, "example.com")).to be false
      expect(c.send(:allowed_sc_host?, "")).to be false
    end

    it "sanitize_oauth_token は 'undefined' / 'null' / 空白をはじく" do
      c = controller
      expect(c.send(:sanitize_oauth_token, "  ")).to eq("")
      expect(c.send(:sanitize_oauth_token, "undefined")).to eq("")
      expect(c.send(:sanitize_oauth_token, "NULL")).to eq("")
      expect(c.send(:sanitize_oauth_token, "abc")).to eq("abc")
    end

    it "strip_scheme_prefix は OAuth/Bearer の接頭辞を剥がす" do
      c = controller
      expect(c.send(:strip_scheme_prefix, "OAuth xxx")).to eq("xxx")
      expect(c.send(:strip_scheme_prefix, "Bearer yyy")).to eq("yyy")
      expect(c.send(:strip_scheme_prefix, "zzz")).to eq("zzz")
      expect(c.send(:strip_scheme_prefix, nil)).to eq("")
    end

    it "build_auth_header は接頭辞が無ければ OAuth を付ける" do
      c = controller
      expect(c.send(:build_auth_header, "xxx")).to eq("OAuth xxx")
      expect(c.send(:build_auth_header, "Bearer yyy")).to eq("Bearer yyy")
      expect(c.send(:build_auth_header, "")).to be_nil
      expect(c.send(:build_auth_header, nil)).to be_nil
    end
  end

  describe "GET #resolve" do
    it "url が無ければ 400" do
      get :resolve, params: {}
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body).to include("error" => "missing url")
    end

    it "不正スキームなら 400" do
      get :resolve, params: { url: "ftp://soundcloud.com/x" }
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body).to include("error" => "invalid scheme")
    end

    it "許可外ホストなら 400" do
      get :resolve, params: { url: "https://example.com/x" }
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body["error"]).to eq("forbidden host").or eq("invalid url")
    end

    context "トークン無し（匿名 v2、client_id 経路）" do
      it "http_get_follow の結果をそのまま返し、X-Proxy-V2-Auth=client_id を付与" do
        # client_id が空でも resolve_v2! は動くが、念のため用意
        allow(ENV).to receive(:[]).and_call_original
        allow(ENV).to receive(:[]).with("SOUNDCLOUD_CLIENT_ID").and_return("fake_cid")

        # resolve_v2! 内で呼ばれる http_get_follow を差し替え
        body = { ok: true }.to_json
        fake = FakeHTTPResponse.new(code: 200, body: body, headers: { "content-type" => "application/json" })
        allow_any_instance_of(ScProxyController).to receive(:http_get_follow).and_return(fake)

        get :resolve, params: { url: "https://soundcloud.com/user/track" }

        expect(response).to have_http_status(:ok)
        expect(response.media_type).to eq("application/json")
        expect(response.body).to eq(body)
        expect(response.headers["X-Proxy-V2-Auth"]).to eq("client_id")
      end
    end

    context "トークン有り（v1→成功ルートの簡易疑似）" do
      it "v1 で 302 → 200 track を返したとみなして v2 風 JSONを返す" do
        # Authorization ヘッダを用意（extract_oauth_token 経由）
        request.headers["Authorization"] = "Bearer token123"

        # v1 resolve: 302 Location を返す
        v1_loc = "https://api.soundcloud.com/tracks/12345"
        v1_res = FakeHTTPResponse.new(code: 302, headers: { "location" => v1_loc })

        # v1 track: 200 JSON を返す
        track_json = { id: 12345, title: "T", duration: 1000, user: { "username" => "U" } }.to_json
        v1_track   = FakeHTTPResponse.new(code: 200, body: track_json, headers: { "content-type" => "application/json" })

        # Net::HTTP.new(...).request(...) の2回呼び出しを差し替え
        allow(Net::HTTP).to receive(:new).and_return(http_double)
        allow(http_double).to receive(:request).and_return(v1_res, v1_track)

        get :resolve, params: { url: "https://soundcloud.com/user/track" }

        expect(response).to have_http_status(:ok)
        data = JSON.parse(response.body)
        expect(data["kind"]).to eq("track")
        expect(data["id"]).to eq(12345)
        expect(data["media"]).to be_present
      end
    end
  end

  describe "GET #stream" do
    it "locator 無しは 400" do
      get :stream, params: {}
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body).to include("error" => "missing locator")
    end

    it "不正スキームは 400" do
      get :stream, params: { locator: "ftp://sndcdn.com/..." }
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body).to include("error" => "invalid scheme")
    end

    it "許可外ホストは 400" do
      get :stream, params: { locator: "https://example.com/x" }
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body["error"]).to eq("forbidden host").or eq("invalid locator")
    end

    it "302 Location を受けたら {url: ...} を返す" do
      loc = "https://cf-media.sndcdn.com/xxx/stream.mp3"
      res = FakeHTTPResponse.new(code: 302, headers: { "location" => loc })

      allow(Net::HTTP).to receive(:new).and_return(http_double)
      allow(http_double).to receive(:request).and_return(res)

      get :stream, params: { locator: "https://api.soundcloud.com/tracks/123/stream" }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("url" => loc)
    end

    it "200 成功なら素通し（content-type を維持）" do
      body = "BINARY"
      ok   = FakeHTTPResponse.new(code: 200, body: body, headers: { "content-type" => "application/json" })

      allow(Net::HTTP).to receive(:new).and_return(http_double)
      allow(http_double).to receive(:request).and_return(ok)

      get :stream, params: { locator: "https://api.soundcloud.com/tracks/123/stream" }

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/json")
      expect(response.body).to eq(body)
    end
  end

  describe "レスポンスヘッダ" do
    it "resolve は no-store 系 Cache-Control と Vary を付ける" do
      body = { ok: true }.to_json
      fake = FakeHTTPResponse.new(code: 200, body: body, headers: { "content-type" => "application/json" })
      allow_any_instance_of(ScProxyController).to receive(:http_get_follow).and_return(fake)

      get :resolve, params: { url: "https://soundcloud.com/u/t" }

      expect(response.headers["Cache-Control"]).to include("no-store")
      expect(response.headers["Vary"]).to include("Authorization")
      expect(response.headers["Vary"]).to include("Cookie")
      expect(response.headers["Vary"]).to include("X-SC-OAUTH")
    end
  end

  # --- ここから置き換え（匿名アクションを使わない版）---

describe "extract_oauth_token の各経路（実アクション経由）" do
  let(:locator) { "https://api.soundcloud.com/tracks/123/stream" }

  before do
    # stream 内の Net::HTTP 呼び出しを常に 200 OK で返す
    ok = FakeHTTPResponse.new(
      code: 200,
      body: "{}",
      headers: { "content-type" => "application/json" }
    )
    allow(Net::HTTP).to receive(:new).and_return(http_double)
    allow(http_double).to receive(:request).and_return(ok)
  end

  it "X-SC-OAUTH ヘッダから取得" do
    request.headers["X-SC-OAUTH"] = "abc"
    get :stream, params: { locator: locator }
    expect(response).to have_http_status(:ok)
    expect(response.headers["X-Proxy-Token-From"]).to eq("x_header")
    expect(response.headers["X-Proxy-Token-Present"]).to eq("true")
  end

  it "Authorization から取得" do
    request.headers["Authorization"] = "Bearer xyz"
    get :stream, params: { locator: locator }
    expect(response.headers["X-Proxy-Token-From"]).to eq("authorization")
    expect(response.headers["X-Proxy-Token-Present"]).to eq("true")
  end

  it "クエリから取得" do
    get :stream, params: { locator: locator, oauth: "qqq" }
    expect(response.headers["X-Proxy-Token-From"]).to eq("query")
    expect(response.headers["X-Proxy-Token-Present"]).to eq("true")
  end

  it "Cookie から取得" do
    cookies[:sc_oauth] = "ccc"
    get :stream, params: { locator: locator }
    expect(response.headers["X-Proxy-Token-From"]).to eq("cookie")
    expect(response.headers["X-Proxy-Token-Present"]).to eq("true")
  end

  it "何も無い時は none / present=false" do
    get :stream, params: { locator: locator }
    expect(response.headers["X-Proxy-Token-From"]).to eq("none")
    expect(response.headers["X-Proxy-Token-Present"]).to eq("false")
  end
end

# set_no_cache_headers! の Vary 結合は、resolve が内部で必ず呼ぶので、
# 既存の「レスポンスヘッダ resolve は no-store…Vary…」のテストで十分。
# 匿名アクション版は削除し、必要なら「既存 Vary なしで最低限が付く」ことだけ検証する。

describe "レスポンスヘッダ（no-store / Vary の付与最小確認）" do
  it "resolve は no-store 系と Vary(Authorization/Cookie/X-SC-OAUTH) を付与する" do
    body = { ok: true }.to_json
    fake = FakeHTTPResponse.new(code: 200, body: body, headers: { "content-type" => "application/json" })
    allow_any_instance_of(ScProxyController).to receive(:http_get_follow).and_return(fake)

    get :resolve, params: { url: "https://soundcloud.com/u/t" }

    expect(response).to have_http_status(:ok)
    expect(response.headers["Cache-Control"]).to include("no-store")
    vary = response.headers["Vary"].to_s
    expect(vary).to include("Authorization")
    expect(vary).to include("Cookie")
    expect(vary).to include("X-SC-OAUTH")
  end
end

# --- 置き換えここまで ---

  
end
