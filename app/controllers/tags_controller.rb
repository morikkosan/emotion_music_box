class TagsController < ApplicationController
  def index
    if params[:q].present?
      q = params[:q].to_s.strip

      tags = Tag.where("name ILIKE ?", "#{q}%").limit(10)

      # ★ ここで「小文字にそろえて」「重複を消す」
      names = tags.pluck(:name)
                  .map { |n| n.downcase } # → ["rock", "rock"]
                  .uniq                    # → ["rock"]
    else
      names = []
    end

    render json: names
  end

  def search
    query = params[:q].to_s.strip

    # ★ ここで 2文字未満は絶対に返さない
    if query.length < 2
      render json: []
      return
    end

    # ★ 先頭一致（「あに」→「アニメ」など）
    tags = Tag.where("name ILIKE ?", "#{query}%").limit(10)

    render json: tags.select(:name)  # [{ name: "rock" }, { name: "pop" }]
  end
end
