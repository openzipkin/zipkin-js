const None = {
  get type() {
    return 'None';
  },
  get present() {
    return false;
  },
  map() {
    return this;
  },
  ifPresent() {},
  flatMap() {
    return this;
  },
  getOrElse(f) {
    return f instanceof Function ? f() : f;
  },
  equals(other) {
    return other === this;
  },
  toString() {
    return 'None';
  }
};

class Some {
  constructor(value) {
    this.value = value;
  }

  get type() { // eslint-disable-line class-methods-use-this
    return 'Some';
  }

  get present() { // eslint-disable-line class-methods-use-this
    return true;
  }

  map(f) {
    return new Some(f(this.value));
  }

  ifPresent(f) {
    f(this.value);
  }

  flatMap(f) {
    return f(this.value);
  }

  getOrElse() {
    return this.value;
  }

  equals(other) {
    return other instanceof Some && other.value === this.value;
  }

  toString() {
    return `Some(${this.value})`;
  }
}

// Used to validate input arguments
function isOptional(data) {
  return data instanceof Some || None.equals(data);
}

function verifyIsOptional(data) {
  if (data == null) {
    throw new Error('Error: data is not Optional - it\'s null');
  }
  if (isOptional(data)) {
    if (isOptional(data.value)) {
      throw new Error(`Error: data (${data.value}) is wrapped in Option twice`);
    }
  } else {
    throw new Error(`Error: data (${data}) is not an Option!`);
  }
}

function verifyIsNotOptional(data) {
  if (isOptional(data)) {
    throw new Error(`Error: data (${data}) is an Option!`);
  }
}

function fromNullable(nullable) {
  return nullable == null ? None : new Some(nullable);
}

module.exports.Some = Some;
module.exports.None = None;
module.exports.isOptional = isOptional;
module.exports.verifyIsOptional = verifyIsOptional;
module.exports.verifyIsNotOptional = verifyIsNotOptional;
module.exports.fromNullable = fromNullable;
