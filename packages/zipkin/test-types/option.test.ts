import { expect } from 'chai';
import { option } from 'zipkin';
import IOption = option.IOption;
import Some = option.Some;
import None = option.None;

describe('Option', () => {
    describe('None', () => {
        it('type should be of expected type', () => {
            const t: 'None' = None.type;

            expect(t).to.equal('None');
        });

        it('present should be of expected type', () => {
            const p: false = None.present;

            expect(p).to.equal(false);
        });

        it('getOrElse should return value type', () => {
            const value: IOption<number> = None;

            expect(value.getOrElse(0)).to.equal(0);
            expect(value.getOrElse(() => 0)).to.equal(0);
        });

        it('ifPresent should return void', () => {
            const value: IOption<number> = None;
            const x: void = value.ifPresent(v => v);

            expect(x).to.equal(undefined);
        });

        it('map should have correct return types', () => {
            const mappedValue: IOption<any> = None.map(v => v);

            expect(mappedValue).to.equal(None);
        });

        it('flatMap should have correct return types', () => {
            const mappedValue1: IOption<any> = None.flatMap(v => new Some(v));
            const mappedValue2: IOption<any> = None.flatMap(_ => None);

            expect(mappedValue1).to.equal(None);
            expect(mappedValue2).to.equal(None);
        });
    });

    describe('Some', () => {
        it('type should be of expected type', () => {
            const t: 'Some' = new Some(0).type;

            expect(t).to.equal('Some');
        });

        it('present should be of expected type', () => {
            const p: true = new Some(0).present;

            expect(p).to.equal(true);
        });

        it('getOrElse should return value type', () => {
            const value: IOption<number> = new Some(0);

            expect(value.getOrElse(1)).to.equal(0);
            expect(value.getOrElse(() => 1)).to.equal(0);
        });

        it('ifPresent should return void', () => {
            const value: IOption<number> = new Some(0)
            const x: void = value.ifPresent(v => v);

            expect(x).to.equal(undefined);
        })

       it('map should have correct return types', () => {
            const value: IOption<string> = new Some('some value');

            const mappedValue: IOption<number> = value.map(v => v.length);

            expect(mappedValue.type).to.equal('Some');
            expect(mappedValue.getOrElse(0)).to.equal('some value'.length);
        });

        it('flatMap should have correct return types', () => {
            const value = new Some('some value');

            const mappedValue1: IOption<number> = value.flatMap(v => new Some(v.length));
            const mappedValue2: IOption<number> = value.flatMap(_ => None);

            expect(mappedValue1.getOrElse(0)).to.equal('some value'.length);
            expect(mappedValue2.getOrElse(0)).to.equal(0);
        });
    });
});