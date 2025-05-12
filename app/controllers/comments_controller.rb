class CommentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_emotion_log, only: [:create]
  before_action :set_comment,      only: [:edit, :update, :destroy, :toggle_reaction]

  # POST /emotion_logs/:emotion_log_id/comments
  def create
    @comment = @emotion_log.comments.build(
      body: params[:body],
      user: current_user
    )

    respond_to do |format|
      if @comment.save
        format.turbo_stream   # app/views/comments/create.turbo_stream.erb
        format.html { redirect_to emotion_log_path(@emotion_log) }
      else
        format.html { redirect_to emotion_log_path(@emotion_log), alert: 'コメントの投稿に失敗しました' }
      end
    end
  end

  # GET /comments/:id/edit
  def edit
    respond_to do |format|
      format.html            # app/views/comments/edit.html.erb
      format.turbo_stream    # app/views/comments/edit.turbo_stream.erb (optional)
    end
  end

  # PATCH /comments/:id
  # app/controllers/comments_controller.rb (更新アクション)
# PATCH /comments/:id
# app/controllers/comments_controller.rb
# app/controllers/comments_controller.rb
def update
  return head(:forbidden) unless @comment.user == current_user

  if @comment.update(body: params.dig(:comment, :body) || params[:body])
    render turbo_stream: [
      turbo_stream.replace(
        "comment_#{@comment.id}",
        partial:  "comments/comment",
        locals:   { comment: @comment }
      ),
      turbo_stream.append(
  "flash",
  "<div class=\"cyber-popup text-center\" role=\"alert\">コメントを更新しました</div>".html_safe
),
      turbo_stream.after(
        "flash",
        <<~JS
          <script>
            setTimeout(() => {
              const f = document.getElementById("flash");
              if (f) f.innerHTML = "";
            }, 2000);
          </script>
        JS
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

  emotion_log = @comment.emotion_log  # ← ★削除前に取得！

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
        turbo_stream.after(
          "flash",
          <<~JS
            <script>
              setTimeout(() => {
                const f = document.getElementById("flash");
                if (f) f.innerHTML = "";
              }, 2000);
            </script>
          JS
        )
      ]
    end
    format.html { redirect_to emotion_log_path(emotion_log), notice: 'コメントを削除しました' }
  end
end



  # POST /comments/:id/toggle_reaction
  def toggle_reaction
    kind     = params[:kind].to_sym
    reaction = @comment.comment_reactions.find_by(user: current_user, kind: kind)

    if reaction
      reaction.destroy
    else
      @comment.comment_reactions.create!(user: current_user, kind: kind)
    end

    head :no_content
  end

  private

  def set_emotion_log
    @emotion_log = EmotionLog.find(params[:emotion_log_id]) if params[:emotion_log_id]
  end

  def set_comment
    @comment = Comment.includes(:user, :comment_reactions).find_by(id: params[:id])
  end
end
