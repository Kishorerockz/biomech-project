#include <Arduino.h>
#include <WiFi.h>
#include <Wire.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>

#include <Preferences.h>

// ESP32 BLE Server Libraries
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ═══════════════════════════════════════════════════════════════
// 1. Packed Binary Telemetry Packet (19 Bytes)
//    Magic byte 0xAA for lightning-fast zero-allocation parsing
// ═══════════════════════════════════════════════════════════════
#pragma pack(push, 1)
struct TelemetryPacket {
  uint8_t  header;       // 0xAA magic byte
  int16_t  accelX;       // +/- 8g (4096 LSB/g)
  int16_t  accelY;
  int16_t  accelZ;
  int16_t  gyroX;        // +/- 2000 deg/s (16.4 LSB/deg/s)
  int16_t  gyroY;
  int16_t  gyroZ;
  uint32_t timestampUs;  // Hardware microsecond timestamp
  uint8_t  range;        // 8 for +/-8g
};
#pragma pack(pop)

// ═══════════════════════════════════════════════════════════════
// 2. Calibration Offsets & Dynamic Tare (NVS Flash Persistent)
// ═══════════════════════════════════════════════════════════════
Preferences preferences;
const char* NVS_NAMESPACE = "kinetix_cal";

volatile int16_t offsetAcX = 0;
volatile int16_t offsetAcY = 0;
volatile int16_t offsetAcZ = 0; // Target +4096 (1g) on Z
volatile int16_t offsetGyX = 0;
volatile int16_t offsetGyY = 0;
volatile int16_t offsetGyZ = 0;
volatile bool isCalibrating = false;

void loadSavedCalibration() {
  preferences.begin(NVS_NAMESPACE, true); // read-only mode
  offsetAcX = preferences.getShort("acX", 0);
  offsetAcY = preferences.getShort("acY", 0);
  offsetAcZ = preferences.getShort("acZ", 0);
  offsetGyX = preferences.getShort("gyX", 0);
  offsetGyY = preferences.getShort("gyY", 0);
  offsetGyZ = preferences.getShort("gyZ", 0);
  preferences.end();
  Serial.printf("[NVS] Loaded Calibration -> Accel: (%d, %d, %d), Gyro: (%d, %d, %d)\n",
                offsetAcX, offsetAcY, offsetAcZ, offsetGyX, offsetGyY, offsetGyZ);
}

void saveCalibrationToNVS() {
  preferences.begin(NVS_NAMESPACE, false); // read-write mode
  preferences.putShort("acX", offsetAcX);
  preferences.putShort("acY", offsetAcY);
  preferences.putShort("acZ", offsetAcZ);
  preferences.putShort("gyX", offsetGyX);
  preferences.putShort("gyY", offsetGyY);
  preferences.putShort("gyZ", offsetGyZ);
  preferences.end();
  Serial.println("[NVS] Calibration offsets permanently saved to ESP32 Flash!");
}

// ═══════════════════════════════════════════════════════════════
// 2b. Battery ADC & Power Management (GPIO 34)
// ═══════════════════════════════════════════════════════════════
const int BATTERY_ADC_PIN = 34;
unsigned long lastMotionTime = 0;
const unsigned long IDLE_SLEEP_TIMEOUT_MS = 120000; // 2 minutes stationary -> light sleep

uint8_t readBatteryPercent() {
  // 12-bit ADC (0 - 4095). With 100k/100k divider on 4.2V LiPo:
  // V_pin = V_bat / 2. Max 2.1V -> ADC reading ≈ 2600 (using 3.3V reference)
  int raw = analogRead(BATTERY_ADC_PIN);
  if (raw < 1500) return 100; // Fallback if no divider is plugged in
  float voltage = (raw / 4095.0) * 3.3 * 2.0; // Battery voltage (3.3V - 4.2V)
  int pct = (int)((voltage - 3.4) / (4.2 - 3.4) * 100.0);
  return (uint8_t)constrain(pct, 0, 100);
}

// ═══════════════════════════════════════════════════════════════
// 3. Wi-Fi Access Point + Direct WebSocket Server
// ═══════════════════════════════════════════════════════════════
const char* AP_SSID     = "Kinetix-WiFi";
const char* AP_PASSWORD = "kinetix123";
const uint16_t WEBSOCKET_PORT = 8080;

WebSocketsServer webSocket = WebSocketsServer(WEBSOCKET_PORT);
bool isWifiConnected = false;
uint8_t connectedWsClients = 0;

void triggerTareCalibration();

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      if (connectedWsClients > 0) connectedWsClients--;
      Serial.printf("[WS] Client [%u] Disconnected! Total clients: %u\n", num, connectedWsClients);
      break;
    case WStype_CONNECTED: {
      connectedWsClients++;
      IPAddress ip = webSocket.remoteIP(num);
      Serial.printf("[WS] Client [%u] Connected from %s! Total clients: %u\n", num, ip.toString().c_str(), connectedWsClients);
      break;
    }
    case WStype_TEXT: {
      if (length > 0) {
        String msg = String((char*)payload).substring(0, length);
        if (msg.indexOf("tare") >= 0 || msg.indexOf("calibrate") >= 0) {
          triggerTareCalibration();
        }
      }
      break;
    }
    default:
      break;
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. BLE Configuration (UART Service with TX notify & RX write)
// ═══════════════════════════════════════════════════════════════
#define SERVICE_UUID           "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_TX "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
#define CHARACTERISTIC_UUID_RX "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"

BLEServer* pServer = nullptr;
BLECharacteristic* pTxCharacteristic = nullptr;
BLECharacteristic* pRxCharacteristic = nullptr;
bool deviceConnected = false;
bool oldDeviceConnected = false;

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("[BLE] Client connected directly!");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("[BLE] Client disconnected.");
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    if (value.length() > 0) {
      Serial.printf("[BLE RX]: %s\n", value.c_str());
      if (value.find("tare") != std::string::npos || value.find("calibrate") != std::string::npos) {
        triggerTareCalibration();
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════════
// 5. FreeRTOS Inter-Core Queue & Sensor Struct
// ═══════════════════════════════════════════════════════════════
QueueHandle_t telemetryQueue = nullptr;
const int MPU_ADDR = 0x68;

void initMPU6050() {
  Wire.begin();
  Wire.setClock(400000); // 400kHz Fast I2C

  // 1. Wake up MPU-6050
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x6B);
  Wire.write(0x00);
  Wire.endTransmission(true);
  delay(10);

  // 2. Configure DLPF: 188Hz bandwidth (sharper landing transient detection)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1A);
  Wire.write(0x01);
  Wire.endTransmission(true);

  // 3. Set Accelerometer Full-Scale Range to ±8g (4096 LSB/g)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1C);
  Wire.write(0x10);
  Wire.endTransmission(true);

  // 4. Set Gyroscope Full-Scale Range to ±2000 deg/s (16.4 LSB/deg/s)
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x1B);
  Wire.write(0x18);
  Wire.endTransmission(true);

  Serial.println("[MPU-6050] Configured: ±8g range (4096 LSB/g), ±2000 deg/s, 188Hz DLPF.");
}

void triggerTareCalibration() {
  if (isCalibrating) return;
  isCalibrating = true;
  Serial.println("[TARE] Starting 1-second resting calibration...");

  long sumAx = 0, sumAy = 0, sumAz = 0;
  long sumGx = 0, sumGy = 0, sumGz = 0;
  long long sumSqAx = 0, sumSqAy = 0, sumSqAz = 0;
  const int TARE_SAMPLES = 100;

  for (int i = 0; i < TARE_SAMPLES; i++) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)MPU_ADDR, (size_t)14, true);

    int16_t ax = (Wire.read() << 8) | Wire.read();
    int16_t ay = (Wire.read() << 8) | Wire.read();
    int16_t az = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read();
    int16_t gx = (Wire.read() << 8) | Wire.read();
    int16_t gy = (Wire.read() << 8) | Wire.read();
    int16_t gz = (Wire.read() << 8) | Wire.read();

    sumAx += ax;
    sumAy += ay;
    sumAz += az;
    sumSqAx += (long long)ax * ax;
    sumSqAy += (long long)ay * ay;
    sumSqAz += (long long)az * az;
    sumGx += gx;
    sumGy += gy;
    sumGz += gz;
    delay(10);
  }

  // Calculate motion variance: if athlete moved excessively, abort tare
  double meanAx = (double)sumAx / TARE_SAMPLES;
  double meanAy = (double)sumAy / TARE_SAMPLES;
  double meanAz = (double)sumAz / TARE_SAMPLES;
  double varAx = ((double)sumSqAx / TARE_SAMPLES) - (meanAx * meanAx);
  double varAy = ((double)sumSqAy / TARE_SAMPLES) - (meanAy * meanAy);
  double varAz = ((double)sumSqAz / TARE_SAMPLES) - (meanAz * meanAz);
  double totalStdDev = sqrt(max(0.0, varAx) + max(0.0, varAy) + max(0.0, varAz));

  // Reject tare if sensor had severe movement (variance threshold in LSBs ≈ 0.15g)
  if (totalStdDev > 600.0) {
    isCalibrating = false;
    Serial.printf("[TARE] REJECTED: Excessive movement detected (StdDev=%.1f LSB). Keep sensor steady.\n", totalStdDev);
    if (isWifiConnected && connectedWsClients > 0) {
      webSocket.broadcastTXT("{\"event\":\"tare_failed\",\"reason\":\"movement_detected\"}");
    }
    return;
  }

  // Dynamic gravity axis detection: find which axis holds gravity (±4096 LSB)
  // Works regardless of sensor mounting orientation (waist, ankle, arm)
  int16_t avgX = sumAx / TARE_SAMPLES;
  int16_t avgY = sumAy / TARE_SAMPLES;
  int16_t avgZ = sumAz / TARE_SAMPLES;

  if (abs(avgZ) >= abs(avgX) && abs(avgZ) >= abs(avgY)) {
    offsetAcX = avgX;
    offsetAcY = avgY;
    offsetAcZ = avgZ - (avgZ > 0 ? 4096 : -4096);
  } else if (abs(avgY) >= abs(avgX)) {
    offsetAcX = avgX;
    offsetAcY = avgY - (avgY > 0 ? 4096 : -4096);
    offsetAcZ = avgZ;
  } else {
    offsetAcX = avgX - (avgX > 0 ? 4096 : -4096);
    offsetAcY = avgY;
    offsetAcZ = avgZ;
  }
  offsetGyX = sumGx / TARE_SAMPLES;
  offsetGyY = sumGy / TARE_SAMPLES;
  offsetGyZ = sumGz / TARE_SAMPLES;

  isCalibrating = false;
  Serial.printf("[TARE] Complete! Quality Score: HIGH (StdDev=%.1f). Offsets -> Accel: (%d, %d, %d), Gyro: (%d, %d, %d)\n",
                totalStdDev, offsetAcX, offsetAcY, offsetAcZ, offsetGyX, offsetGyY, offsetGyZ);

  // Permanently save calibration offsets to ESP32 Flash memory
  saveCalibrationToNVS();

  // Broadcast calibration confirmation
  if (isWifiConnected && connectedWsClients > 0) {
    webSocket.broadcastTXT("{\"event\":\"tare_success\"}");
  }
}

// ═══════════════════════════════════════════════════════════════
// 6. FreeRTOS Core 1 Task: Dedicated 100Hz Sensor Sampling
// ═══════════════════════════════════════════════════════════════
void sensorTask(void *pvParameters) {
  TickType_t xLastWakeTime = xTaskGetTickCount();
  const TickType_t xFrequency = pdMS_TO_TICKS(10); // Exactly 10ms = 100Hz

  while (true) {
    vTaskDelayUntil(&xLastWakeTime, xFrequency);

    if (isCalibrating) continue;

    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)MPU_ADDR, (size_t)14, true);

    int16_t rawAx = (Wire.read() << 8) | Wire.read();
    int16_t rawAy = (Wire.read() << 8) | Wire.read();
    int16_t rawAz = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read();
    int16_t rawGx = (Wire.read() << 8) | Wire.read();
    int16_t rawGy = (Wire.read() << 8) | Wire.read();
    int16_t rawGz = (Wire.read() << 8) | Wire.read();

    TelemetryPacket packet;
    packet.header = 0xAA;
    packet.accelX = rawAx - offsetAcX;
    packet.accelY = rawAy - offsetAcY;
    packet.accelZ = rawAz - offsetAcZ;
    packet.gyroX  = rawGx - offsetGyX;
    packet.gyroY  = rawGy - offsetGyY;
    packet.gyroZ  = rawGz - offsetGyZ;
    packet.timestampUs = micros();
    packet.range = 8; // ±8g mode

    if (telemetryQueue != nullptr) {
      // Send to queue; if full, drop this sample (better than overwriting mid-read)
      xQueueSend(telemetryQueue, &packet, 0);
    }
  }
}

void startWiFiAP() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress myIP = WiFi.softAPIP();
  isWifiConnected = true;

  Serial.printf("[Wi-Fi AP] Started! SSID: '%s'  Password: '%s'\n", AP_SSID, AP_PASSWORD);
  Serial.printf("[Wi-Fi AP] ESP32 IP: %s\n", myIP.toString().c_str());

  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
  Serial.printf("[WS] WebSocket Server: ws://%s:%u\n", myIP.toString().c_str(), WEBSOCKET_PORT);

  // Initialize Wireless Over-The-Air (OTA) Updates over Kinetix-WiFi AP
  ArduinoOTA.setHostname("kinetix-wearable");
  ArduinoOTA.setPassword("kinetix123");
  ArduinoOTA
    .onStart([]() {
      Serial.println("[OTA] Wireless firmware flash started...");
    })
    .onEnd([]() {
      Serial.println("\n[OTA] Firmware flash complete! Rebooting...");
    })
    .onError([](ota_error_t error) {
      Serial.printf("[OTA] Error[%u]\n", error);
    });
  ArduinoOTA.begin();
  Serial.println("[OTA] ArduinoOTA service active on Kinetix-WiFi!");
}

void initBLE() {
  Serial.println("[BLE] Initializing Dual-Mode BLE Server...");
  BLEDevice::init("Kinetix-ESP32");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_TX,
                        BLECharacteristic::PROPERTY_NOTIFY
                      );
  pTxCharacteristic->addDescriptor(new BLE2902());

  pRxCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID_RX,
                        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
                      );
  pRxCharacteristic->setCallbacks(new RxCallbacks());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising ready! TX (Notify) + RX (Command Write).");
}

void setup() {
  Serial.begin(115200);

  // Initialize hardware sensor
  initMPU6050();

  // Load persistent calibration offsets from ESP32 Flash (NVS)
  loadSavedCalibration();

  // Create single-item overwrite queue for zero-latency inter-core telemetry
  // Queue depth 10: prevents Core 0 processing bursts from dropping samples
  telemetryQueue = xQueueCreate(10, sizeof(TelemetryPacket));

  // Launch Core 1 Dedicated Sensor Task at high priority (Priority 3)
  xTaskCreatePinnedToCore(
    sensorTask,
    "Sensor100Hz",
    4096,
    nullptr,
    3,
    nullptr,
    1 // Pin to Core 1
  );

  // Start BLE Server on Core 0 (default loop core)
  initBLE();

  // Start Wi-Fi Access Point + WebSocket Server
  startWiFiAP();

  Serial.println("\n=======================================================");
  Serial.println("  KINETIX ESP32 WEARABLE DUAL-CORE TELEMETRY ACTIVE");
  Serial.println("  Core 1: 100Hz MPU-6050 (Deterministic 10ms tick)");
  Serial.println("  Core 0: BLE & Wi-Fi Binary/JSON Pipeline");
  Serial.println("  Dynamic Range: ±8g (4096 LSB/g) | ±2000 deg/s");
  Serial.println("=======================================================\n");
}

unsigned long lastStatusPrint = 0;
unsigned long lastSerialPrint = 0;

void loop() {
  // Service Wireless OTA firmware flash listener
  ArduinoOTA.handle();

  // Service WebSocket network loop on Core 0
  webSocket.loop();

  // Heartbeat status print every 5s
  if (millis() - lastStatusPrint > 5000) {
    lastStatusPrint = millis();
    Serial.printf("[STATUS] AP up | WS Clients: %u | BLE: %s\n",
                  connectedWsClients, deviceConnected ? "CONNECTED" : "ADVERTISING");
  }

  // Handle BLE auto-advertising reconnect
  if (!deviceConnected && oldDeviceConnected) {
    delay(200);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarting advertising...");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // Receive telemetry packet produced by Core 1
  TelemetryPacket packet;
  if (xQueueReceive(telemetryQueue, &packet, 0) == pdTRUE) {
    // 1. BLE Transmission: Send Compact Binary Frame (19 Bytes)
    // 0xAA | Ax(2) | Ay(2) | Az(2) | Gx(2) | Gy(2) | Gz(2) | TimeUs(4) | Range(1)
    if (deviceConnected && pTxCharacteristic != nullptr) {
      pTxCharacteristic->setValue((uint8_t*)&packet, sizeof(TelemetryPacket));
      pTxCharacteristic->notify();
    }

    // Dynamic motion detector: if movement is detected, update lastMotionTime
    int32_t netAccel = abs((int32_t)packet.accelX) + abs((int32_t)packet.accelY) + abs((int32_t)packet.accelZ - 4096);
    if (netAccel > 600) { // Approx 0.15g perturbation above resting 1g
      lastMotionTime = millis();
    }

    // 2. Wi-Fi WebSocket & Serial: Send JSON Payload
    // Format JSON document
    JsonDocument doc;
    doc["x"] = packet.accelX;
    doc["y"] = packet.accelY;
    doc["z"] = packet.accelZ;
    doc["gx"] = packet.gyroX;
    doc["gy"] = packet.gyroY;
    doc["gz"] = packet.gyroZ;
    doc["t"] = packet.timestampUs;
    doc["r"] = packet.range;
    // Cache battery read (ADC is slow ~100μs) — update every 5 seconds only
    static unsigned long lastBatRead = 0;
    static uint8_t cachedBat = 100;
    if (millis() - lastBatRead > 5000) {
      cachedBat = readBatteryPercent();
      lastBatRead = millis();
    }
    doc["bat"] = cachedBat;

    String jsonString;
    serializeJson(doc, jsonString);

    if (isWifiConnected && connectedWsClients > 0) {
      webSocket.broadcastTXT(jsonString);
    }

    // Rate-limited serial debug output (every 50ms)
    if (millis() - lastSerialPrint >= 50) {
      Serial.println(jsonString);
      lastSerialPrint = millis();
    }
  }

  // Automatic Power Management: If inactive for > IDLE_SLEEP_TIMEOUT_MS and no client connected
  if (millis() - lastMotionTime > IDLE_SLEEP_TIMEOUT_MS && !deviceConnected && connectedWsClients == 0) {
    Serial.println("[POWER] Device stationary for 2 mins & no clients connected. Entering Light Sleep (Wake on Timer/Radio)...");
    esp_sleep_enable_timer_wakeup(2000000); // 2s wake interval to poll for movement
    esp_light_sleep_start();
    lastMotionTime = millis(); // Reset upon wake
  }
}