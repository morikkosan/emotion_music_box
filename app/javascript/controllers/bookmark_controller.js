// app/javascript/controllers/bookmark_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["selectedLogsInput", "includeMyLogsCheckbox"]

  connect() {
    this.storageKey = "playlist:selected_ids"
    try {
      this.selected = new Set(JSON.parse(localStorage.getItem(this.storageKey) || "[]"))
    } catch (_) {
      this.selected = new Set()
    }

    this.restoreChecks()
    this.fillHiddenFromStorage()

    this.onFrameLoad = (e) => {
      const id = e.target?.id
      if (id === "logs_list" || id === "logs_list_mobile") {
        this.restoreChecks()
        this.fillHiddenFromStorage()
      }
    }
    document.addEventListener("turbo:frame-load", this.onFrameLoad)

    this.onChange = (e) => {
      const t = e.target
      if (!t.matches?.(".playlist-check")) return
      const id = String(t.value)
      if (t.checked) this.selected.add(id)
      else this.selected.delete(id)
      this.persist()
      this.fillHiddenFromStorage()
    }
    document.addEventListener("change", this.onChange)
  }

  disconnect() {
    document.removeEventListener("turbo:frame-load", this.onFrameLoad)
    document.removeEventListener("change", this.onChange)
  }

  toggleMyPageLogs(event) {
  const el = event.target
  const form = el.form

  // --- モバイルかどうかの判定（現行ロジックを踏襲） ---
  const inMobileFrame = !!(
    document.getElementById("logs_list_mobile")?.contains(this.element) ||
    el.closest?.("turbo-frame#logs_list_mobile")
  )
  const isMobileForm =
    inMobileFrame ||
    (form && ["mobile-bookmarks-form", "mobile-search-form"].includes(form.id)) ||
    (form && form.getAttribute("data-turbo-frame") === "logs_list_mobile")

  // --- モバイル：現行どおりフレーム更新 ---
  if (isMobileForm) {
    event.preventDefault()
    event.stopPropagation()

    const url = new URL("/emotion_logs/bookmarks", window.location.origin)
    const params = new URLSearchParams(window.location.search)
    if (form) {
      for (const [k, v] of new FormData(form).entries()) {
        if (v != null && v !== "") params.set(k, v)
      }
    }
    if (el.checked) params.set("include_my_logs", "true")
    else params.delete("include_my_logs")

    params.set("view", "mobile")
    url.search = params.toString()

    const frame = document.getElementById("logs_list_mobile")
    if (frame) frame.setAttribute("src", url.toString())
    else if (window.Turbo?.visit) Turbo.visit(url.toString(), { frame: "logs_list_mobile" })
    else window.location.href = url.toString()
    return
  }

  // --- デスクトップ：フル遷移ではなくフォーム送信で logs_list フレーム更新 ---
  // フォームがあり、かつ data-turbo-frame="logs_list" が付いている（ERBの現行）場合、
  // それを優先して部分更新にする。
  if (form && form.getAttribute("data-turbo-frame") === "logs_list") {
    event.preventDefault()
    event.stopPropagation()

    // チェックされている時だけ include_my_logs を送る（未チェックなら送らない = 従来どおり）
    // チェックボックス自身が form にあるので、特別な細工は不要。単純に submit するだけでOK。
    form.requestSubmit()
    return
  }

  // --- フォームが見つからない非常時のみフォールバックでフル遷移 ---
  const base = new URL("/emotion_logs/bookmarks", window.location.origin)
  const cur  = new URLSearchParams(window.location.search)
  ;["genre","emotion","sort","period"].forEach(k => { const v = cur.get(k); if (v) base.searchParams.set(k, v) })
  if (el.checked) base.searchParams.set("include_my_logs", "true")
  window.Turbo?.visit ? Turbo.visit(base.toString(), { action: "advance" }) : (window.location.href = base.toString())
}


  // ✅ 送信直前：localStorageに入っている「全ページ分」を
  //  1) selected_log_ids（カンマ区切り文字列）
  //  2) selected_logs[]（配列）
  // の2系統で form に詰める
  submitPlaylistForm(e) {
    const form = e?.target
    if (!form) return

    let arr = []
    try {
      arr = JSON.parse(localStorage.getItem(this.storageKey) || "[]")
    } catch (_) {
      arr = this.selected ? [...this.selected] : []
    }

    // 1) 文字列 hidden（ターゲットがあればそれを使う）
    let idsHidden =
      form.querySelector('input[name="selected_log_ids"]') ||
      (this.hasSelectedLogsInputTarget ? this.selectedLogsInputTarget : null)

    if (!idsHidden) {
      idsHidden = document.createElement("input")
      idsHidden.type = "hidden"
      idsHidden.name = "selected_log_ids"
      form.appendChild(idsHidden)
    }
    idsHidden.value = arr.join(",")

    // 2) 配列 hidden（毎回作り直し）
    form.querySelectorAll('input[name="selected_logs[]"]').forEach(n => n.remove())
    arr.forEach(id => {
      const h = document.createElement("input")
      h.type  = "hidden"
      h.name  = "selected_logs[]"
      h.value = id
      form.appendChild(h)
    })
  }

  clearSelection(e) {
    if (!e?.detail?.success) return
    localStorage.setItem(this.storageKey, JSON.stringify([]))
    this.selected?.clear?.()
    document.querySelectorAll(".playlist-check:checked").forEach(cb => (cb.checked = false))
    this.fillHiddenFromStorage()
  }

  // --- util ---
  restoreChecks() {
    document.querySelectorAll(".playlist-check").forEach(cb => {
      cb.checked = this.selected.has(String(cb.value))
    })
  }

  fillHiddenFromStorage() {
    let arr = []
    try {
      arr = JSON.parse(localStorage.getItem(this.storageKey) || "[]")
    } catch (_) {
      arr = this.selected ? [...this.selected] : []
    }
    if (this.hasSelectedLogsInputTarget) {
      this.selectedLogsInputTarget.value = arr.join(",")
    }
  }

  persist() {
    localStorage.setItem(this.storageKey, JSON.stringify([...this.selected]))
  }
}
