// spec/javascripts/helpers/dom.js
export function renderHTML(html) {
  document.body.innerHTML = html;
  return document.body;
}
