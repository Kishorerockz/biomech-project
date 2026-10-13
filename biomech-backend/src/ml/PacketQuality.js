function recordPacketTimestamp(state, timestamp) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;

  if (state.lastPacketTimestamp != null) {
    const deltaMs = timestamp - state.lastPacketTimestamp;
    if (deltaMs < 0) {
      if (deltaMs < -1000) {
        state.firstPacketTimestamp = timestamp;
      }
      state.invalidTimestampCount = (state.invalidTimestampCount || 0) + 1;
      state.lastPacketTimestamp = timestamp;
      state.totalPacketCount = (state.totalPacketCount || 0) + 1;
      return true;
    }
    if (deltaMs > 0) {
      state.droppedPacketCount = (state.droppedPacketCount || 0) + Math.max(0, Math.round(deltaMs / 10) - 1);
    }
  } else {
    state.firstPacketTimestamp = timestamp;
  }

  state.lastPacketTimestamp = timestamp;
  state.totalPacketCount = (state.totalPacketCount || 0) + 1;
  return true;
}

function getEventQuality(state) {
  const elapsedMs = state.firstPacketTimestamp != null && state.lastPacketTimestamp != null
    ? Math.max(1, state.lastPacketTimestamp - state.firstPacketTimestamp)
    : 1;
  const expectedPackets = Math.max(1, Math.round(elapsedMs / 10) + 1);
  const packetLossPercent = Math.round(
    Math.min(100, (state.droppedPacketCount / expectedPackets) * 100) * 10
  ) / 10;
  const intervals = Math.max(1, state.totalPacketCount - 1);
  const samplingRateHz = Math.round((intervals / (elapsedMs / 1000)) * 10) / 10;
  const signalQuality = packetLossPercent <= 2 && samplingRateHz >= 80
    ? "good"
    : packetLossPercent <= 5 && samplingRateHz >= 50
      ? "fair"
      : "poor";

  return {
    sampleCount: state.totalPacketCount,
    samplingRateHz,
    packetLossPercent,
    signalQuality,
    valid: signalQuality !== "poor",
    detectorVersion: "backend-flight-time-v2",
  };
}

module.exports = { recordPacketTimestamp, getEventQuality };
