import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "tags", "suggestions", "hidden"]

  connect() {
    console.log("🟢 tag-input controller connected")
    this.selectedTags = []

    // 既存タグがあれば初期セットしてバッジ表示
    const initialTagsString = this.hiddenTarget.value
    if (initialTagsString) {
      this.selectedTags = initialTagsString.split(",").map(t => t.trim()).filter(Boolean)
    }

    this._renderTags()
    this.hiddenTarget.value = this.selectedTags.join(",")
  }

  keydown(event) {
    if (event.key !== "Enter") return
    event.preventDefault()

    const value = this.inputTarget.value.trim()

    // ✅ バリデーション
    if (!value) return this._clearInput()

    if (this.selectedTags.includes(value)) {
      alert("同じタグは追加できません")
      return this._clearInput()
    }

    if (this.selectedTags.length >= 3) {
      alert("タグは最大3つまでです")
      return this._clearInput()
    }

    if (value.length > 10) {
      alert("タグは10文字以内で入力してください")
      return this._clearInput()
    }

    if (/[^a-zA-Z0-9ぁ-んァ-ン一-龥ー]/.test(value)) {
      alert("記号や特殊文字は使えません")
      return this._clearInput()
    }

    this._addTag(value)
    this._clearInput()
  }

  filterSuggestions() {
    const query = this.inputTarget.value.trim()
    if (!query) return this.clearSuggestions()

    fetch(`/tags/search?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(data => {
        this.suggestionsTarget.innerHTML = ""
        data.forEach(tag => {
          const option = document.createElement("div")
          option.classList.add("dropdown-item")
          option.textContent = tag.name
          option.addEventListener("click", () => {
            this._addTag(tag.name)
            this._clearInput()
          })
          this.suggestionsTarget.appendChild(option)
        })
      })
  }

  _addTag(tag) {
    this.selectedTags.push(tag)
    this._renderTags()
    this.hiddenTarget.value = this.selectedTags.join(",")
  }

  _renderTags() {
    this.tagsTarget.innerHTML = ""
    this.selectedTags.forEach(tag => {
      const badge = document.createElement("span")
      badge.classList.add("badge", "bg-info", "text-dark", "me-1", "mb-1")
      badge.textContent = tag

      const removeBtn = document.createElement("button")
      removeBtn.type = "button"
      removeBtn.classList.add("btn-close", "btn-close-white", "ms-2", "small")
      removeBtn.setAttribute("aria-label", "Remove")
      removeBtn.addEventListener("click", () => {
        this.selectedTags = this.selectedTags.filter(t => t !== tag)
        this._renderTags()
        this.hiddenTarget.value = this.selectedTags.join(",")
      })

      badge.appendChild(removeBtn)
      this.tagsTarget.appendChild(badge)
    })
  }

  clearSuggestions() {
    this.suggestionsTarget.innerHTML = ""
  }

  _clearInput() {
    this.inputTarget.value = ""
    this.clearSuggestions()
  }
}
