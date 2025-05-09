class CommentsController < ApplicationController
  before_action :set_comment, only: %i[update destroy toggle_reaction]

  def create
    @emotion_log = EmotionLog.find(params[:emotion_log_id])
    @comment     = @emotion_log.comments.create!(body: params[:body], user: current_user)
  end

  def update
    @comment.update!(body: params[:body]) if @comment.user == current_user
  end

  def destroy
    @comment.destroy if @comment.user == current_user
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
