# frozen_string_literal: true

module Paginatable
  # Kaminari向けの安全なページネーション。
  # group/aggregate を含む relation でも総件数を DISTINCT で正しく数える。
  #
  # - relation: ActiveRecord::Relation（任意のモデルOK）
  # - per: 1ページ件数
  # - id_column: どうしてもテーブル別名などで自動推測が効かない場合に明示指定（例: "posts_alias.id"）
  #
  def paginate_with_total_fix(relation, per:, id_column: nil)
    page = params[:page].to_i
    page = 1 if page <= 0

    if relation.group_values.present?
      # 基本は relation のモデルからテーブル名と PK を推測
      table = relation.klass.table_name
      pk    = relation.klass.primary_key
      conn  = relation.klass.connection

      # 例: `"emotion_logs"."id"`
      inferred_id_sql = "#{conn.quote_table_name(table)}.#{conn.quote_column_name(pk)}"
      id_sql = id_column.presence || inferred_id_sql

      total = relation
                .reselect(id_sql)
                .unscope(:order, :group, :select)
                .distinct
                .count

      items = relation.limit(per).offset((page - 1) * per).to_a
      Kaminari.paginate_array(items, total_count: total).page(page).per(per)
    else
      relation.page(page).per(per)
    end
  end
end
