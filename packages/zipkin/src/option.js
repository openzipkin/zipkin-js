const None = {
  type: 'None',
  map: function map() {
    return None;
  },
  ifPresent: function ifPresent() {},
  flatMap: function flatMap() {
    return None;
  },
  getOrElse: function getOrElse(f) {
    if (f instanceof Function) {
      return f();
    } else {
      return f;
    }
  },
  equals: function equals(other) {
    return other.type === 'None';
  },
  toString: function toString() {
    return 'None';
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
}
Some.prototype.type = 'Some';

// Used to validate input arguments
function isOptional(data) {
  return data instanceof Some || data === None;
}

function verifyIsOptional(data) {
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
