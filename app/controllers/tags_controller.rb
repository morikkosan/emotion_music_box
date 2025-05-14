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

    tags = Tag.where("name ILIKE ?", "%#{query}%").limit(10)
    render json: tags.select(:name)  # 例: [{ name: "rock" }, { name: "pop" }]
  end
end
