class CommentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_emotion_log, only: [:create]
  before_action :set_comment, only: [:edit, :update, :destroy, :toggle_reaction]

  # POST /emotion_logs/:emotion_log_id/comments
  def create
    @comment = @emotion_log.comments.build(
      body: params[:body],
      user: current_user
    )

    respond_to do |format|
      if @comment.save
        # ← 🔧 ここで再取得して関連も読み込む（特に comment_reactions）
        @comment = Comment.includes(:user, :comment_reactions).find(@comment.id)

        # ✅ コメントされた投稿の所有者が自分以外なら通知
        log_owner = @emotion_log.user
        if log_owner != current_user
          # LINE通知
          # if log_owner.line_user_id.present?
          #   LineBotController.new.send_comment_notification(
          #     log_owner,
          #     commenter_name: current_user.name,
          #     comment_body: @comment.body
          #   )
          # end

          # WebPush通知
          # WebPush通知
          if log_owner.push_enabled? && log_owner.push_subscription.present?
            PushNotifier.send_comment_notification(
              log_owner,
              commenter_name: current_user.name,
              comment_body: @comment.body
            )
          end

        end

        format.turbo_stream
        format.html { redirect_to emotion_log_path(@emotion_log) }
      else
        format.html { redirect_to emotion_log_path(@emotion_log), alert: "コメントの投稿に失敗しました" }
      end
    end
  end

  # GET /comments/:id/edit
  def edit
    respond_to do |format|
      format.html
      format.turbo_stream
    end
  end

  # PATCH /comments/:id
  def update
  return head(:forbidden) unless @comment.user == current_user

  if @comment.update(body: params.dig(:comment, :body) || params[:body])
    @comment = Comment.includes(:user, :comment_reactions).find(@comment.id)

    render turbo_stream: [
  turbo_stream.replace(
    "comment_#{@comment.id}",
    partial: "comments/comment",
    locals: { comment: @comment }
  ),
  turbo_stream.append(
    "flash",
    "<div class=\"cyber-popup text-center\" role=\"alert\">コメントを更新しました</div>".html_safe
  ),
  turbo_stream.append(
    "flash",
    "<div data-controller=\"comment-update\"></div>".html_safe
  )
]

  else
    redirect_to emotion_log_path(@comment.emotion_log), alert: "コメントの更新に失敗しました"
  end
end


  # DELETE /comments/:id
  def destroy
  return head(:not_found) unless @comment
  return head(:forbidden) unless @comment.user == current_user

  emotion_log = @comment.emotion_log
  @comment.destroy

  respond_to do |format|
    format.turbo_stream do
      render turbo_stream: [
        turbo_stream.remove("comment_#{@comment.id}"),
        turbo_stream.replace(
          "comment-count",
          partial: "emotion_logs/comment_count",
          locals: { emotion_log: emotion_log }
        ),
        turbo_stream.append(
          "flash",
          "<div class=\"cyber-popup text-center\" role=\"alert\">コメントを削除しました</div>".html_safe
        ),
        turbo_stream.append(
          "flash",
          "<div data-controller=\"comment-update\"></div>".html_safe
        )
      ]
    end
    format.html { redirect_to emotion_log_path(emotion_log), notice: "コメントを削除しました" }
  end
end


  # POST /comments/:id/toggle_reaction
  def toggle_reaction
    kind = params[:kind].to_sym
    comment = @comment

    reaction = comment.comment_reactions.find_by(user: current_user, kind: kind)
    if reaction
      reaction.destroy
      action = "removed"
    else
      comment.comment_reactions.create!(user: current_user, kind: kind)
      action = "added"

      # ✅ コメント主が自分以外なら通知
      if comment.user != current_user
        # LINE通知
        # if comment.user.line_user_id.present?
        #   LineBotController.new.send_reaction(
        #     comment.user,
        #     user_name: current_user.name,
        #     bookmark: comment.emotion_log&.track_name || "あなたの投稿",
        #     comment_reaction: kind.to_s
        #   )
        # end
        # WebPush通知
        if comment.user.push_subscription.present?
          PushNotifier.send_reaction_notification(
            comment.user,
            reactor_name: current_user.name,
            comment_body: comment.body,
            reaction_kind: kind.to_s
          )
        end
      end
    end

    current_kind = comment.comment_reactions.find_by(user: current_user)&.kind

    render json: {
      status: "ok",
      action: action,
      current_reaction_kind: current_kind
    }
  end

  private

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:emotion_log_id]) if params[:emotion_log_id]
  end

  def set_comment
    @comment = Comment.includes(:user, :comment_reactions).find_by(id: params[:id])
  end
end
