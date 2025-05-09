# app/controllers/comments_controller.rb
class CommentsController < ApplicationController
  before_action :authenticate_user!
  before_action :set_emotion_log, only: [:create]

  # POST /emotion_logs/:emotion_log_id/comments
  # app/controllers/comments_controller.rb
# app/controllers/comments_controller.rb
def create
  @comment = @emotion_log.comments.build(
    body: params[:body],
    user: current_user
  )

  respond_to do |format|
    if @comment.save
      format.turbo_stream   # create.turbo_stream.erb で新しいコメントを描画
      format.html { redirect_to emotion_log_path(@emotion_log) }
    else
      format.html { redirect_to emotion_log_path(@emotion_log), alert: "コメントの投稿に失敗しました" }
    end
  end
end


  # GET /comments/:id/edit
  def edit
    respond_to do |format|
      format.html             # app/views/comments/edit.html.erb
      format.turbo_stream     # edit.turbo_stream.erb を置くなら
    end
  end

  # PATCH /comments/:id
  def update
    return head(:forbidden) unless @comment.user == current_user

    respond_to do |format|
      if @comment.update(comment_params)
        format.turbo_stream   # update.turbo_stream.erb で差し替え
        format.html { redirect_to emotion_log_path(@comment.emotion_log), notice: 'コメントを更新しました' }
      else
        format.html { render :edit }
      end
    end
  end

  # DELETE /comments/:id
  def destroy
    # 自分のコメントだけを探す → 存在しなければ 404
    @comment = current_user.comments.find_by(id: params[:id])
    return head(:not_found) unless @comment

    @emotion_log = @comment.emotion_log
    @comment.destroy

    respond_to do |format|
      format.turbo_stream   # destroy.turbo_stream.erb
      format.html { redirect_to emotion_log_path(@emotion_log), notice: 'コメントを削除しました' }
    end
  end

  # POST /comments/:id/toggle_reaction
  def toggle_reaction
    kind = params[:kind].to_sym
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
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
  end

  def set_comment
    # 他アクション（edit/update/toggle_reaction）用に一般ロード
    @comment = Comment.includes(:user, :comment_reactions).find_by(id: params[:id])
  end

end
