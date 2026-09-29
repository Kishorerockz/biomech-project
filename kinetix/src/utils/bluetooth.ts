// Universal Bluetooth Hardware Manager (Supports both Native Android via Capacitor BLE and Web Bluetooth)
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

export interface BLEDeviceStatus {
  connected: boolean;
  deviceName?: string;
  batteryLevel?: number;
  error?: string;
}

const NORDIC_UART_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export interface RawTelemetrySample {
  x: number;
  y: number;
  z: number;
  gx?: number;
  gy?: number;
  gz?: number;
  t?: number;
  r?: number;
  bat?: number;
}

export class BluetoothHardwareManager {
  private connectedDeviceId: string | null = null;
  // Web BLE fallback references
  private webDevice: any = null;
  private webGattServer: any = null;
  private webRxChar: any = null;

  public async requestBLEDevice(
    onDataReceived: (rawData: RawTelemetrySample) => void,
    onStatusChange: (status: BLEDeviceStatus) => void
  ): Promise<boolean> {
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      return this.connectNativeBLE(onDataReceived, onStatusChange);
    } else {
      return this.connectWebBLE(onDataReceived, onStatusChange);
    }
  }

  private autoReconnectTimer: any = null;
  private isExplicitDisconnect: boolean = false;
  private cachedOnDataReceived: ((rawData: RawTelemetrySample) => void) | null = null;
  private cachedOnStatusChange: ((status: BLEDeviceStatus) => void) | null = null;

  // 1. Native Android BLE Connection (Inside Mobile APK)
  private async connectNativeBLE(
    onDataReceived: (rawData: RawTelemetrySample) => void,
    onStatusChange: (status: BLEDeviceStatus) => void
  ): Promise<boolean> {
    this.isExplicitDisconnect = false;
    this.cachedOnDataReceived = onDataReceived;
    this.cachedOnStatusChange = onStatusChange;
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }

    try {
      onStatusChange({ connected: false, deviceName: 'Initializing Bluetooth...' });
      await BleClient.initialize();

      const enabled = await BleClient.isEnabled();
      if (!enabled) {
        try {
          await BleClient.requestEnable();
        } catch {
          // ignore if user denies or platform doesn't support requestEnable
        }
      }

      onStatusChange({ connected: false, deviceName: 'Scanning for Kinetix-ESP32...' });

      // Request device — opens native Android Bluetooth pairing dialog
      let device: any;
      try {
        device = await BleClient.requestDevice({
          namePrefix: 'Kinetix',
          optionalServices: [NORDIC_UART_SERVICE, '0000180f-0000-1000-8000-00805f9b34fb'],
        });
      } catch (prefixErr) {
        device = await BleClient.requestDevice({
          services: [NORDIC_UART_SERVICE],
          optionalServices: ['0000180f-0000-1000-8000-00805f9b34fb'],
        });
      }

      this.connectedDeviceId = device.deviceId;
      return await this.establishNativeBLEStream(device.deviceId, device.name, onDataReceived, onStatusChange);
    } catch (err: any) {
      console.warn('Native BLE connection failed:', err);
      onStatusChange({
        connected: false,
        error: err.message || 'Bluetooth connection failed or cancelled.',
      });
      return false;
    }
  }

  // Establish connection and set up auto-reconnect handler
  private async establishNativeBLEStream(
    deviceId: string,
    deviceName: string | undefined,
    onDataReceived: (rawData: RawTelemetrySample) => void,
    onStatusChange: (status: BLEDeviceStatus) => void
  ): Promise<boolean> {
    try {
      onStatusChange({ connected: false, deviceName: `Connecting to ${deviceName || 'Kinetix-ESP32'}...` });

      await BleClient.connect(deviceId, () => {
        onStatusChange({ connected: false, error: 'Wearable BLE disconnected. Auto-reconnecting...' });
        // Trigger auto-reconnect if not explicitly disconnected by user
        if (!this.isExplicitDisconnect && this.connectedDeviceId) {
          this.scheduleAutoReconnect();
        }
      });

      // Start receiving real-time 100Hz MPU-6050 notifications (Binary or JSON)
      const decoder = new TextDecoder('utf-8');
      await BleClient.startNotifications(
        deviceId,
        NORDIC_UART_SERVICE,
        NORDIC_UART_TX,
        (value: DataView) => {
          try {
            // Check for 19-byte binary telemetry packet (header = 0xAA)
            if (value.byteLength === 19 && value.getUint8(0) === 0xAA) {
              const ax = value.getInt16(1, true);
              const ay = value.getInt16(3, true);
              const az = value.getInt16(5, true);
              const gx = value.getInt16(7, true);
              const gy = value.getInt16(9, true);
              const gz = value.getInt16(11, true);
              const t  = value.getUint32(13, true);
              const r  = value.getUint8(17);

              onDataReceived({ x: ax, y: ay, z: az, gx, gy, gz, t, r });
              return;
            }

            // Fallback: UTF-8 JSON parsing
            const str = decoder.decode(value);
            const parsed = JSON.parse(str);
            if (parsed && typeof parsed.x === 'number') {
              onDataReceived(parsed);
            }
          } catch {
            // Drop partial packet without crashing
          }
        }
      );

      onStatusChange({
        connected: true,
        deviceName: deviceName || 'Kinetix-ESP32 (Direct BLE)',
      });

      return true;
    } catch (err: any) {
      console.warn('establishNativeBLEStream failed:', err);
      if (!this.isExplicitDisconnect && this.connectedDeviceId) {
        this.scheduleAutoReconnect();
      }
      return false;
    }
  }

  private scheduleAutoReconnect() {
    if (this.autoReconnectTimer) clearTimeout(this.autoReconnectTimer);
    this.autoReconnectTimer = setTimeout(async () => {
      if (this.isExplicitDisconnect || !this.connectedDeviceId) return;
      if (this.cachedOnStatusChange) {
        this.cachedOnStatusChange({ connected: false, deviceName: 'Reconnecting to Kinetix-ESP32...' });
      }
      try {
        if (this.cachedOnDataReceived && this.cachedOnStatusChange) {
          await this.establishNativeBLEStream(
            this.connectedDeviceId,
            'Kinetix-ESP32',
            this.cachedOnDataReceived,
            this.cachedOnStatusChange
          );
        }
      } catch {
        this.scheduleAutoReconnect();
      }
    }, 2500);
  }

  // 2. Web Bluetooth Fallback (For Chrome on Desktop / Laptop)
  private async connectWebBLE(
    onDataReceived: (rawData: RawTelemetrySample) => void,
    onStatusChange: (status: BLEDeviceStatus) => void
  ): Promise<boolean> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      onStatusChange({
        connected: false,
        error: 'Web Bluetooth API is not supported in this browser.',
      });
      return false;
    }

    try {
      onStatusChange({ connected: false, deviceName: 'Scanning for Kinetix-ESP32...' });

      let device: any;
      try {
        device = await (navigator as any).bluetooth.requestDevice({
          filters: [
            { namePrefix: 'Kinetix' },
            { services: [NORDIC_UART_SERVICE] },
          ],
          optionalServices: [
            NORDIC_UART_SERVICE,
            '0000180f-0000-1000-8000-00805f9b34fb',
            '0000ffe0-0000-1000-8000-00805f9b34fb',
          ],
        });
      } catch (filterErr: any) {
        // Fallback to accepting all devices if filter matching encounters platform restrictions
        device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            NORDIC_UART_SERVICE,
            '0000180f-0000-1000-8000-00805f9b34fb',
            '0000ffe0-0000-1000-8000-00805f9b34fb',
          ],
        });
      }

      this.webDevice = device;
      device.addEventListener('gattserverdisconnected', () => {
        onStatusChange({ connected: false, error: 'Wearable BLE disconnected.' });
      });

      const server = await device.gatt.connect();
      this.webGattServer = server;

      let service: any;
      try {
        service = await server.getPrimaryService(NORDIC_UART_SERVICE);
      } catch {
        const services = await server.getPrimaryServices();
        service = services[0];
      }

      if (!service) throw new Error('BLE IMU service not found.');

      let txChar: any;
      try {
        txChar = await service.getCharacteristic(NORDIC_UART_TX);
      } catch {
        const chars = await service.getCharacteristics();
        txChar = chars.find((c: any) => c.properties.notify) || chars[0];
      }

      if (!txChar) throw new Error('BLE Notify characteristic not found.');

      await txChar.startNotifications();

      // Discover RX characteristic for write commands (e.g. tare)
      try {
        this.webRxChar = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
      } catch (_) {
        this.webRxChar = null;
      }

      const decoder = new TextDecoder('utf-8');
      txChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const value: DataView = event.target.value;
        try {
          if (value.byteLength === 19 && value.getUint8(0) === 0xAA) {
            const ax = value.getInt16(1, true);
            const ay = value.getInt16(3, true);
            const az = value.getInt16(5, true);
            const gx = value.getInt16(7, true);
            const gy = value.getInt16(9, true);
            const gz = value.getInt16(11, true);
            const t  = value.getUint32(13, true);
            const r  = value.getUint8(17);

            onDataReceived({ x: ax, y: ay, z: az, gx, gy, gz, t, r });
            return;
          }

          const decodedStr = decoder.decode(value);
          const parsed = JSON.parse(decodedStr);
          if (parsed && typeof parsed.x === 'number') {
            onDataReceived(parsed);
          }
        } catch {
          // Ignore drop
        }
      });

      onStatusChange({
        connected: true,
        deviceName: device.name || 'Kinetix-ESP32 (BLE)',
      });

      return true;
    } catch (err: any) {
      console.warn('Web Bluetooth error:', err);
      onStatusChange({
        connected: false,
        error: err.message || 'Bluetooth connection cancelled.',
      });
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    this.isExplicitDisconnect = true;
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }

    if (this.connectedDeviceId) {
      try {
        await BleClient.disconnect(this.connectedDeviceId);
      } catch {
        // ignore
      }
      this.connectedDeviceId = null;
    }

    if (this.webGattServer && this.webGattServer.connected) {
      this.webGattServer.disconnect();
    }
    this.webDevice = null;
    this.webGattServer = null;
    this.webRxChar = null;
  }

  /**
   * Send text command to ESP32 (e.g. "tare" or "calibrate")
   */
  public async sendCommand(cmd: string): Promise<boolean> {
    const isNative = Capacitor.isNativePlatform();
    const encoder = new TextEncoder();
    const data = encoder.encode(cmd);

    if (isNative && this.connectedDeviceId) {
      try {
        await BleClient.write(
          this.connectedDeviceId,
          NORDIC_UART_SERVICE,
          '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
          new DataView(data.buffer)
        );
        return true;
      } catch (err) {
        console.warn('Native BLE write failed:', err);
        return false;
      }
    } else if (this.webRxChar) {
      try {
        await this.webRxChar.writeValue(data);
        return true;
      } catch (err) {
        console.warn('Web BLE write failed:', err);
        return false;
      }
    }
    return false;
  }
}

export const bleHardware = new BluetoothHardwareManager();
