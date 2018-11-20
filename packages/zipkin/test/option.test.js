const option = require('../src/option');

describe('option', () => {
  describe('Some', () => {
    describe('getOrElse', () => {
      it('should return Some value', () => {
        const s = new option.Some(0);

        expect(s.getOrElse(1)).to.equal(0);
      });
    });

    describe('map', () => {
      it('should map value', () => {
        const s = new option.Some('a');

        expect(s.map(x => `${x}1`).getOrElse('z')).to.equal('a1');
      });

      // https://wiki.haskell.org/Functor#Functor_Laws
      it('should satisfy identity', () => {
        const a = 'a';
        const s = new option.Some(a);

        expect(s.map(x => x).getOrElse('z')).to.equal(s.getOrElse('zz'));
      });

      it('should satisfy composition', () => {
        const f = x => `${x}1`;
        const g = x => `${x}2`;
        const s0 = new option.Some('a');
        const s1 = s0.map(f).map(g);
        const s2 = s0.map(x => g(f(x)));

        expect(s1.getOrElse('z')).to.equal(s2.getOrElse('zz'));
      });
    });

    describe('flatMap', () => {
      // https://wiki.haskell.org/Monad_laws
      it('should satisfy left identity', () => {
        const a = 'a';
        const f = x => new option.Some(x);
        const s1 = new option.Some(a).flatMap(f);
        const s2 = f(a);

        expect(s1.getOrElse('z')).to.equal(s2.getOrElse('zz'));
      });

      it('should satisfy right identity', () => {
        const f = x => new option.Some(x);
        const s0 = new option.Some('a');
        const s1 = s0.flatMap(f);

        expect(s0.getOrElse('z')).to.equal(s1.getOrElse('zz'));
      });

      it('should satisfy associativity', () => {
        const f = x => new option.Some(`${x}1`);
        const g = x => new option.Some(`${x}2`);
        const s0 = new option.Some('a');
        const s1 = s0.flatMap(f).flatMap(g);
        const s2 = s0.flatMap(x => f(x).flatMap(g));

        expect(s1.getOrElse('z')).to.equal(s2.getOrElse('zz'));
      });
    });
  });

  describe('None', () => {
    describe('getOrElse', () => {
      it('should return Some value', () => {
        expect(option.None.getOrElse(1)).to.equal(1);
      });
    });
  });
});
