import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "suggestions"]

  connect() {
    this.isComposing = false
    this.fetchSuggestionsBound = () => this.fetchSuggestions()

    this.inputTarget.addEventListener("compositionstart", () => {
      this.isComposing = true
    })

    this.inputTarget.addEventListener("compositionend", () => {
      this.isComposing = false
      this.fetchSuggestions() // 変換確定後に手動で実行
    })

    this.inputTarget.addEventListener("input", this.fetchSuggestionsBound)
    document.addEventListener("click", this.closeSuggestions.bind(this))
  }

  fetchSuggestions() {
    if (this.isComposing) return // 変換中は無視

    const query = this.inputTarget.value.trim()
    if (query === "") {
      this.suggestionsTarget.innerHTML = ""
      return
    }

    fetch(`/tags/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(tags => {
        this.suggestionsTarget.innerHTML = ""

        tags.forEach(tag => {
          const li = document.createElement("li")
          li.textContent = tag.name || tag
          li.className = "list-group-item list-group-item-action"
          li.style.cursor = "pointer"

          li.onclick = () => this.selectSuggestion(li.textContent)

          this.suggestionsTarget.appendChild(li)
        })
      })
      .catch(err => {
        console.error("タグ候補取得失敗:", err)
        this.suggestionsTarget.innerHTML = ""
      })
  }

  selectSuggestion(text) {
    this.inputTarget.removeEventListener("input", this.fetchSuggestionsBound)
    this.inputTarget.value = text
    this.suggestionsTarget.innerHTML = ""
    setTimeout(() => {
      this.inputTarget.addEventListener("input", this.fetchSuggestionsBound)
    }, 0)
  }

  closeSuggestions(e) {
    if (!this.element.contains(e.target)) {
      this.suggestionsTarget.innerHTML = ""
    }
  }
}
