const assert = require('node:assert/strict');
const test = require('node:test');
const {
  initML,
  classifyJump,
  predictFatigue,
  applyConfidencePolicy,
} = require('../src/ml/JumpMLEngine');

const flightHeightCm = (hangTimeMs) => 122.625 * (hangTimeMs / 1000) ** 2;

initML();

test('flight-time height matches reference physics values', () => {
  const expected = new Map([
    [200, 4.9],
    [300, 11.0],
    [400, 19.6],
    [500, 30.7],
  ]);

  for (const [hangTimeMs, expectedHeight] of expected) {
    assert.ok(Math.abs(flightHeightCm(hangTimeMs) - expectedHeight) < 0.1);
  }
});

test('fatigue requires five valid jumps', () => {
  const result = predictFatigue([30, 30, 29]);
  assert.equal(result.trend, 'insufficient_data');
  assert.equal(result.fatigueScore, 0);
});

test('stable metric sequence remains stable', () => {
  const result = predictFatigue(Array.from({ length: 5 }, () => ({
    heightCm: 30,
    takeoffAccelG: 2.5,
    landingImpactG: 2.0,
  })));
  assert.equal(result.trend, 'stable');
  assert.equal(result.fatigueScore, 0);
});

test('clear CMJ metrics receive a classification', () => {
  const result = classifyJump({
    heightCm: 17.7,
    hangTimeMs: 380,
    takeoffAccelG: 2.8,
    landingImpactG: 2.0,
    twistDeg: 5,
  });
  assert.equal(result.label, 'CMJ');
  assert.ok(result.confidence >= 60);
});

test('ambiguous model scores become Unknown', () => {
  const result = applyConfidencePolicy({ CMJ: 0.55, SJ: 0.50, DJ: 0.10 });
  assert.equal(result.label, 'Unknown');
});
