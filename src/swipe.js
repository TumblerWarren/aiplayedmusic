// Distances are React Native layout points; reject vertical scrolling and taps.
export function isHorizontalSwipe({ dx, dy, numberActiveTouches = 1 }) {
  return numberActiveTouches <= 1 && Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function swipeAction(gesture) {
  if (!isHorizontalSwipe(gesture) || Math.abs(gesture.dx) < 56) return null;
  return gesture.dx < 0 ? 'next' : 'previous';
}
