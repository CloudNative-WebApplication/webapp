const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../app'); // Import your Express app
const { expect } = chai;

chai.use(chaiHttp);
//testing with branch protection
describe('Integration Test for /healthz endpoint', () => {
  it('should return status 200 and "OK"', async () => {
    const res = await chai.request(app).get('/healthzz');
    expect(res).to.have.status(200);
  });
});
