import { cameraIntakeAPI } from '../services/api';

// Fallbacks for the camera-intake option lists — used until the config
// fetch resolves, or if it fails. The live lists come from Admin Settings →
// Camera Intake (camera_intake_config singleton); backend keeps the same
// defaults in app/models/camera_intake.py, so an unconfigured install
// behaves identically on both sides.
export const CAMERA_INTAKE_DEFAULTS = {
  included_options: [
    'Power Cord', 'Controller', 'Patch Cable', 'Battery', 'Battery Charger',
    'SD Card', 'USB Drive', 'Carrying Case', 'Skids / Guides', 'Manual',
  ],
  condition_options: [
    'Powers On', 'No Power', 'Image OK', 'Image Cloudy', 'No Image',
    'Bump Test OK', 'Bump Test Fails',
    'LEDs OK', 'LEDs Dim / Dead', 'Sonde Transmits', 'Sonde Dead',
    'Odometer Works', 'Odometer Faulty',
  ],
  final_checklist: [
    'Image Clear',
    'Bump Test Passed',
    'LEDs Working',
    'Sonde Verified',
    'Odometer Verified',
    'Rod Spools Freely',
    'Termination Secure',
    'Accessories Packed',
  ],
};

// One fetch per page load, shared by every ToolForm instance and the WO
// dialog's QC chips. Cleared after a settings save so the tracker picks up
// edits without a reload.
let cached = null;

export function getCameraIntakeConfig() {
  if (!cached) {
    cached = cameraIntakeAPI.get()
      .then((data) => ({
        included_options: Array.isArray(data?.included_options) ? data.included_options : CAMERA_INTAKE_DEFAULTS.included_options,
        condition_options: Array.isArray(data?.condition_options) ? data.condition_options : CAMERA_INTAKE_DEFAULTS.condition_options,
        final_checklist: Array.isArray(data?.final_checklist) ? data.final_checklist : CAMERA_INTAKE_DEFAULTS.final_checklist,
      }))
      .catch(() => {
        cached = null; // let a later mount retry instead of pinning the fallback
        return CAMERA_INTAKE_DEFAULTS;
      });
  }
  return cached;
}

export function clearCameraIntakeConfigCache() {
  cached = null;
}
