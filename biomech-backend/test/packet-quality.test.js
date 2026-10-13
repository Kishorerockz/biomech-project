const assert = require('node:assert/strict');
const test = require('node:test');
const { getEventQuality, recordPacketTimestamp } = require('../src/ml/PacketQuality');

function createState() {
  return {
    totalPacketCount: 0,
    droppedPacketCount: 0,
    invalidTimestampCount: 0,
    firstPacketTimestamp: null,
    lastPacketTimestamp: null,
  };
}

test('100 Hz timestamps report 100 Hz with no loss', () => {
  const state = createState();
  for (let timestamp = 0; timestamp <= 1000; timestamp += 10) {
    assert.equal(recordPacketTimestamp(state, timestamp), true);
  }
  const quality = getEventQuality(state);
  assert.equal(quality.samplingRateHz, 100);
  assert.equal(quality.packetLossPercent, 0);
  assert.equal(quality.signalQuality, 'good');
});

test('delayed timestamps estimate missing packets and degrade quality', () => {
  const state = createState();
  [0, 10, 20, 50, 60].forEach((timestamp) => recordPacketTimestamp(state, timestamp));
  const quality = getEventQuality(state);
  assert.equal(state.droppedPacketCount, 2);
  assert.equal(quality.packetLossPercent, 28.6);
  assert.equal(quality.signalQuality, 'poor');
});

test('duplicate and backwards timestamps are rejected', () => {
  const state = createState();
  assert.equal(recordPacketTimestamp(state, 100), true);
  assert.equal(recordPacketTimestamp(state, 100), false);
  assert.equal(recordPacketTimestamp(state, 90), false);
  assert.equal(state.totalPacketCount, 1);
  assert.equal(state.invalidTimestampCount, 2);
});
