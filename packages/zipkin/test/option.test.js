const option = require('../src/option');

describe('option', () => {
  describe('Some', () => {
    describe('getOrElse', () => {
      it('should return Some value', () => {
        const s = new option.Some(0);

        expect(s.getOrElse(1)).to.equal(0);
      });
    });

    describe('ifPresent', () => {
      it('should invoke function', () => {
        const s = new option.Some(0);

        let called = false;
        s.ifPresent((x) => {
          expect(x).to.equal(0);
          called = true;
        });

        expect(called).to.be.true; // eslint-disable-line no-unused-expressions
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

    describe('equals', () => {
      it('should be false for None', () => {
        const isEqual = new option.Some(0).equals(option.None);
        expect(isEqual).to.be.false; // eslint-disable-line no-unused-expressions
      });

      it('should be false for Some with unequal value', () => {
        const isEqual = new option.Some(0).equals(new option.Some(1));
        expect(isEqual).to.be.false; // eslint-disable-line no-unused-expressions
      });

      it('should be true for Some with equal value', () => {
        const isEqual = new option.Some(0).equals(new option.Some(0));
        expect(isEqual).to.be.true; // eslint-disable-line no-unused-expressions
      });
    });
  });

  describe('None', () => {
    describe('getOrElse', () => {
      it('should return else value', () => {
        expect(option.None.getOrElse(1)).to.equal(1);
      });
    });

    describe('ifPresent', () => {
      it('should not invoke function', () => {
        option.None.ifPresent(() => {
          expect.fail('None.ifPresent should not invoke function, but did');
        });
      });
    });

    // Sufficient for Functor laws
    describe('map', () => {
      it('should return None', () => {
        expect(option.None.map(x => x)).to.equal(option.None);
      });
    });

    // Sufficient for Monad laws
    describe('flatMap', () => {
      it('should return None', () => {
        expect(option.None.flatMap(x => new option.Some(x))).to.equal(option.None);
        expect(option.None.flatMap(() => option.None)).to.equal(option.None);
      });
    });

    describe('equals', () => {
      it('should be true for None', () => {
        const isEqual = option.None.equals(option.None);
        expect(isEqual).to.be.true; // eslint-disable-line no-unused-expressions
      });

      it('should be false for Some', () => {
        const isEqual = option.None.equals(new option.Some(0));
        expect(isEqual).to.be.false; // eslint-disable-line no-unused-expressions
      });
    });
  });
});
