/**
 * Web surface for the WakaTime integration: hosts the browser bundle served to
 * the DSH web GUI and mounts the tracker exactly once even when both variants
 * are installed (the shared activation claim lives in the core module this
 * file re-exports).
 *
 * The host-side behavior comes entirely from `@27aaron/dsh-wakatime`, resolved
 * at runtime from the profile's transitive dependency, not bundled here.
 *
 * @module @27aaron/dsh-wakatime-ui
 */

export * from '@27aaron/dsh-wakatime'
