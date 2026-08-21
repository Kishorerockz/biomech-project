#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
// Update with the local machine's IP address wherever Node is running
const char* backendUrl = "http://192.168.1.xxx:5000/api/sessions/"; 
String sessionId = "hardware_athlete"; // Replace or fetch dynamically

const int MPU_ADDR = 0x68; // I2C address of the MPU-6050

struct TelemetryPacket {
    unsigned long timestamp;
    float accelX;
    float accelY;
    float accelZ;
    float gyroX;
    float gyroY;
    float gyroZ;
};

// Ring buffer to prevent data loss on brief WiFi disconnects
const int RING_BUFFER_SIZE = 20;
TelemetryPacket ringBuffer[RING_BUFFER_SIZE];
int bufferHead = 0;
int bufferTail = 0;
int bufferCount = 0;

void setup() {
    Serial.begin(115200);
    Wire.begin();
    
    // Initialize MPU-6050
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x6B); // PWR_MGMT_1 register
    Wire.write(0);    // set to zero (wakes up the MPU-6050)
    Wire.endTransmission(true);

    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected.");
}

void enqueue(TelemetryPacket pkt) {
    if (bufferCount < RING_BUFFER_SIZE) {
        ringBuffer[bufferHead] = pkt;
        bufferHead = (bufferHead + 1) % RING_BUFFER_SIZE;
        bufferCount++;
    } else {
        // Buffer full, drop oldest and overwrite
        ringBuffer[bufferTail] = pkt; 
        bufferTail = (bufferTail + 1) % RING_BUFFER_SIZE;
        bufferHead = bufferTail; 
    }
}

TelemetryPacket dequeue() {
    TelemetryPacket pkt = ringBuffer[bufferTail];
    bufferTail = (bufferTail + 1) % RING_BUFFER_SIZE;
    bufferCount--;
    return pkt;
}

void loop() {
    // Read 14 bytes from MPU-6050
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x3B); // starting with register 0x3B (ACCEL_XOUT_H)
    Wire.endTransmission(false);
    Wire.requestFrom((uint16_t)MPU_ADDR, (uint8_t)14, true);

    int16_t AcX, AcY, AcZ, Tmp, GyX, GyY, GyZ;
    AcX = Wire.read() << 8 | Wire.read();
    AcY = Wire.read() << 8 | Wire.read();
    AcZ = Wire.read() << 8 | Wire.read();
    Tmp = Wire.read() << 8 | Wire.read(); // Temperature, ignored for telemetry payload
    GyX = Wire.read() << 8 | Wire.read();
    GyY = Wire.read() << 8 | Wire.read();
    GyZ = Wire.read() << 8 | Wire.read();

    TelemetryPacket pkt;
    // We'll use millis() for testing, but epoch ms via NTP is better for real deployment
    pkt.timestamp = millis(); 
    
    // Convert to true units
    // Assuming default +/- 2g range (16384 LSB/g) and +/- 250 deg/s range (131 LSB/deg/s)
    pkt.accelX = AcX / 16384.0;
    pkt.accelY = AcY / 16384.0;
    pkt.accelZ = AcZ / 16384.0;
    pkt.gyroX = GyX / 131.0;
    pkt.gyroY = GyY / 131.0;
    pkt.gyroZ = GyZ / 131.0;

    enqueue(pkt);

    // If WiFi connected, try to flush the buffer
    if (WiFi.status() == WL_CONNECTED) {
        while (bufferCount > 0) {
            TelemetryPacket p = ringBuffer[bufferTail]; // peek at the oldest item
            
            // Build the JSON Payload matching strictly with the data contract
            StaticJsonDocument<256> doc;
            doc["sessionId"] = sessionId;
            doc["timestamp"] = p.timestamp; 
            
            JsonObject accel = doc.createNestedObject("accel");
            accel["x"] = p.accelX;
            accel["y"] = p.accelY;
            accel["z"] = p.accelZ;

            JsonObject gyro = doc.createNestedObject("gyro");
            gyro["x"] = p.gyroX;
            gyro["y"] = p.gyroY;
            gyro["z"] = p.gyroZ;
            
            doc["battery"] = 100; // Mock battery level, could add real voltage divider later

            String jsonPayload;
            serializeJson(doc, jsonPayload);

            HTTPClient http;
            String url = String(backendUrl) + sessionId + "/telemetry";
            http.begin(url);
            http.addHeader("Content-Type", "application/json");

            int httpResponseCode = http.POST(jsonPayload);
            if (httpResponseCode > 0) {
                // Successfully received response
                dequeue(); // safe to remove from buffer
            } else {
                Serial.printf("Error POSTing JSON data (%d)\n", httpResponseCode);
                http.end();
                break; // Stop flushing and preserve data in ring buffer till next loop
            }
            http.end();
        }
    }

    // Delay to hit ~10Hz sample rate (100ms)
    delay(100);
}
