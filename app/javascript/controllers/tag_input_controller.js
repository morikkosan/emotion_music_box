import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["input", "tags", "suggestions"]

  connect() {
    this.selectedTags = []
  }

  handleKeydown(event) {
    if (event.key === "Enter") {
      event.preventDefault()
      const value = this.inputTarget.value.trim()
      if (value && this.selectedTags.length < 3 && !this.selectedTags.includes(value)) {
        this.addTag(value)
      }
      this.inputTarget.value = ""
      this.clearSuggestions()
    }
  }

  filterSuggestions() {
    const query = this.inputTarget.value.trim()
    if (!query) {
      this.clearSuggestions()
      return
    }

    // ここで候補を取得（例：/tags/search?q=keyword）
    fetch(`/tags/search?q=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        this.suggestionsTarget.innerHTML = ""
        data.forEach(tag => {
          const option = document.createElement("div")
          option.classList.add("dropdown-item")
          option.textContent = tag.name
          option.addEventListener("click", () => {
            this.addTag(tag.name)
            this.inputTarget.value = ""
            this.clearSuggestions()
          })
          this.suggestionsTarget.appendChild(option)
        })
      })
  }

  addTag(tag) {
    if (this.selectedTags.includes(tag) || this.selectedTags.length >= 3) return
    this.selectedTags.push(tag)
    this.updateTagsView()
    document.getElementById("hidden-tags").value = this.selectedTags.join(",")
  }

  updateTagsView() {
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
        this.updateTagsView()
        document.getElementById("hidden-tags").value = this.selectedTags.join(",")
      })

      badge.appendChild(removeBtn)
      this.tagsTarget.appendChild(badge)
    })
  }

  clearSuggestions() {
    this.suggestionsTarget.innerHTML = ""
  }
}
