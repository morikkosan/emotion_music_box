class CommentsController < ApplicationController
  before_action :set_comment, only: %i[update destroy toggle_reaction]

 # app/controllers/comments_controller.rb
def create
  @emotion_log = EmotionLog.find(params[:emotion_log_id])
  @comment     = @emotion_log.comments.create!(body: params[:body], user: current_user)

  respond_to do |format|
    format.turbo_stream                      # create.turbo_stream.erb を使う
    format.html { redirect_to emotion_log_path(@emotion_log) }  # ← これを追加
  end
end


  def update
    @comment.update!(body: params[:body]) if @comment.user == current_user
  end

  def destroy
    @comment = current_user.comments.find_by(id: params[:id])
    return head :not_found unless @comment          # ← 既に無いなら 404 だけ返す

    @emotion_log = @comment.emotion_log
    @comment.destroy

    respond_to do |format|
      format.turbo_stream   # destroy.turbo_stream.erb
      format.html { redirect_to emotion_log_path(@emotion_log) }
    end
  end

  def toggle_reaction
    kind = params[:kind].to_sym
    react = @comment.comment_reactions.find_by(user: current_user, kind:)
    react ? react.destroy : @comment.comment_reactions.create!(user: current_user, kind:)
    @kind = kind                                    # turbo_stream で使う
  end

  private
  def set_comment; @comment = Comment.find(params[:id]); end
end
