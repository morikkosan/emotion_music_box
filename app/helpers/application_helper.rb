# app/helpers/application_helper.rb
module ApplicationHelper
  # 現在のURLから ?以降（クエリ）と #以降（フラグメント）を取り除いた“正規化URL”を返す
  def canonical_url
    url = request.original_url
    uri = URI.parse(url)
    uri.query = nil
    uri.fragment = nil
    uri.to_s
  end
end
