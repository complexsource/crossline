// Raw mouse input is optional. Permission and browser rate-limit denials are
// not evidence that raw input is unsupported: retrying those immediately just
// consumes another request and can prolong the browser's restriction.
export async function requestMouseCapture(canvas) {
  try {
    await canvas.requestPointerLock({ unadjustedMovement: true });
  } catch (error) {
    if (error?.name !== "NotSupportedError") throw error;
    await canvas.requestPointerLock();
  }
}
