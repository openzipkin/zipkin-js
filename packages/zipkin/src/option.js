const None = {
  get type() {
    return 'None';
  },
  map() {
    return None;
  },
  ifPresent() {},
  flatMap() {
    return None;
  },
  getOrElse(f) {
    if (f instanceof Function) {
      return f();
    } else {
      return f;
    }
  },
  equals(other) {
    return other.type === 'None';
  },
  toString() {
    return 'None';
  },
  get present() {
    return false;
  }
};


class Some {
  constructor(value) {
    this.value = value;
  }
  map(f) {
    return new Some(f(this.value));
  }
  ifPresent(f) {
    return this.map(f);
  }
  flatMap(f) {
    return this.map(f).getOrElse(None);
  }
  getOrElse() {
    return this.value;
  }
  equals(other) {
    return other instanceof Some && other.value === this.value;
  }
  toString() {
    return `Some(${this.value.toString()})`;
  }
  get present() {
    return true;
  }
  get type() {
    return 'Some';
  }
}

// Used to validate input arguments
function isOptional(data) {
  return data != null && (
      data instanceof Some ||
      data === None ||
      data.type === 'Some' ||
      data.type === 'None'
    );
}

function verifyIsOptional(data) {
  if (data == null) {
    throw new Error('Error: data is not Optional - it\'s null');
  }
  if (isOptional(data)) {
    if (isOptional(data.value)) {
      throw new Error(`Error: data (${data.value.toString()}) is wrapped in Option twice`);
    }
  } else {
    throw new Error(`Error: data (${data}) is not an Option!`);
  }
}

function fromNullable(nullable) {
  if (nullable != null) {
    return new Some(nullable);
  } else {
    return None;
  }
}

module.exports.Some = Some;
module.exports.None = None;
module.exports.verifyIsOptional = verifyIsOptional;
module.exports.fromNullable = fromNullable;
