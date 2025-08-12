// spec/javascripts/stubs/stimulusStub.js
export class Controller {}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function wireTargets(identifier, instance, root) {
  // data-<identifier>-target を全部拾って、xxxTarget / xxxTargets / hasXxxTarget を定義
  const attr = `data-${identifier}-target`;
  const nodes = root.querySelectorAll(`[${attr}]`);

  const single = {};
  const multi = {};

  nodes.forEach((el) => {
    const names = (el.getAttribute(attr) || "").split(/\s+/).filter(Boolean);
    names.forEach((name) => {
      (multi[name] || (multi[name] = [])).push(el);
      if (!single[name]) single[name] = el;
    });
  });

  Object.keys(multi).forEach((name) => {
    const cap = capitalize(name);
    // 単数
    Object.defineProperty(instance, `${name}Target`, {
      value: single[name],
      writable: true,
      configurable: true,
    });
    // 複数
    Object.defineProperty(instance, `${name}Targets`, {
      value: multi[name],
      writable: true,
      configurable: true,
    });
    // hasXxxTarget
    Object.defineProperty(instance, `has${cap}Target`, {
      value: true,
      writable: false,
      configurable: true,
    });
  });
}

export const Application = {
  start() {
    const registry = new Map();
    return {
      register(identifier, ControllerClass) {
        registry.set(identifier, ControllerClass);
      },
      getControllerForElementAndIdentifier(element, identifier) {
        const Klass = registry.get(identifier);
        if (!Klass) return null;
        const instance = new Klass();
        instance.element = element;

        // ★ Stimulusの targets 自動配線（これが今回のキモ）
        wireTargets(identifier, instance, element);

        if (typeof instance.connect === "function") {
          instance.connect();
        }
        return instance;
      },
      stop() {
        registry.clear();
      },
    };
  },
};

export default { Controller, Application };
