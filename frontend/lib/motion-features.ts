import { domMax } from "framer-motion";

// domMax, not the smaller domAnimation — BottomSheet uses drag="y" and
// AddStepper uses layout, both gesture/layout features that domAnimation
// excludes. Default export so LazyMotion's `features` prop can dynamic-
// import this file lazily instead of bundling framer-motion's full engine
// into the initial page load (docs/update.md U5).
export default domMax;
