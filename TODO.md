# 🌺 Hibiscus TODO

## Splash Screen Animation

### Objective

Add a minimal, theme-aware startup animation featuring a blooming hibiscus flower that plays for ~1-2 seconds before revealing the main application UI.

---

### Requirements

* Fullscreen splash overlay on app launch
* Centered hibiscus SVG animation
* Animation duration: ~1–2 seconds
* Smooth fade-out transition into main UI
* Must NOT block app initialization (UI loads underneath)
* Must integrate with existing theme variables:

  * `--bg-primary`
  * `--accent-primary`
  * `--text-primary`

---

### Implementation Tasks

#### 1. Splash State (App-level)

* Add `showSplash` state in main App component
* Auto-hide after animation duration (~1500ms)

#### 2. SplashScreen Component

* Create `src/components/SplashScreen/SplashScreen.tsx`
* Render:

  * fullscreen container
  * centered SVG hibiscus

#### 3. SVG Animation

* Use inline SVG (no external dependencies)
* Animate:

  * petal scale (0.2 → 1)
  * opacity (0 → 1)
  * slight rotation for organic feel
* Stagger petal animations (small delays)

#### 4. Styling

* Fullscreen overlay:

  * `position: fixed`
  * `inset: 0`
  * `z-index: high`
* Background: `var(--bg-primary)`
* Ensure animation respects theme colors

#### 5. Exit Transition

* Fade out splash smoothly (200–400ms)
* Optional slight scale-down on exit

---

### Optional Enhancements

* Skip splash after first launch (localStorage flag)
* Sync splash dismissal with app readiness instead of fixed timer
* Add subtle glow or pulse effect
* Replace SVG with Lottie animation (future upgrade)

---

### Constraints

* No additional libraries required (CSS + SVG only)
* No multithreading / workers needed
* Must not impact app performance or load time
* Keep implementation minimal and maintainable

---

### Acceptance Criteria

* Splash appears instantly on launch
* Animation plays smoothly without lag
* Transition to app feels seamless
* No flicker or layout shift
* Works with both light/dark themes

---

### Status

* [ ] Not started
