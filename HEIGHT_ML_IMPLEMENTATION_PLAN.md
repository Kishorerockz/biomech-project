# KINETIX Height and ML Implementation Plan

## Purpose

This plan fixes jump-height accuracy and makes ML operate on trustworthy jump events. Work must be completed in order because ML quality depends on correct calibration, timestamps, event detection, and height calculation.

The current system contains:

- ESP32 + MPU-6050 firmware in the external PlatformIO project
- React/Vite mobile UI in `kinetix`
- Node/Socket.IO backend in `biomech-backend`
- A frontend `JumpDetector` and a separate backend `detectJump` state machine
- A brain.js classifier trained on a small synthetic dataset

The target architecture is:

```text
ESP32 raw samples
    -> frontend transport and display
    -> backend calibration and signal processing
    -> one authoritative jump detector
    -> flight-time height calculation
    -> validated feature extraction
    -> ML classification and fatigue analysis
    -> UI, database, and reports
```

## Non-negotiable contracts

Use these units everywhere after the transport boundary:

| Field | Unit |
|---|---|
| Accelerometer x/y/z | g |
| Gyroscope x/y/z | degrees/second |
| Timestamp | epoch milliseconds, monotonic per session |
| Height | cm |
| Flight time | ms |
| Acceleration thresholds | g |
| Angular displacement | degrees |

The ESP32 may continue sending raw MPU-6050 integers, but the backend must convert them once and mark the converted values clearly. Do not mix raw LSB values and physical units in the same field.

## Working rules

1. Make one phase change at a time.
2. Run the focused acceptance test after every phase.
3. Do not tune thresholds using a single jump.
4. Keep raw telemetry for debugging even after processed values are added.
5. Never report ML confidence as validated probability until it is evaluated on held-out real data.
6. Do not upload UI-only changes to the ESP32.
7. Do not change the ESP32 firmware and frontend parser independently; update the telemetry contract together.

---

# Phase 0: Baseline and reproducibility

## 0.1 Record the current baseline

Before editing behavior, record:

- current frontend build result
- current TypeScript result
- current backend startup result
- current PlatformIO compile result
- current ESP32 upload port and upload speed
- one real sensor capture containing raw x/y/z/t/r values

Commands:

```powershell
Set-Location "K:\Studies\sem 5\es\proj\kinetix"
npm run lint
npm run build

Set-Location "K:\Studies\sem 5\es\proj\biomech-backend"
npm install
node src/server.js

Set-Location "C:\Users\kisho\OneDrive\Documents\PlatformIO\Projects\Kinetix_Wearable"
& "C:\Users\kisho\.platformio\penv\Scripts\platformio.exe" run
```

Acceptance:

- Baseline failures are recorded before behavior changes.
- The current app and firmware versions are identifiable.
- No test uses stale Android output by accident.

## 0.2 Define the event record

Create one shared documented event shape. The backend should be authoritative:

```js
{
  sessionId,
  timestamp,
  heightCm,
  hangTimeMs,
  takeoffAccelG,
  landingImpactG,
  groundContactTimeMs,
  rsi,
  dipDepthCm,
  twistDeg,
  sampleCount,
  samplingRateHz,
  detectorVersion,
  quality: {
    valid,
    reason,
    packetLossPercent,
    signalQuality
  }
}
```

Do not add ML fields until the physical event has been validated.

---

# Phase 1: Make the sensor contract physically correct

## 1.1 Firmware contract audit

Files:

- `C:\Users\kisho\OneDrive\Documents\PlatformIO\Projects\Kinetix_Wearable\src\main.cpp`
- `C:\Users\kisho\OneDrive\Documents\PlatformIO\Projects\Kinetix_Wearable\platformio.ini`

Verify and document:

- accelerometer range is +/-8g
- accelerometer scale is 4096 LSB/g
- gyro range and scale are known
- samples are requested every 10 ms
- `t` is a hardware timestamp in microseconds
- `r` identifies the accelerometer range
- gyro fields are included and use known raw units
- packet size is safe for BLE notification payloads

Add a firmware packet version, for example `v: 1`, so a future contract change is detectable.

Acceptance:

- A serial or captured BLE packet includes x, y, z, gyro fields, t, r, and v.
- 100 samples take approximately one second.
- The device is stationary without clipping or invalid values.

## 1.2 Correct timestamp handling

Files:

- `kinetix/src/App.tsx`
- `biomech-backend/src/server.js`

Implement one timestamp normalization function that:

1. Converts ESP32 microseconds to epoch or session-relative milliseconds.
2. Handles `micros()` rollover.
3. Rejects duplicate or backwards timestamps.
4. Tracks inter-sample delta.
5. Reports packet loss and measured sampling rate.

Do not use browser packet-arrival time for height when a valid hardware timestamp exists.

Acceptance:

- A 100 Hz stream reports approximately 100 Hz.
- Artificial packet delay does not change measured flight time.
- Duplicate and backwards timestamps are ignored and counted.

## 1.3 Correct gyro conversion

Files:

- `kinetix/src/App.tsx`
- `biomech-backend/src/server.js`
- `kinetix/src/utils/sensorMath.ts`

Convert raw gyro LSB to degrees/second before integration. For the current +/-2000 degrees/second MPU setting:

```text
gyroDegPerSec = rawGyro / 16.4
```

Keep raw gyro values separately for diagnostics. Never integrate raw LSB values as degrees/second.

Acceptance:

- A stationary sensor reports near-zero gyro.
- A known manual rotation produces a plausible angular velocity.
- Twist values remain in a plausible degree range instead of growing by hundreds or thousands from one short movement.

---

# Phase 2: Calibration and signal quality

## 2.1 Implement a real stationary calibration

Files:

- `kinetix/src/components/CalibrationTab.tsx`
- `kinetix/src/App.tsx`
- `biomech-backend/src/server.js`
- session model in `biomech-backend/src/models/Session.js`

Calibration procedure:

1. Require the user to place the wearable still.
2. Collect 3 to 5 seconds of samples.
3. Reject calibration if acceleration variance or gyro variance is too high.
4. Calculate mean and standard deviation per axis.
5. Store accelerometer and gyro offsets per device/session.
6. Verify resting resultant acceleration is close to 1.00g.
7. Display calibration quality and measured noise.

Important: acceleration calibration must distinguish bias from gravity. Do not simply subtract the entire z-axis gravity value as if it were sensor bias unless the mounting orientation is fixed and explicitly documented.

Acceptance:

- Resting magnitude is within the configured range, initially 0.90g to 1.10g.
- Calibration fails visibly when the device is moving.
- Calibration data is used by jump detection, not only displayed or stored.

## 2.2 Fix the backend calibration bug

File:

- `biomech-backend/src/server.js`

The backend currently calculates calibrated acceleration but calculates jump magnitude from `packet.accel`. Change the magnitude calculation to use calibrated acceleration. Preserve raw values for audit logging.

Required flow:

```text
raw LSB
  -> subtract axis bias
  -> convert to g
  -> calculate magnitude
  -> filter magnitude
  -> detect event
```

Acceptance:

- Applying a known calibration offset changes processed magnitude as expected.
- Raw telemetry remains unchanged.
- Jump detection uses processed/calibrated values.

## 2.3 Add signal-quality metrics

Track per session:

- packet count
- dropped packet count
- measured Hz
- timestamp jitter
- acceleration noise while grounded
- clipping count
- invalid packet count

Reject or mark a jump invalid when signal quality is insufficient.

Acceptance:

- The UI can show a warning such as `Signal quality: Low`.
- Invalid jumps do not enter height history or fatigue calculations.

---

# Phase 3: Establish one authoritative jump detector

## 3.1 Choose backend authority

Files:

- `biomech-backend/src/server.js`
- `kinetix/src/utils/JumpDetector.ts`
- `kinetix/src/App.tsx`
- `kinetix/src/hooks/useJumpDetection.ts`

The backend detector becomes authoritative whenever a session is connected. The frontend detector should not create a second database event or increment the official jump count.

Frontend responsibilities:

- display raw/processed telemetry
- show current detector phase received from backend
- show backend `jump_detected`
- optionally use local detection only when backend is unavailable

Add an event identifier, for example `eventId`, to prevent duplicate UI insertion when both local and backend events are received.

Acceptance:

- One physical jump creates one database event.
- The UI count, backend count, and session count agree.
- Offline fallback is clearly labeled `LOCAL` and is not mixed with backend results.

## 3.2 Implement the detector with hysteresis

File:

- `biomech-backend/src/server.js` or a new `biomech-backend/src/ml/JumpDetector.js`

Use states:

```text
GROUNDED
TAKEOFF_CANDIDATE
AIRBORNE
LANDING_CANDIDATE
INVALID
```

Recommended initial behavior:

- `GROUNDED -> TAKEOFF_CANDIDATE`: propulsion above baseline for 2 to 4 samples.
- `TAKEOFF_CANDIDATE -> AIRBORNE`: freefall below threshold for 3 to 5 samples.
- `AIRBORNE -> LANDING_CANDIDATE`: impact above threshold after minimum flight time.
- `LANDING_CANDIDATE -> GROUNDED`: acceleration returns near baseline for 2 to 4 samples.
- Timeout any state and mark incomplete sequences invalid.

Thresholds must be configurable per wear location and session type. Start with conservative defaults, then tune using captured data.

Acceptance:

- Walking and arm swings do not create valid jumps.
- A genuine jump creates one event.
- A sensor drop does not create a valid athletic jump.
- Repeated jumps are separated by cooldown and grounded confirmation.

## 3.3 Use hardware flight time for height

Height formula:

$$
h = \frac{g T^2}{8}
$$

where:

- $T$ is total flight time in seconds
- $g = 9.80665\,m/s^2$
- height is converted to centimeters

Expected reference values:

| Flight time | Expected height |
|---:|---:|
| 200 ms | 4.9 cm |
| 300 ms | 11.0 cm |
| 400 ms | 19.6 cm |
| 500 ms | 30.6 cm |

Use flight-time height as the official value. Do not blend it with integrated velocity until orientation compensation and filtering have been validated.

Acceptance:

- Synthetic event tests match the reference values within rounding tolerance.
- Height never becomes negative or NaN.
- Height is marked invalid when the flight interval is incomplete or exceeds the configured maximum.

## 3.4 Remove unvalidated velocity correction

Files:

- `kinetix/src/utils/JumpDetector.ts`
- backend detector implementation

Keep takeoff velocity as a diagnostic feature, but do not use it to alter official height until:

- gravity has been removed in the sensor frame
- orientation has been estimated reliably
- acceleration has been filtered
- integration drift is measured against known jumps

Acceptance:

- Official height depends only on validated flight time.
- Diagnostic velocity can be logged without changing the displayed height.

---

# Phase 4: Event storage and UI consistency

## 4.1 Store the complete authoritative event

Files:

- `biomech-backend/src/models/JumpEvent.js`
- `biomech-backend/src/server.js`
- `kinetix/src/types.ts`
- session history mapping in `kinetix/src/App.tsx`

Store:

- height and flight time
- takeoff and landing acceleration
- ground contact time
- RSI
- twist
- sample count and sampling rate
- event quality and invalid reason
- detector version
- ML output only after classification

Acceptance:

- History values exactly match the corresponding `jump_detected` event.
- Reloading the app does not change a recorded height.
- Invalid events are auditable but excluded from performance averages.

## 4.2 Make the UI show data provenance

Files:

- `kinetix/src/components/LiveTab.tsx`
- `kinetix/src/components/MLInsightsCard.tsx`
- `kinetix/src/components/AnalysisTab.tsx`

Display whether values are:

- `LIVE` backend result
- `LOCAL` fallback
- `OFFLINE`
- `INVALID SIGNAL`

Also display a small quality warning when packet loss or calibration quality is poor.

Acceptance:

- Users cannot mistake a local fallback classification for validated backend ML.
- The displayed jump height and ML card refer to the same event ID.

---

# Phase 5: Build a real ML pipeline

## 5.1 Define the feature vector

File:

- `biomech-backend/src/ml/JumpMLEngine.js`

Use validated event features:

```js
[
  hangTimeMs,
  heightCm,
  takeoffAccelG,
  landingImpactG,
  groundContactTimeMs,
  rsi,
  dipDepthCm,
  twistDeg,
  packetLossPercent
]
```

Normalize using fixed training ranges stored with the model. Do not silently normalize differently between training and inference.

Acceptance:

- The same input produces the same output after server restart.
- Inputs outside expected ranges are clamped and flagged.
- Missing features produce `Unknown`, not an invented confident label.

## 5.2 Replace synthetic-only training data

Create a real dataset format under a non-production data directory, for example:

```text
training-data/
  manifest.csv
  raw/
  processed/
```

Each labeled event should include:

- athlete identifier
- session identifier
- wear location
- raw sample window
- event boundaries
- label: CMJ, SJ, DJ, invalid
- manual review status

Collect multiple athletes and multiple sessions. Split by athlete/session so samples from one jump do not appear in both training and test sets.

Minimum initial target:

- 50 valid examples per class
- 20 invalid movement examples
- at least 3 athletes or mounting conditions

Acceptance:

- A held-out test report includes accuracy, precision, recall, and confusion matrix.
- The model is not accepted based only on training error.

## 5.3 Choose an appropriate model

Keep brain.js only if it performs adequately on held-out real data. Otherwise use a simpler model first:

- rule-based baseline
- logistic regression or decision tree
- small neural network only if it improves held-out results

Always retain the rule-based baseline for comparison and fallback.

Acceptance:

- ML model beats or matches the baseline on held-out data.
- Misclassifications are logged with feature values.
- The model version is included in each event.

## 5.4 Add confidence policy

Do not expose raw neural-network output as factual probability. Use explicit bands:

```text
below 0.60  -> Unknown
0.60-0.80   -> Probable label
above 0.80  -> Label
```

Show the top scores in the UI, but make `Unknown` the safe result when signal quality is poor or classes are close.

Acceptance:

- Low-quality or ambiguous jumps do not display a definitive label.
- UI confidence matches backend confidence for the same event.

---

# Phase 6: Fatigue and performance metrics

## 6.1 Improve fatigue inputs

File:

- `biomech-backend/src/ml/JumpMLEngine.js`

Require at least 5 valid jumps before a fatigue recommendation. Calculate trends from:

- rolling jump-height average
- best-jump-relative decline
- RSI decline
- takeoff acceleration decline
- ground-contact increase
- recent variance

Exclude invalid or low-quality events.

Acceptance:

- One bad jump does not create a high-fatigue warning.
- A controlled declining-height test produces increasing fatigue.
- Stable repeated jumps remain stable.

## 6.2 Align local fallback with backend

File:

- `kinetix/src/components/MLInsightsCard.tsx`

If local fallback remains necessary, use the same feature names, thresholds, and fatigue minimum as the backend. Label it clearly as local and never overwrite a newer backend event with an older local estimate.

Acceptance:

- Local and backend output are directionally consistent for the same test data.
- Backend output wins when both are available.

---

# Phase 7: Automated tests and recorded-signal validation

## 7.1 Unit tests for physics

Add tests for:

- flight-time to height conversion
- timestamp normalization and rollover
- raw-to-g conversion for 2g, 8g, and 16g ranges
- gyro conversion
- calibration offset application
- invalid input handling

Reference checks:

```text
200 ms -> approximately 4.9 cm
300 ms -> approximately 11.0 cm
400 ms -> approximately 19.6 cm
500 ms -> approximately 30.6 cm
```

## 7.2 State-machine tests

Use deterministic sample sequences for:

- standing still
- walking
- crouch without jump
- valid CMJ
- valid SJ
- valid DJ
- sensor drop
- delayed packet
- missing packet
- repeated jump
- noisy landing

Acceptance:

- Exactly one valid event per valid jump.
- No event for non-jump sequences.
- Invalid sequences include an inspectable reason.

## 7.3 Replay real sensor logs

Add a replay script that feeds captured ESP32 packets to the backend at controlled timing and at original timing. Compare:

- event count
- height error
- event latency
- packet loss handling
- ML label stability

Store expected manual annotations separately from production code.

Acceptance:

- Every threshold change can be evaluated against the same recordings.
- Field tuning is evidence-based rather than trial and error.

---

# Phase 8: Hardware field validation

## 8.1 Upload and verify firmware

For firmware changes only:

```powershell
Set-Location "C:\Users\kisho\OneDrive\Documents\PlatformIO\Projects\Kinetix_Wearable"
& "C:\Users\kisho\.platformio\penv\Scripts\platformio.exe" run
& "C:\Users\kisho\.platformio\penv\Scripts\platformio.exe" run --target upload
```

The project currently uses `COM8` and upload speed `115200` because `460800` previously caused serial corruption.

Acceptance:

- PlatformIO reports `Hash of data verified`.
- Firmware restarts successfully.
- BLE telemetry includes the expected contract fields.

## 8.2 Field protocol

For each wear location and athlete:

1. Calibrate while stationary.
2. Record 10 standing samples.
3. Record 10 walking samples.
4. Record 10 controlled small jumps.
5. Record 10 normal jumps.
6. Record 10 maximal jumps.
7. Compare app height with a reference method such as video or jump mat.
8. Record false positives and missed jumps.

Do not tune against one jump or one device orientation.

## 8.3 Accuracy targets

Set targets before tuning:

- standing false-positive rate: 0 in 10 minutes
- valid jump detection rate: at least 90 percent
- duplicate event rate: 0 percent
- height median absolute error: no more than 10 percent against reference
- packet loss: less than 2 percent during a normal session
- ML class accuracy: measured separately on held-out labeled data

If targets are not met, keep the event marked experimental and do not present the metric as precise.

---

# Phase 9: Android integration and release verification

## 9.1 Update the web bundle

For UI or frontend logic changes:

```powershell
Set-Location "K:\Studies\sem 5\es\proj\kinetix"
npm run lint
npm run build
npx cap sync android
```

Then open Android Studio and press Run. ESP32 firmware does not need to be uploaded for UI-only changes.

## 9.2 Verify the actual Android target

Confirm Android Studio is using the intended project directory, not an old worktree. Verify:

- the generated `android/capacitor-cordova-android-plugins` directory exists
- `android/local.properties` points to the installed Android SDK
- the app is connected to the correct backend address
- BLE permissions are granted
- the device receives the current web bundle

Acceptance:

- Android build completes.
- The live screen shows current telemetry.
- A real jump creates one height event and one ML insight.
- App restart preserves session history correctly.

## 9.3 Release checklist

Before a demonstration or submission:

- frontend lint passes
- frontend build passes
- backend starts without ML initialization errors
- PlatformIO compile passes
- firmware upload is verified if firmware changed
- Android debug build passes
- one recorded real-device session is replayable
- no duplicate jumps occur
- calibration quality is visible
- ML confidence and data provenance are visible
- known limitations are documented

---

# Execution order summary

1. Baseline and capture current behavior.
2. Freeze and document the telemetry/event contracts.
3. Verify firmware range, timestamp, and gyro units.
4. Normalize timestamps and measure packet quality.
5. Implement stationary calibration and use calibration in backend magnitude.
6. Select the backend as the authoritative jump detector.
7. Add hysteresis, confirmation windows, and invalid-event handling.
8. Calculate official height from hardware flight time only.
9. Store complete authoritative events and align the UI with them.
10. Add physics and state-machine tests.
11. Replay recorded signals and tune thresholds.
12. Replace synthetic-only ML data with labeled real data.
13. Validate ML on held-out athletes/sessions and add confidence policy.
14. Improve fatigue using only valid events.
15. Perform controlled ESP32 field validation.
16. Sync the Android bundle and run the final end-to-end test.

# Definition of done

The implementation is complete only when:

- one physical jump creates one authoritative event
- height is calculated from validated hardware flight time
- calibration affects the detector
- timestamps and packet quality are measurable
- raw and processed data can be inspected
- invalid movements are rejected or clearly marked
- ML uses validated event features
- ML confidence is evaluated on held-out real data
- fatigue excludes invalid events
- frontend, backend, database, firmware, and Android display the same event values
- the complete pipeline has passed both replay tests and real-device field tests
