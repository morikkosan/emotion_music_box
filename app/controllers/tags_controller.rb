# app/controllers/tags_controller.rb
class TagsController < ApplicationController
  def index
    if params[:q].present?
      tags = Tag.where("name ILIKE ?", "#{params[:q]}%").limit(10)
    else
      tags = Tag.none
    end

    render json: tags.pluck(:name)
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
