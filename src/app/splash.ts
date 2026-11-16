/**
 * iOS launch screens (`apple-touch-startup-image`).
 *
 * iOS ignores the manifest's background colour: an installed web app shows a
 * blank white screen until the page has painted, unless a startup image matches
 * the device exactly (CSS size, pixel ratio, orientation). We ship one per screen
 * size and colour scheme. The images are renders of the HTML boot splash in
 * src/app/boot-splash.ts, so launch image → boot splash → app reads as one continuous screen.
 *
 * Shared by the root route (its head links them) and scripts/generate-splash.ts
 * (renders the PNGs into public/splash/).
 */

/** Screen size in portrait CSS pixels. */
export interface SplashScreen {
  width: number
  height: number
  ratio: number
  devices: string
}

export const SPLASH_SCREENS: readonly SplashScreen[] = [
  {width: 375, height: 667, ratio: 2, devices: 'iPhone 8, SE (2nd/3rd gen)'},
  {width: 414, height: 736, ratio: 3, devices: 'iPhone 8 Plus'},
  {width: 375, height: 812, ratio: 3, devices: 'iPhone X, XS, 11 Pro, 12 mini, 13 mini'},
  {width: 414, height: 896, ratio: 2, devices: 'iPhone XR, 11'},
  {width: 414, height: 896, ratio: 3, devices: 'iPhone XS Max, 11 Pro Max'},
  {width: 390, height: 844, ratio: 3, devices: 'iPhone 12, 13, 14, 16e'},
  {width: 428, height: 926, ratio: 3, devices: 'iPhone 12/13 Pro Max, 14 Plus'},
  {width: 393, height: 852, ratio: 3, devices: 'iPhone 14 Pro, 15, 15 Pro, 16'},
  {width: 430, height: 932, ratio: 3, devices: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus'},
  {width: 402, height: 874, ratio: 3, devices: 'iPhone 16 Pro, 17, 17 Pro'},
  {width: 420, height: 912, ratio: 3, devices: 'iPhone Air'},
  {width: 440, height: 956, ratio: 3, devices: 'iPhone 16 Pro Max, 17 Pro Max'},
  {width: 744, height: 1133, ratio: 2, devices: 'iPad mini (6th/7th gen)'},
  {width: 768, height: 1024, ratio: 2, devices: 'iPad mini 5, iPad 9.7"'},
  {width: 810, height: 1080, ratio: 2, devices: 'iPad 10.2"'},
  {width: 820, height: 1180, ratio: 2, devices: 'iPad 10th/11th gen, iPad Air 10.9"'},
  {width: 834, height: 1112, ratio: 2, devices: 'iPad Air 10.5", iPad Pro 10.5"'},
  {width: 834, height: 1194, ratio: 2, devices: 'iPad Pro 11", iPad Air 11"'},
  {width: 834, height: 1210, ratio: 2, devices: 'iPad Pro 11" (M4)'},
  {width: 1024, height: 1366, ratio: 2, devices: 'iPad Pro 12.9", iPad Air 13"'},
  {width: 1032, height: 1376, ratio: 2, devices: 'iPad Pro 13" (M4)'},
]

export const SPLASH_DIR = 'splash'

export type SplashScheme = 'light' | 'dark'
export type SplashOrientation = 'portrait' | 'landscape'

export interface SplashVariant {
  screen: SplashScreen
  orientation: SplashOrientation
  scheme: SplashScheme
  /** Viewport in CSS pixels for this orientation. */
  cssWidth: number
  cssHeight: number
  /** Path relative to the public dir / deploy base. */
  file: string
  media: string
}

/** iPhones launch web apps in portrait; iPads get both orientations. */
export function splashVariants(): SplashVariant[] {
  const out: SplashVariant[] = []
  for (const screen of SPLASH_SCREENS) {
    const orientations: SplashOrientation[] =
      screen.width >= 700 ? ['portrait', 'landscape'] : ['portrait']
    for (const orientation of orientations) {
      for (const scheme of ['light', 'dark'] as const) {
        const [cssWidth, cssHeight] =
          orientation === 'portrait' ? [screen.width, screen.height] : [screen.height, screen.width]
        out.push({
          screen,
          orientation,
          scheme,
          cssWidth,
          cssHeight,
          file: `${SPLASH_DIR}/apple-splash-${cssWidth * screen.ratio}x${cssHeight * screen.ratio}-${scheme}.png`,
          // device-width/height are always the portrait values, whatever the orientation.
          media:
            `(device-width: ${screen.width}px) and (device-height: ${screen.height}px) and (-webkit-device-pixel-ratio: ${screen.ratio}) ` +
            `and (orientation: ${orientation}) and (prefers-color-scheme: ${scheme})`,
        })
      }
    }
  }
  return out
}
