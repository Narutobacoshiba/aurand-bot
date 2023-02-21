import { getSignedInteger } from "./random_org_api.js"
import { describe, test, expect } from "@jest/globals";

describe('get data from random org success', () => {
  test('GetSignedIntegerSuccess', async () => {
    const expected_obj = {
      random: {
        method: expect.any(String),
        hashedApiKey: expect.any(String),
        n: expect.any(Number),
        min: expect.any(Number),
        max: expect.any(Number),
        replacement: true,
        base: expect.any(Number),
        data: expect.arrayContaining([]),
        license: {
          type: expect.any(String),
          text: expect.any(String),
          infoUrl:  null
        },
        userData: null,
        completionTime: expect.any(String),
        serialNumber: expect.any(Number)
      },
      signature: expect.any(String),
    }

    const api_key = "ebf3e515-5d73-4172-8cc8-7625b6a403d7"
    let res = await getSignedInteger({api_key: api_key, min: 0, max: 255, amount: 32 })
    expect(res).toMatchObject(expected_obj)
    expect(res.random.data.length).toBe(32)
    expect(Math.min(...res.random.data)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...res.random.data)).toBeLessThanOrEqual(255)
  });
});

describe('get data from random org fail with invalid api key', () => {
  test('GetSignedIntegerFailWithInvalidApiKey', async () => {
    const expected_obj = {
      code: 200,
      message: "Parameter 'apiKey' is malformed",
      data: [ 'apiKey' ]
    }

    const api_key = "ebf3e515-5d73-4172-8cc8-7625b6a403ds"
    try{
      await getSignedInteger({api_key: api_key, min: 0, max: 255, amount: 32 })
    } catch (err){
      expect(err).toMatchObject(expected_obj)
    }
    
  });
});
