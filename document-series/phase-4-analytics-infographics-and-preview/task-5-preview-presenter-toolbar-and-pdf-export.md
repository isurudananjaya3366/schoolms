# Task 4.5 — Preview Mode Presenter Toolbar and PDF Export

**Phase:** 4 — Analytics, Infographics and Preview Mode
**Task Number:** 4.5 of 5
**Complexity:** High
**Depends On:** Task 4.4 complete (SlideRenderer and all 8 slides implemented)

---

## Objective

This task builds the interactive presenter layer that sits on top of the Preview Mode slide canvas. It introduces the PresenterToolbar floating control strip, the SlideThumbnailStrip navigation panel, a print stylesheet for one-click browser printing, and the full client-side multi-page PDF export flow using react-pdf/renderer combined with html2canvas for the chart slide.

---

## Deliverables

- `components/preview/PresenterToolbar.tsx` — the floating control strip rendered inside SlideRenderer, receiving slide state and control callbacks as props
- `components/preview/SlideThumbnailStrip.tsx` — the animated thumbnail panel that slides up from the bottom of the screen when the slide counter is clicked
- A print-specific stylesheet linked in the preview page head with `media="print"`, covering toolbar suppression and paginated slide layout
- PDF export logic wired to the Download PDF button, using react-pdf/renderer for text-based slides and html2canvas for the chart slide, producing a single multi-page PDF file

---

## Context and Background

The PresenterToolbar is a fixed, floating strip anchored to the bottom of the PreviewMode page. It is a client component rendered as a child inside SlideRenderer, positioned with absolute or fixed CSS so it overlays the slide canvas regardless of slide content. SlideRenderer owns all slide-level state — current slide index, font size multiplier, theme, and aspect ratio — and passes the relevant values down to PresenterToolbar as props, along with setter callbacks. This keeps SlideRenderer as the single source of truth for the slide session state while PresenterToolbar handles only UI interaction.

PresenterToolbar groups all presenter controls into one cohesive interface: left and right navigation, a slide counter that doubles as a thumbnail strip trigger, font size tuning, theme switching, aspect ratio toggling, print, PDF export, fullscreen toggle, and a close button. Because these controls cover very different concerns, each one is described in its own specification section below. The toolbar should remain visually unobtrusive — semi-transparent background, compact height — so it does not distract from slide content.

The SlideThumbnailStrip is a companion component that opens above the toolbar when the slide counter is tapped. It gives the presenter a bird's-eye view of the full deck and allows direct jump navigation. It is implemented as a separate component with its own Framer Motion animation rather than inline markup in PresenterToolbar, because its complexity and independent open/close state warrant its own file.

PDF export is the most technically involved part of this task. Because the slide content is a mix of structured React component trees and an SVG-based chart, two different capture strategies are needed. Text-based slides are expressed directly using react-pdf/renderer's primitive layout system. The performance chart slide requires an html2canvas capture step to produce a raster image that react-pdf can embed. Both strategies must complete before the PDF Document is assembled and downloaded.

---

## Toolbar Control Specifications

### Navigation Controls

The toolbar has a left arrow button and a right arrow button. The left arrow is disabled and visually muted when the current slide index is zero. The right arrow is disabled and visually muted when the current slide index equals the total slide count minus one. Both buttons call the `setSlide` callback: the left button passes the current index minus one, the right button passes the current index plus one.

Keyboard navigation mirrors the button behaviour. A `useEffect` inside PresenterToolbar — or optionally in SlideRenderer — attaches a `keydown` event listener to the `window` object on component mount. The listener responds to `ArrowLeft` and `ArrowRight` keys using the same `setSlide` logic as the buttons, including the boundary checks. The `useEffect` return function removes the listener to prevent the handler from persisting outside the preview session and interfering with other parts of the application.

### Slide Counter

The slide counter is a clickable text element displayed in the horizontal centre of the toolbar. It shows the current position in the format `currentSlide / totalSlides` using human-readable one-based indexing, so the first slide reads `1 / 8`. Clicking the counter toggles the SlideThumbnailStrip open or closed. The counter should be styled to visually signal its interactivity — an underline, a hover colour shift, or a pointer cursor are all acceptable approaches.

### Font Size Controls

Two buttons — a small "A" for decrease and a large "A" for increase — adjust a font size multiplier that scales slide text content. The multiplier state lives in SlideRenderer and is passed to PresenterToolbar as a prop alongside a setter callback. Each click on decrease reduces the multiplier by 0.1; each click on increase raises it by 0.1. The minimum allowed value is 0.7 and the maximum is 1.5. The decrease button is disabled at 0.7 and the increase button is disabled at 1.5. SlideRenderer applies the multiplier as an inline CSS `fontSize` or `transform: scale` property on the slide canvas container element, so all text rendered by any slide child component scales consistently without requiring per-slide changes.

### Theme Toggle

A sun or moon icon button switches the theme between `"light"` and `"dark"` modes. The default theme is dark because the preview is primarily a presentation surface. Theme state is stored in SlideRenderer and passed to PresenterToolbar as a prop. The toggle fires a `setTheme` callback that flips the current value. SlideRenderer applies the theme as a `data-theme` attribute or a class on the slide canvas container, which slide child components reference for their colour tokens. The toolbar button icon should reflect the active theme — show the sun icon when the theme is dark (clicking will switch to light), and the moon icon when the theme is light (clicking will switch to dark).

### Aspect Ratio Toggle

A button cycles between two aspect ratio modes: `"16:9"` and `"A4"`. In 16:9 mode, the slide canvas is sized to a widescreen landscape proportion. In A4 mode, the canvas is sized to approximate an A4 portrait paper ratio. The current aspect ratio state lives in SlideRenderer and is provided to PresenterToolbar as a prop with a setter callback. The button label updates to display the current mode so the presenter knows which mode is active before toggling. SlideRenderer uses the aspect ratio value to set the slide container's width and height or padding-bottom ratio.

### Print Button

The print button calls `window.print()` directly with no preparation needed in JavaScript. All print formatting is handled by a dedicated stylesheet linked in the preview page `<head>` with a `media="print"` attribute so it applies only during printing and has no effect on the interactive view. The stylesheet targets the toolbar element and hides it entirely during print, ensuring it does not appear on printed pages. It also transforms the slide deck container into a paginated layout by applying `page-break-after: always` to each individual slide wrapper so each slide prints on its own page. The stylesheet is a static file served from the public directory or imported as a global CSS file scoped to the preview route — the key requirement is that it activates automatically when `window.print()` triggers the browser print dialog, with no additional JavaScript coordination required.

### Download PDF Button

Clicking this button triggers the full client-side PDF export pipeline described in its own section below. While export is in progress, the button is replaced with a loading spinner. On successful completion the spinner clears and the browser initiates a file download. On failure an inline error message is shown near the button position.

### Fullscreen Button

The fullscreen button calls `document.documentElement.requestFullscreen()` to enter full-browser fullscreen mode. Once fullscreen is active, clicking the button again calls `document.exitFullscreen()` to exit. The Escape key also exits fullscreen as native browser behaviour. PresenterToolbar listens to the `document.fullscreenchange` event to detect when fullscreen is entered or exited by any means, and updates the button icon accordingly — an expand icon when not fullscreen, a compress icon when fullscreen.

In fullscreen mode, an auto-hide behaviour reduces visual clutter. When the user's pointer has not moved for two seconds and is not near the bottom edge of the screen, the toolbar transitions to fully transparent using a CSS opacity transition. Any pointer movement anywhere on the screen — or movement specifically near the bottom edge — restores the toolbar to full opacity. This is implemented by tracking mouse idle state in a ref or piece of component state, using a `setTimeout` that starts a timer on `mousemove` and resets whenever new movement is detected. The opacity value is driven by a class or inline style on the toolbar container.

### Close Button

The close button calls `window.close()`. Because the preview tab is intended to be opened using `window.open()` from the dashboard, the browser permits `window.close()` in that context. If the tab was navigated to directly — for example, the user bookmarked the URL and loaded it fresh — `window.close()` will be silently blocked by the browser. In that case, PresenterToolbar should catch the failure by checking whether `window.closed` is still false immediately after the call and, if so, display an inline tooltip or small banner message advising the user to close the tab manually using their browser controls.

---

## SlideThumbnailStrip Component

### Behaviour

SlideThumbnailStrip opens when the presenter clicks the slide counter in the toolbar. It animates in as a panel rising from just above the toolbar level, implemented using Framer Motion's `AnimatePresence` wrapper and a `motion.div` with vertical slide-in and slide-out transitions. The component receives an `isOpen` boolean prop and toggles visibility through `AnimatePresence` so the exit animation plays before the component unmounts. It also receives the current slide index, the total slide count, and a `setSlide` callback. When a thumbnail is clicked, the component calls `setSlide` with the index of the chosen thumbnail and signals its parent (PresenterToolbar) to close the strip, which can be done via a `onClose` callback prop.

### Thumbnail Design

Each thumbnail is a compact card. It displays the slide number, the slide's human-readable title — for example "Cover", "Student Info", "Term I Marks", "Term II Marks", "Performance Chart", "Subject Averages", "Attendance", "Final Summary" — and a small icon representing the content category of that slide, such as a chart icon for slide five or a table icon for mark entry slides. The thumbnail does not attempt to live-render any slide content. Rendering actual React slide components at thumbnail scale would risk triggering unexpected Recharts or D3 rendering outside the main slide canvas context and would be visually unreadable at the small size anyway. Static text and icons are sufficient.

The active slide thumbnail has a coloured border or background highlight to clearly indicate the current position. The strip is a horizontally scrollable flex row so all eight thumbnails are reachable at narrow viewport widths without wrapping or overflow clipping. Scroll behaviour should be smooth and the active thumbnail should be scrolled into view automatically when the strip opens.

---

## Preview Mode PDF Export

### Overview

When the Download PDF button is clicked, all PDF generation happens entirely in the browser — no server request is made. The output is a multi-page PDF where each of the eight preview slides occupies one page. The PDF is assembled using react-pdf/renderer, which accepts a `Document` containing multiple `Page` components and produces a downloadable blob. Because the slides are a mix of structured data layouts and one SVG chart, two different rendering strategies are used depending on the slide type.

### Slide Mapping to PDF

Slides 1, 2, 3, 4, 6, 7, and 8 contain structured content — student identity information, tabular marks data, attendance records, and summary text. All of this content is available as plain JavaScript data already loaded into the Preview Mode page from the student report API. These slides are expressed directly using react-pdf/renderer's primitive components such as `Document`, `Page`, `View`, and `Text`, styled with react-pdf style objects that mirror the visual layout of the screen slides. This approach produces clean, vector-based PDF pages with selectable text, small file sizes, and no dependency on DOM capture for text-heavy slides.

Slide 5, the performance bar chart, is the exception. The `StudentPerformanceBar` component renders using Recharts and produces an SVG element in the DOM. react-pdf/renderer has no built-in SVG rendering capability for complex charts. Slide 5's PDF page must be created using an image capture instead.

### Slide 5 Chart Capture

Before PDF assembly begins, the chart slide's wrapper div is captured using html2canvas. The capture is triggered by temporarily ensuring the chart slide is rendered and visible in the DOM — if SlideRenderer uses lazy or conditional rendering, the chart must be forced into the DOM before capture. The html2canvas call uses a scale factor of two to produce a high-resolution raster at double the display pixel density, resulting in a sharp image at standard print resolutions. The capture returns a base64-encoded PNG data URL, which is then passed to a react-pdf `Image` component placed on the fifth PDF page. The entire capture must resolve as a Promise before the PDF Document is constructed, so the export function should use an async pattern that awaits the capture result.

### PDF Page Size and Orientation

The aspect ratio setting active in PresenterToolbar at the moment the user clicks Download PDF determines the page dimensions of the exported file. If the toolbar is in `"16:9"` mode, all PDF pages are generated with A4 landscape dimensions. If the toolbar is in `"A4"` mode, all pages use A4 portrait dimensions. This means the PDF reflects the view the presenter was using, which is the natural expectation. The aspect ratio prop or value must be accessible in the export function's scope, either passed as a parameter or read from shared state.

### Header Per Page

Every PDF page includes a small header section at the top of the page containing two pieces of information: the school name retrieved from the SystemConfig record and the full name of the student whose report is being previewed. The school name and student name are already available in the Preview Mode page's loaded data. This header provides context when individual pages are printed separately or attached to communications — a page detached from the PDF should still be identifiable by school and student.

### Loading State

The moment the Download PDF button is clicked, the export process begins asynchronously. The button is immediately replaced with a loading spinner or progress indicator to prevent double-clicks and to communicate that work is in progress. The html2canvas capture and the react-pdf Document rendering both take non-trivial time on slower devices. Once the PDF blob is fully generated, the browser download is triggered programmatically using a temporary anchor element with a `download` attribute containing a filename derived from the student's name and the current date. If any step in the export pipeline throws an error — canvas capture failure, missing data, react-pdf build error — the spinner is removed, the Download PDF button is restored, and a short error message is displayed inline near the button.

---

## Acceptance Criteria

1. Left and right navigation buttons correctly update the slide index, respecting minimum and maximum boundaries.
2. Arrow key keyboard navigation mirrors button navigation exactly, including boundary enforcement, and the keydown listener is removed when the component unmounts.
3. The slide counter displays current position in one-based `x / 8` format and is correctly updated on every navigation action.
4. Clicking the slide counter opens the SlideThumbnailStrip; clicking a thumbnail navigates to that slide and closes the strip.
5. The SlideThumbnailStrip animates in and out using Framer Motion and the active thumbnail is visually highlighted.
6. Font size decrease and increase buttons adjust the multiplier within the 0.7–1.5 range and the multiplier visibly affects text size across all slides.
7. Theme toggle switches between dark and light appearances and the toolbar icon reflects the currently active theme correctly.
8. Aspect ratio toggle switches the slide canvas between 16:9 and A4 proportions, with the button label updated to show the active mode.
9. The print button triggers the browser print dialog, the toolbar is hidden in the printed output, and each slide begins on a new page.
10. Fullscreen enter and exit work correctly via button click and Escape key; the toolbar auto-hides after two seconds of pointer inactivity and reappears on movement.
11. The close button closes the tab when permitted; if blocked, an advisory message is shown in place of a silent failure.
12. The Download PDF button produces a multi-page PDF with the correct page orientation, per-page headers, accurate text-based slide content, and a sharp captured image for the chart slide; a loading spinner is shown during generation and an error message appears if generation fails.

---

## Notes and Pitfalls

- Keyboard event listeners attached to `window` in a `useEffect` must always be removed in the `useEffect` cleanup return. If cleanup is omitted, the ArrowLeft and ArrowRight handlers persist globally after the user navigates away from the preview tab, and they may silently interfere with other pages or components that also listen to keyboard events.
- `document.documentElement.requestFullscreen()` will be rejected by the browser if it is not invoked as a direct result of a user gesture. Do not call it inside a `setTimeout`, a `useEffect` on mount, or any other deferred context — it must be called synchronously within a click handler or the browser will throw a `NotAllowedError` that surfaces as a silent failure.
- react-pdf/renderer processes the document layout in a background thread in some environments. Because of this, the html2canvas capture of the chart slide must be fully completed and the base64 image string must be available before the react-pdf `Document` component tree is constructed. Passing a pending Promise or an undefined image reference to the react-pdf `Image` component will produce a broken page without an obvious error.
- The SlideThumbnailStrip must use only static content — slide numbers, title strings, and category icons. It must not attempt to render the actual slide components inside thumbnail-sized containers. Recharts, D3, and any other visualisation library used in the slide components may produce unexpected DOM effects, register resize observers, or throw errors when rendered at very small sizes outside their intended context.
- `window.close()` is blocked by modern browsers when the tab was not originally opened via `window.open()` in JavaScript. There is no reliable way to close such a tab programmatically, and the failure mode is completely silent — the call returns without error but the tab remains open. The component must detect this case and show a message so the user is not left confused by a button that appears to do nothing.
