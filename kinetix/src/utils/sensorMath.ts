/**
 * MPU-6050 Math and Sensor Calibration Utilities
 * Sensitivity Scale Factors:
 * +/- 2g range: 16384.0 LSB/g
 * +/- 8g range:  4096.0 LSB/g (Athletic / Dynamic Jump Range)
 * +/-16g range:  2048.0 LSB/g
 */

export const MPU6050_SENSITIVITY_2G = 16384.0;
export const MPU6050_SENSITIVITY_8G = 4096.0;
export const MPU6050_SENSITIVITY_16G = 2048.0;

// Default to 8g for athletic jump capture without clipping
export const MPU6050_SENSITIVITY_LSB_PER_G = MPU6050_SENSITIVITY_8G;

/**
 * Converts incoming raw 16-bit integer to G-force acceleration.
 * Automatically adapts scale factor if telemetry specifies range ('r': 2, 8, 16)
 * @param rawValue Incoming 16-bit signed integer (-32768 to 32767)
 * @param range Optional dynamic range in G (defaults to 8g)
 * @returns Acceleration in Gs (1.0g = 1g earth gravity)
 */
export function convertToGForce(rawValue: number, range: number = 8): number {
  if (typeof rawValue !== 'number' || isNaN(rawValue)) return 0;
  const lsbPerG = range === 2 ? MPU6050_SENSITIVITY_2G : range === 16 ? MPU6050_SENSITIVITY_16G : MPU6050_SENSITIVITY_8G;
  return rawValue / lsbPerG;
}

/**
 * Converts G-force value back to 16-bit raw integer equivalent.
 * @param gForce Acceleration in Gs
 * @param range Dynamic range (defaults to 8g)
 * @returns 16-bit integer approximation
 */
export function convertGForceToRaw(gForce: number, range: number = 8): number {
  if (typeof gForce !== 'number' || isNaN(gForce)) return 0;
  const lsbPerG = range === 2 ? MPU6050_SENSITIVITY_2G : range === 16 ? MPU6050_SENSITIVITY_16G : MPU6050_SENSITIVITY_8G;
  return Math.round(gForce * lsbPerG);
}
