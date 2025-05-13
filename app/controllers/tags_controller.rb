class TagsController < ApplicationController
  def search
    query = params[:q].to_s.strip

    tags = Tag.where("name ILIKE ?", "%#{query}%").limit(10)
    render json: tags.select(:name)  # 例: [{ name: "rock" }, { name: "pop" }]
  end
end
