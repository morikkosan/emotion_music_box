// spec/javascripts/stubs/bootstrapStub.js
export class Modal {
  constructor(/* element, options */) {}
  show() {}
  hide() {}

  static getInstance(/* element */) {
    return null;
  }
  static getOrCreateInstance(/* element, options */) {
    return new Modal();
  }
}

export default { Modal };