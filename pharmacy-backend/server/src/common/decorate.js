function applyClassDecorator(decorator, target, ...args) {
  decorator(...args)(target);
}

function applyMethodDecorator(decorator, target, method, ...args) {
  const descriptor = Object.getOwnPropertyDescriptor(target, method);
  decorator(...args)(target, method, descriptor);
}

function applyParameterDecorator(decorator, target, method, index, ...args) {
  decorator(...args)(target, method, index);
}

module.exports = {
  applyClassDecorator,
  applyMethodDecorator,
  applyParameterDecorator,
};