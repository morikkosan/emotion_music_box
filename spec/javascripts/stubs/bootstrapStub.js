// spec/javascripts/stubs/bootstrapStub.js
export class Modal {
  static getInstance() {
    return null;
  }
  static getOrCreateInstance() {
    return { show() {}, hide() {} };
  }
}

export default { Modal };
