# frozen_string_literal: true

class EmotionLogQuery
  def initialize(relation, params, default_sort: "new")
    @relation     = relation
    @params       = params
    @default_sort = default_sort
  end

  def call
    rel = apply_sort(@relation)
    rel = apply_period(rel)
    rel
  end

  private

  def apply_sort(rel)
    sort_param = @params[:sort].presence || @default_sort
    case sort_param
    when "new"      then rel.newest
    when "old"      then rel.oldest
    when "likes"    then rel.by_bookmarks
    when "comments" then rel.by_comments
    else rel
    end
  end

  def apply_period(rel)
    case @params[:period]
    when "today"    then rel.for_today
    when "week"     then rel.for_week
    when "month"    then rel.for_month
    when "halfyear" then rel.for_half_year
    when "year"     then rel.for_year
    else rel
    end
  end
end
