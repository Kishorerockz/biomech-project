// Web Bluetooth (WebBLE) Hardware Connector Interface for ESP32/Arduino IMU sensors

export interface BLEDeviceStatus {
  connected: boolean;
  deviceName?: string;
  batteryLevel?: number;
  error?: string;
}

export class BluetoothHardwareManager {
  private device: any = null;
  private gattServer: any = null;
  private characteristic: any = null;

  public async requestBLEDevice(
    onDataReceived: (accelG: number) => void,
    onStatusChange: (status: BLEDeviceStatus) => void
  ): Promise<boolean> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      onStatusChange({
        connected: false,
        error: 'Web Bluetooth API is not supported in this browser. Running in simulated hardware mode.',
      });
      return false;
    }

    try {
      onStatusChange({ connected: false, deviceName: 'Scanning...' });

      // Search for Nordic UART / Custom BLE IMU Service
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
          '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / Custom Serial
        ],
      });

      this.device = device;
      device.addEventListener('gattserverdisconnected', () => {
        onStatusChange({ connected: false, error: 'Hardware node disconnected.' });
      });

      const server = await device.gatt.connect();
      this.gattServer = server;

      onStatusChange({
        connected: true,
        deviceName: device.name || 'ESP32-IMU Node',
      });

      return true;
    } catch (err: any) {
      console.warn('Bluetooth pairing cancelled or failed:', err);
      onStatusChange({
        connected: false,
        error: err.message || 'Bluetooth connection cancelled.',
      });
      return false;
    }
  }

  public disconnect() {
    if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
    this.device = null;
    this.gattServer = null;
  }
}

export const bleHardware = new BluetoothHardwareManager();
