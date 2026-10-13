const assert = require('node:assert/strict');
const test = require('node:test');
const { detectJump } = require('../src/ml/JumpDetector');

function createState() {
  return {
    jumpState: 'GROUNDED',
    baselineG: 1.0,
    takeoffSamples: 0,
    freefallSamples: 0,
    landingSamples: 0,
    cooldownUntil: 0,
    freefallStart: null,
    takeoffPeak: 0,
    landingPeak: 0,
    twistCumX: 0,
    twistCumY: 0,
    twistPeak: 0,
    lastGyroTime: null,
    pendingJump: null,
    landingStart: null,
  };
}

function feed(state, timestamp, acceleration, gyro = { x: 0, y: 0, z: 0 }) {
  return detectJump(acceleration, { timestamp }, gyro, state);
}

test('standing and walking spikes do not create a jump', () => {
  const state = createState();
  for (let timestamp = 0; timestamp < 1000; timestamp += 10) {
    const acceleration = timestamp % 120 === 0 ? 1.3 : 1.0;
    assert.equal(feed(state, timestamp, acceleration), null);
  }
  assert.equal(state.jumpState, 'GROUNDED');
});

test('a confirmed jump creates one flight-time event', () => {
  const state = createState();
  [100, 110, 120].forEach((timestamp) => feed(state, timestamp, 1.5));
  [130, 140, 150].forEach((timestamp) => feed(state, timestamp, 0.6));
  [450, 460].forEach((timestamp) => feed(state, timestamp, 1.5));
  const event = feed(state, 470, 1.0);

  assert.ok(event);
  assert.equal(event.hangTimeMs, 310);
  assert.equal(event.heightCm, 11.8);
  assert.equal(state.jumpState, 'GROUNDED');
});

test('a sensor drop without propulsion is ignored', () => {
  const state = createState();
  [100, 110, 120, 130].forEach((timestamp) => feed(state, timestamp, 0.1));
  assert.equal(state.jumpState, 'GROUNDED');
});

test('landing cooldown prevents an immediate duplicate event', () => {
  const state = createState();
  [100, 110, 120].forEach((timestamp) => feed(state, timestamp, 1.5));
  [130, 140, 150].forEach((timestamp) => feed(state, timestamp, 0.6));
  [450, 460].forEach((timestamp) => feed(state, timestamp, 1.5));
  assert.ok(feed(state, 470, 1.0));

  [480, 490, 500, 510, 520].forEach((timestamp) => {
    assert.equal(feed(state, timestamp, 1.5), null);
  });
});
