// app/javascript/controllers/tag_input_controller.js

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "tags", "suggestions", "hidden"]

  connect() {
      console.log("🟢 tag-input controller connected");   // ← ここが出るかどうか

    this.selectedTags = []
    // 最初は隠しフィールドを空に
    this.hiddenTarget.value = ""
  }

  // Enterキーのみを処理
  keydown(event) {
    if (event.key !== "Enter") return

    event.preventDefault()  // ここでフォーム送信を止める

    const value = this.inputTarget.value.trim()
    // 空文字・重複・3つ以上はそのままクリアして戻る
    if (!value || this.selectedTags.includes(value) || this.selectedTags.length >= 3) {
      this._clearInput()
      return
    }

    this._addTag(value)
    this._clearInput()
  }

  filterSuggestions() {
    const query = this.inputTarget.value.trim()
    if (!query) {
      this.clearSuggestions()
      return
    }

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
    // 隠しフィールドにセット
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
