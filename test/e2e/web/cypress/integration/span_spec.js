require("babel-polyfill");
const fetch = require("node-fetch");

const ZIPKIN_ENDPOINT = "http://localhost:9411/api/v2/spans";

describe("Setup", () => {
  it("should be able interact with the basic example", () => {
    cy.visit("/");
    cy.get("#Basic").click();
    cy.get("#buttonLabel").should($p => {
      expect($p.first()).to.contain("Not-Pressed");
    });
  });

  it("should be able to access zipkin", async () => {
    const result = await fetch(`${ZIPKIN_ENDPOINT}?serviceName=frontend`).then(res => res.json());
    expect(result).to.eql([]);
  });
});

describe('E2E - Node: Spans', () => {
  it('should be able to create a span', async () => {
    const beforeResult = await fetch(`${ZIPKIN_ENDPOINT}?serviceName=test1`).then(res => res.json());
    expect(beforeResult).to.eql([]);

    cy.visit("/");
    cy.get("#Basic").click();
    cy.get("#buttonLabel").should($p => {
      expect($p.first()).to.contain("Not-Pressed");
    });
    cy.get("#basicButton").click();
    cy.get("#buttonLabel").should($p => {
      expect($p.first()).to.contain("Is-Pressed");
    });

    const afterResult = await fetch(`${ZIPKIN_ENDPOINT}?serviceName=test1`).then(res => res.json());
    expect(afterResult.length).to.equal(1);
  });
});
