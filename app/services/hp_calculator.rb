# frozen_string_literal: true

class HpCalculator
  EMOTION_TO_PERCENT = {
    "限界"       => 0,
    "イライラ"   => 30,
    "いつも通り" => 50,
    "気分良い"   => 70,
    "最高"       => 100
  }.freeze

  EMOTION_TO_DELTA = {
    "最高"       => 50,
    "気分良い"   => 30,
    "いつも通り" => 0,
    "イライラ"   => -30,
    "限界"       => -50
  }.freeze

  # 感情 → 0..100
  def self.percentage(emotion)
    EMOTION_TO_PERCENT.fetch(emotion, 50)
  end

  # 0..100 → 感情
  def self.from_hp(hp)
    case hp
    when 0..1    then "限界"
    when 2..25   then "イライラ"
    when 26..50  then "いつも通り"
    when 51..70  then "気分良い"
    when 71..100 then "最高"
    else "いつも通り"
    end
  end

  # 感情 → 差分（±）
  def self.delta(emotion)
    EMOTION_TO_DELTA.fetch(emotion, 0)
  end
end
