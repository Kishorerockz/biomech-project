# Kinetix Wearable & Biomechanics Platform — System Architecture & Roadmap

> **Author / Project**: Kinetix Biomechanics Engineering  
> **Last Updated**: September 2026  
> **Hardware Node**: ESP32 DevKit V1 + InvenSense MPU-6050 6-DoF IMU  
> **Client Ecosystem**: Capacitor Mobile (Android APK), Web Bluetooth, Vite React Dashboard, Express + SQLite Backend  

---

## 1. Executive Summary

**Kinetix** is an end-to-end wearable sports-science telemetry platform designed for elite athletic jump assessment, plyometric neuromuscular analysis, and injury risk mitigation.

The platform continuously samples 6-DoF inertial motion at **100 Hz (10 ms period)**, broadcasts dual-stack telemetry over **Wi-Fi Access Point (WebSocket on `:8080`)** and **Bluetooth Low Energy (Nordic UART Service)**, processes real-time kinematics, and displays live waveforms, 3D posture, and biomechanical KPIs.

---

## 2. Implemented Upgrades & Architecture Status

### A. Firmware & Hardware Engine (`c:\...\Kinetix_Wearable\src\main.cpp`)

| Parameter | Previous Setting | Upgraded Setting | Rationale |
| :--- | :--- | :--- | :--- |
| **Accelerometer Full Scale** | $\pm 2g$ ($16384\,\text{LSB}/g$) | **$\pm 8g$ ($4096\,\text{LSB}/g$)** | Athletic vertical jumps produce landing spikes $>4g-6g$. $\pm 8g$ prevents ADC flatline saturation. |
| **Gyroscope Full Scale** | Unconfigured | **$\pm 2000^\circ/\text{s}$ ($16.4\,\text{LSB}/(^\circ/\text{s})$)** | Accommodates rapid somersaults, flips, and explosive rotational countermovements. |
| **Digital Low-Pass Filter (DLPF)** | Default / 44 Hz | **$44\,\text{Hz}$ (`0x1A = 0x03`)** | Eliminates high-frequency mechanical vibration from shoe sole / bracket rattle while keeping jump impulse dynamics crisp. |
| **I2C Clock Speed** | $100\,\text{kHz}$ | **$400\,\text{kHz}$ Fast Mode** | Drops 14-byte I2C read cycle latency from $\approx 1.4\,\text{ms}$ down to $<350\,\mu\text{s}$, giving deterministic 100 Hz timing. |
| **Telemetry Payload** | Raw Accel + $t$ | **6-Axis (`x, y, z, gx, gy, gz, t, r:8`)** | Includes angular velocity and hardware dynamic range specifier for downstream clients. |
| **PlatformIO Build Flags** | None | **`-O2 -DCORE_DEBUG_LEVEL=0`** | Optimized compilation, reducing binary size and flash write overhead. |

### B. Biomechanics & Jump Detection Engine (`src/hooks/useJumpDetection.ts` & `src/utils/sensorMath.ts`)

- **Multi-Range Scale Factor Adaptor**:
  $$\text{Accel } (g) = \frac{\text{Raw ADC}}{\text{LSB}/g}, \quad \text{where } \text{LSB}/g = \begin{cases} 16384.0 & \text{if } \pm 2g \\ 4096.0 & \text{if } \pm 8g \\ 2048.0 & \text{if } \pm 16g \end{cases}$$
- **State Machine Architecture**:
  1. `STANDING`: 1.0g baseline monitoring.
  2. `DIP`: Countermovement unweighting ($g < 0.85g$).
  3. `TAKEOFF`: Explosive propulsion ($g > 1.35g$ or location-specific threshold).
  4. `AIRBORNE`: Zero-g freefall phase ($g < 0.45g$, duration $80\,\text{ms}-950\,\text{ms}$).
  5. `LANDING`: Deceleration shockwave impact ($g > 1.5g-2.2g$).
- **Flight Time & Jump Height Formula**:
  $$h_{\text{flight}} = \frac{1}{8} g \cdot t_{\text{hang}}^2 \approx 122.6 \cdot \left(\frac{t_{\text{hang}}}{1000}\right)^2 \quad (\text{cm})$$
- **Reactive Strength Index (RSI)**:
  $$\text{RSI} = \frac{\text{Flight Time (s)}}{\text{Ground Contact Time (s)}}$$
  Calculated across continuous plyometric sets (valid contact window $100\,\text{ms} - 900\,\text{ms}$).
- **Hardware Timestamp Precision**:
  Uses ESP32 microsecond clock (`doc["t"] = micros()`) to eliminate Android/OS network stack jitter during flight calculation.

### C. Live Telemetry Dashboard (`kinetix-backend/kinetix-dashboard/src/App.jsx`)

- Replaced default boilerplate with a dedicated **Telemetry Cockpit**:
  - Live WebSocket stream from relay server (`ws://localhost:8080`).
  - Real-time 100 Hz animated waveform chart using Recharts.
  - KPI cards for Live Resultant ($g$), Total Jumps, Peak Hang Time ($\text{ms}$ / $\text{cm}$), and Avg RSI / Peak Landing Shock.
  - Historical jump log table synchronizing directly with SQLite WAL database (`GET /api/jumps`).

---

## 3. Comprehensive Master List of Future Improvements

### Phase 1: High Priority (Firmware & Sensor Fusion) — [COMPLETED & VERIFIED]

1. **Gyroscope Pipeline to 3D Avatar (`JumpAvatar.tsx` & `App.tsx`)** [DONE]:
   - Piped streamed `gx, gy, gz` from `sensorState.gyro` ($\pm 2000^\circ/\text{s}$, $16.4\,\text{LSB}/(^\circ/\text{s})$) directly into Three.js quaternion rotation.
   - Provides live 3D postural visualization of torso tilt and spinal flexion during jumps.

2. **Binary BLE Telemetry (MTU Optimization)** [DONE]:
   - Implemented packed 19-byte binary frame (`0xAA` header + $3\times \text{int16}$ accel + $3\times \text{int16}$ gyro + $\text{uint32}$ timestamp + range) over Nordic UART TX.
   - Decoded with zero-allocation byte readers in `bluetooth.ts` for both native Android Capacitor BLE and desktop Web Bluetooth.

3. **FreeRTOS Dual-Core Execution** [DONE]:
   - Pinned MPU-6050 I2C sensor read loop to **Core 1** with `vTaskDelayUntil(10ms)`.
   - Runs Wi-Fi and BLE network communication on **Core 0** with a thread-safe FreeRTOS overwrite queue (`xQueueOverwrite`).

4. **Zero-g Dynamic Calibration (Tare Button & Command)** [DONE]:
   - Added Nordic UART RX characteristic (`6e400002-...`) and WebSocket command listener.
   - Triggering calibration in `CalibrationTab.tsx` fires `bleHardware.sendCommand('tare')` to perform a 100-sample hardware zero on ESP32 Core 1.

---

### Phase 2: Medium Priority (Power Management & Data Resilience) — [COMPLETED & VERIFIED]

1. **Wake-on-Motion (WoM) & Idle Light Sleep** [DONE]:
   - Monitored perturbation above resting 1g ($|\Delta a| > 0.15g$) to update `lastMotionTime`.
   - If device is stationary for $>2\,\text{minutes}$ with no active BLE/Wi-Fi client, ESP32 enters low-power `esp_light_sleep_start()` with a 2-second timer wakeup, extending battery life significantly.

2. **Offline Blackbox Flash & Queue Sync (`/api/jumps/sync`)** [DONE]:
   - Added offline jump queue persistence (`kinetix_offline_jumps` in `localStorage`) in `useJumpDetection.ts`.
   - Built atomic transaction endpoint `POST /api/jumps/sync` in `server.js` using SQLite WAL mode to batch insert drained offline jumps when connection recovers.

3. **Battery Voltage Monitoring (ADC Divider)** [DONE]:
   - Configured GPIO 34 12-bit ADC battery reader with voltage divider math ($3.4\text{V}-4.2\text{V} \rightarrow 0-100\%$).
   - Broadcasts live battery percentage (`doc["bat"]`) over JSON telemetry and updates `sensorState.batteryPercent`.

4. **Tri-Color Landing Shock Attenuation Classification** [DONE]:
   - Integrated dynamic per-jump shock classification in `AnalysisTab.tsx` Bar chart:
     - 🟢 Green: Safe ($< 3.5g$)
     - 🟡 Yellow: Moderate ($3.5g - 4.5g$)
     - 🔴 Red: Severe Shock ($> 4.5g$ limit exceeding threshold)

---

### Phase 3: Advanced Analytics & Coach Tools — [COMPLETED & VERIFIED]

1. **Dip Depth & Eccentric Rate of Force Development (RFD)** [DONE]:
   - Tracked minimum countermovement unweighting during `DIP` to calculate vertical displacement ($d = 0.5 \cdot \Delta a_{\text{unweight}} \cdot g \cdot \Delta t^2$ in $\text{cm}$).
   - Computed concentric Rate of Force Development ($\text{RFD} = \frac{\Delta a}{\Delta t}$ into takeoff in $g/\text{s}$) to quantify explosive power.

2. **Landing Shock Attenuation Classification** [DONE]:
   - Integrated dynamic per-jump shock classification in `AnalysisTab.tsx`:
     - 🟢 Green: Safe ($< 3.5g$)
     - 🟡 Yellow: Moderate ($3.5g - 4.5g$)
     - 🔴 Red: Severe Shock ($> 4.5g$ limit exceeding threshold)

3. **Session Export (CSV & Telemetry Cockpit Dump)** [DONE]:
   - Added instant one-click CSV export in both mobile `AnalysisTab.tsx` and desktop `kinetix-dashboard/src/App.jsx`.
   - Exports complete jump kinematics: Jump Number, Timestamp, Hang Time ($\text{ms}$), Height ($\text{cm}$), Landing Shock ($g$), Takeoff Accel ($g$), GCT ($\text{ms}$), RSI, Dip Depth ($\text{cm}$), and RFD ($g/\text{s}$).

4. **Multi-Node Asymmetry Readiness** [DONE]:
   - Telemetry schemas and parsing adapt to range indicator `r` and node identifier tags.
   - Live battery voltage measurement ($3.4\text{V}-4.2\text{V} \rightarrow 0-100\%$) displayed directly in mobile & desktop headers.

---

### Phase 4: Production Field Polish & Real-Time Sync — [COMPLETED & VERIFIED]

1. **Battery Level Display in Navigation Headers** [DONE]:
   - Live dynamic battery indicator pill added to mobile and desktop headers in `Header.tsx` displaying real-time charge percentage with icon state changes.
2. **Double-Integration Dip Depth & RFD Visualization** [DONE]:
   - Squat depth ($\text{cm}$) and Rate of Force Development ($g/\text{s}$) rendered in jump attempt lists and telemetry exports.
3. **Firmware Over-The-Air (OTA) Updates (`ArduinoOTA`)** [DONE]:
   - Integrated `ArduinoOTA` service listening on port 3232 (`kinetix-wearable.local`) over the Wi-Fi Access Point, enabling wireless field reprogramming without physical USB tethering.
4. **Haptic & Acoustic Deceleration Warning** [DONE]:
   - Implemented dual-action alert in `audio.ts` & `LiveTab.tsx` triggering native device vibration (`[150, 50, 200]ms`) and dissonance acoustic tones whenever landing impact exceeds $\ge 4.5g$.

---

### Phase 5: Persistent Flash Calibration & Neuromuscular Readiness — [COMPLETED & VERIFIED]

1. **ESP32 NVS Flash Persistent Calibration (Option B)** [DONE]:
   - Integrated ESP32 `<Preferences.h>` non-volatile flash storage under namespace `kinetix_cal`.
   - On hardware tare (`triggerTareCalibration()`), offsets for all 6 axes (`offsetAcX`, `offsetAcY`, `offsetAcZ`, `offsetGyX`, `offsetGyY`, `offsetGyZ`) are written to ESP32 Flash memory (`saveCalibrationToNVS()`).
   - On boot, `loadSavedCalibration()` restores offsets automatically without requiring a mobile re-tare.

2. **Neuromuscular Fatigue Drop-Off Engine (Option C)** [DONE]:
   - Dynamically tracks athletic jump output degradation against session peak baseline ($h_{\text{peak}}$).
   - If jump height decreases by $>15\%$ below peak ($h < 0.85 \cdot h_{\text{peak}}$):
     - Displays real-time on-screen `FATIGUE DROP-OFF (>15%)` amber warning pill in `LiveTab.tsx`.
     - Triggers descending dual-tone audio alert ($520\,\text{Hz} \rightarrow 340\,\text{Hz}$) and haptic double-pulse vibration `[80, 60, 120]ms` via `audioEngine.playFatigueWarning()`.
     - Signals coach and athlete to terminate the plyometric set to avoid compensatory injury.

---

### Phase 6: Biomechanical Intelligence, EUR & Voice Coaching — [COMPLETED & VERIFIED]

1. **Automated Jump Classification (CMJ vs. SJ vs. Drop Jump)** [DONE]:
   - Kinetic signature detection in `useJumpDetection.ts`:
     - $\text{GCT} < 350\,\text{ms} \rightarrow$ **Drop Jump (DJ)**.
     - Unweighting dip depth $\ge 2.5\,\text{cm} \rightarrow$ **Countermovement Jump (CMJ)**.
     - Stationary concentric launch ($< 2.5\,\text{cm} \text{ dip}) \rightarrow$ **Squat Jump (SJ)**.
   - Jump types displayed with color-coded badges in live cards and historical analysis tables.

2. **Eccentric Utilization Ratio (EUR)** [DONE]:
   - Computed across session jumps: $\text{EUR} = \frac{\overline{\text{CMJ}}}{\overline{\text{SJ}}}$.
   - Displayed in `AnalysisTab.tsx` with athletic categorization: High Elastic SSC ($\ge 1.10$), Balanced ($1.00 - 1.09$), or Concentric Strength Dominant ($< 1.00$).

3. **Real-Time Voice Audio Coaching** [DONE]:
   - Integrated browser/native Web Speech API (`SpeechSynthesis`) in `audio.ts`.
   - Announces jump heights (*"42.5 centimeters"*), personal bests (*"New peak! 48.0 centimeters"*), fatigue warnings, and excessive landing shock hazards aloud.

4. **Tare Motion Stability Confidence Metric** [DONE]:
   - Computes 3-axis standard deviation ($\sigma$) during the 100-sample tare window in `main.cpp`.
   - Rejects calibration with `tare_failed` event if the athlete moves excessively ($\sigma > 600\,\text{LSB}$), ensuring offset integrity.

---

### Phase 7: Gold-Standard Jump Height Accuracy Engine — [COMPLETED & VERIFIED]

1. **True Numerical Propulsion Velocity Integration ($v_0 = \int (a_z - 1)g \, dt$)** [DONE]:
   - Samples 100Hz vertical net acceleration through the entire concentric phase from lowest dip to toe-off.
   - Computes takeoff velocity via trapezoidal numerical integration, eliminating static takeoff duration assumptions and providing drift-free impulse height ($h = \frac{v_0^2}{2g}$).

2. **Landing Crouch / Knee-Flexion Compensation Factor** [DONE]:
   - Analyzes landing deceleration duration to detect artificial hang-time created when athletes land in deep knee flexion or tuck their knees in mid-air.
   - Subtracts excess compliance duration ($\Delta t_{\text{crouch}}$) to preserve center-of-mass jump height fidelity.

3. **Dynamic Adaptive Bayesian Fusion** [DONE]:
   - Dynamically weights flight-time kinematics against numerical impulse kinematics based on landing posture:
     - Heavy landing crouch ($\Delta t_{\text{crouch}} > 20\,\text{ms}$) $\rightarrow$ 75% Impulse / 25% Flight.
     - Stiff upright landing $\rightarrow$ 60% Flight / 40% Impulse.

---

## 4. System Directory Map

```text
├── Kinetix_Wearable/                # ESP32 Firmware & Backend Service
│   ├── platformio.ini               # PlatformIO config (-O2, huge_app, dependencies)
│   ├── src/main.cpp                 # 100Hz MPU-6050 ±8g sampler, AP Wi-Fi WS & BLE server
│   └── kinetix-backend/
│       ├── server.js                # Express REST API (:3001) + WebSocket relay (:8080) + SQLite
│       ├── history.db               # SQLite database with WAL journal mode
│       └── kinetix-dashboard/       # Vite React cockpit for live jump telemetry
│           └── src/App.jsx          # Live 100Hz waveform, KPIs & jump records table
│
└── kinetix/                         # Athlete Mobile / PWA Client
    ├── src/App.tsx                  # Core state, WebSocket & BLE stream router
    ├── src/components/
    │   ├── LiveTab.tsx              # Live jump dashboard, real-time audio chime, JumpAvatar
    │   ├── JumpAvatar.tsx           # Three.js 3D athlete posture representation
    │   ├── AnalysisTab.tsx          # Jump analytics, charts & athlete fatigue metrics
    │   ├── CalibrationTab.tsx       # Sensor tare & sensitivity calibration
    │   ├── Header.tsx               # Status badges & live battery indicator
    │   └── ConnectionSettingsPanel.tsx # IP, port, and connection mode switcher
    ├── src/hooks/useJumpDetection.ts # Kinematic state machine (GCT, RSI, hang time)
    └── src/utils/
        ├── sensorMath.ts            # LSB/g conversion for ±2g, ±8g, ±16g
        └── bluetooth.ts             # Web Bluetooth & Capacitor Native BLE client
```
