const annotation = require('../src/annotation');

describe('Annotation types', () => {
  Object.keys(annotation).forEach(key => {
    it(`should have annotationType ${key}`, () => {
      const ann = new annotation[key]({});
      expect(ann.annotationType).to.equal(key);
    });
  });
});
