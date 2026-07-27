/**
 * Returns true when this process did not obtain the single-instance lock
 * and should exit immediately.
 *
 * @param gotLock - Result of `app.requestSingleInstanceLock()`
 */
export const shouldQuitForMissingInstanceLock = (gotLock: boolean): boolean => !gotLock
