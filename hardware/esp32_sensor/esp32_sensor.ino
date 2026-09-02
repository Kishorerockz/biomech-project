#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <SocketIOclient.h>
#include <Wire.h>

WiFiMulti WiFiMulti;
SocketIOclient socketIO;

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Use your Node.js server's IP address
const char* backendHost = "192.168.1.100";  
const uint16_t backendPort = 5000;
String sessionId = "hardware_athlete"; // Replace or fetch dynamically once auth is set up

const int MPU_ADDR = 0x68; // I2C address of the MPU-6050

// We can dramatically increase refresh rate now that we use WebSockets!
unsigned long messageTimestamp = 0;
const int REFRESH_RATE = 20; // 50 Hz streaming rate (20ms)

void socketIOEvent(socketIOmessageType_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case sIOtype_DISCONNECT:
            Serial.printf("[IOc] Disconnected!\n");
            break;
        case sIOtype_CONNECT:
            Serial.printf("[IOc] Connected to url: %s\n", payload);
            socketIO.send(sIOtype_CONNECT, "/"); // join default namespace
            break;
        case sIOtype_EVENT:
            Serial.printf("[IOc] get event: %s\n", payload);
            break;
        case sIOtype_ACK:
        case sIOtype_ERROR:
        case sIOtype_BINARY_EVENT:
        case sIOtype_BINARY_ACK:
            break;
    }
}

void setup() {
    Serial.begin(115200);
    Wire.begin();
    
    // Initialize MPU-6050
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(0x6B); // PWR_MGMT_1 register
    Wire.write(0);    // wakes up the MPU-6050
    Wire.endTransmission(true);

    WiFiMulti.addAP(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFiMulti.run() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected.");

    // Initialize Socket.io connection
    socketIO.begin(backendHost, backendPort, "/socket.io/?EIO=4");
    socketIO.onEvent(socketIOEvent);
}

void loop() {
    socketIO.loop();

    unsigned long currentMillis = millis();
    
    if (currentMillis - messageTimestamp >= REFRESH_RATE) {
        messageTimestamp = currentMillis;

        // Read 14 bytes from MPU-6050
        Wire.beginTransmission(MPU_ADDR);
        Wire.write(0x3B); 
        Wire.endTransmission(false);
        Wire.requestFrom((uint16_t)MPU_ADDR, (uint8_t)14, true);

        int16_t AcX = Wire.read() << 8 | Wire.read();
        int16_t AcY = Wire.read() << 8 | Wire.read();
        int16_t AcZ = Wire.read() << 8 | Wire.read();
        int16_t Tmp = Wire.read() << 8 | Wire.read(); 
        int16_t GyX = Wire.read() << 8 | Wire.read();
        int16_t GyY = Wire.read() << 8 | Wire.read();
        int16_t GyZ = Wire.read() << 8 | Wire.read();

        // Convert to target units
        float accelX = AcX / 16384.0;
        float accelY = AcY / 16384.0;
        float accelZ = AcZ / 16384.0;
        float gyroX = GyX / 131.0;
        float gyroY = GyY / 131.0;
        float gyroZ = GyZ / 131.0;

        // Build Payload
        DynamicJsonDocument doc(1024);
        JsonArray array = doc.to<JsonArray>();
        
        // Standard shape for Socket.io emit: ["event_name", { payload_object }]
        array.add("hardware_data");
        
        JsonObject payload = array.createNestedObject();
        payload["sessionId"] = sessionId;
        payload["timestamp"] = currentMillis; 
        
        JsonObject accel = payload.createNestedObject("accel");
        accel["x"] = accelX;
        accel["y"] = accelY;
        accel["z"] = accelZ;

        JsonObject gyro = payload.createNestedObject("gyro");
        gyro["x"] = gyroX;
        gyro["y"] = gyroY;
        gyro["z"] = gyroZ;
        
        payload["battery"] = 100; // Mock battery

        // JSON to String
        String output;
        serializeJson(doc, output);
        
        // Emill directly over WebSocket
        socketIO.sendEVENT(output);
    }
}
