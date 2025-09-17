class CommentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_emotion_log, only: [:create]
  before_action :set_comment, only: [:edit, :update, :destroy, :toggle_reaction]
  before_action :authorize_comment_owner, only: [:update, :destroy]

  def create
    @comment = @emotion_log.comments.build(comment_params.merge(user: current_user))

    respond_to do |format|
      if @comment.save
        reload_comment!
        notify_log_owner(@comment)
        format.turbo_stream
        format.html { redirect_to emotion_log_path(@emotion_log) }
      else
        format.html { redirect_to emotion_log_path(@emotion_log), alert: "コメントの投稿に失敗しました" }
      end
    end
  end

  def edit
    respond_to(&:turbo_stream)
  end

  def update
    if @comment.update(comment_params)
      reload_comment!
      render turbo_stream: [
        turbo_stream.replace("comment_#{@comment.id}", partial: "comments/comment", locals: { comment: @comment }),
        render_flash_message("コメントを更新しました")
      ]
    else
      redirect_to emotion_log_path(@comment.emotion_log), alert: "コメントの更新に失敗しました"
    end
  end

  def destroy
    emotion_log = @comment.emotion_log
    @comment.destroy
    render turbo_stream: [
      turbo_stream.remove("comment_#{@comment.id}"),
      turbo_stream.replace("comment-count", partial: "emotion_logs/comment_count", locals: { emotion_log: emotion_log }),
      render_flash_message("コメントを削除しました")
    ]
  end

  def toggle_reaction
    kind = params[:kind].to_sym
    reaction = @comment.comment_reactions.find_by(user: current_user, kind: kind)

    action =
      if reaction
        reaction.destroy
        "removed"
      else
        @comment.comment_reactions.create!(user: current_user, kind: kind)
        notify_comment_owner(@comment, kind)
        "added"
      end

    render json: {
      status: "ok",
      action: action,
      current_reaction_kind: @comment.comment_reactions.find_by(user: current_user)&.kind
    }
  end

  private

  def comment_params
    params.require(:comment).permit(:body)
  end

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
  end

  def set_comment
    @comment = Comment.includes(:user, :comment_reactions).find(params[:id])
  end

  def authorize_comment_owner
    head :forbidden unless @comment.user == current_user
  end

  def reload_comment!
    @comment = Comment.includes(:user, :comment_reactions).find(@comment.id)
  end

  def render_flash_message(message)
    turbo_stream.append("flash", "<div class='cyber-popup text-center' role='alert'>#{ERB::Util.html_escape(message)}</div>".html_safe)
  end

  def notify_log_owner(comment)
    owner = comment.emotion_log.user
    return if owner == current_user || !owner.push_enabled?

    PushNotifier.send_comment_notification(owner, commenter_name: current_user.name, comment_body: comment.body)
  end

  def notify_comment_owner(comment, kind)
    owner = comment.user
    return if owner == current_user || owner.push_subscription.blank?

    PushNotifier.send_reaction_notification(owner, reactor_name: current_user.name, comment_body: comment.body, reaction_kind: kind.to_s)
  end
end
