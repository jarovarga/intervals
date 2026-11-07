const SVG = 'http://www.w3.org/2000/svg';

/** The ring is drawn in a 100 × 100 box, so lengths along it are percent of the circumference. */
const SIZE = 100;
const CENTRE = SIZE / 2;

/** Above this many segments the gaps shrink, so that short segments keep some length. */
const DENSE = 12;
const GAP = 1.1;
const DENSE_GAP = 0.8;

/** Shortest arc that is still drawn. */
const MIN_LENGTH = 0.01;

/** An arc this long or longer is a whole circle, which a path cannot draw. */
const FULL = 99.5;

/**
 * @typedef {{ start: number, length: number }} Arc Start and length along the ring, in percent of its circumference from the top.
 */

/**
 * @param {import('./workout.js').Workout} workout Workout to draw.
 * @returns {number[]} Seconds of every exercise of one round and of the rests between them, in running order.
 */
export const segments = ({ exercises, rest }) =>
  exercises.flatMap(({ time }, index) => (index < exercises.length - 1 && rest > 0 ? [time, rest] : [time]));

/**
 * Lay segments out around the ring: each takes its share of the circumference, minus a gap, and is shortened at both
 * ends by the half stroke that its round cap adds.
 *
 * @param {number[]} durations Lengths of the segments in any unit.
 * @param {number} width Stroke width in the units of the 100 × 100 box.
 * @returns {Arc[]} One arc per segment.
 */
export const layout = (durations, width) => {
  const total = durations.reduce((sum, duration) => sum + duration, 0);

  if (total <= 0) return [];

  const gap = durations.length > DENSE ? DENSE_GAP : GAP;
  const cap = width / 2 / ((2 * Math.PI * (CENTRE - width / 2)) / SIZE);
  let position = 0;

  return durations.map((duration) => {
    const share = (duration / total) * SIZE;
    const arc = { start: position + gap / 2 + cap, length: Math.max(share - gap - cap * 2, MIN_LENGTH) };

    position += share;

    return arc;
  });
};

/**
 * @param {number} value A coordinate.
 * @returns {string} It with at most three decimals.
 */
const round = (value) => String(Number(value.toFixed(3)));

/**
 * @param {Arc} arc Arc to draw.
 * @param {number} width Stroke width.
 * @returns {string} The `d` of an SVG path along the ring, starting at the top and running clockwise.
 */
export const arcPath = ({ start, length }, width) => {
  const radius = CENTRE - width / 2;
  const point = (position) => {
    const angle = (position / SIZE) * 2 * Math.PI - Math.PI / 2;

    return `${round(CENTRE + radius * Math.cos(angle))} ${round(CENTRE + radius * Math.sin(angle))}`;
  };

  return `M ${point(start)} A ${round(radius)} ${round(radius)} 0 ${length > SIZE / 2 ? 1 : 0} 1 ${point(start + length)}`;
};

/**
 * Draw arcs into an SVG with a `0 0 100 100` view box, replacing what it held. Every arc is a path with round caps in
 * the current colour; a whole circle is a circle, because a path cannot close on itself.
 *
 * @param {SVGSVGElement} svg Element to draw into.
 * @param {Arc[]} arcs Arcs to draw.
 * @param {number} width Stroke width.
 * @returns {void}
 */
export const draw = (svg, arcs, width) => {
  const shapes = arcs.map((arc) => {
    const full = arc.length >= FULL;
    const shape = document.createElementNS(SVG, full ? 'circle' : 'path');

    if (full) {
      shape.setAttribute('cx', String(CENTRE));
      shape.setAttribute('cy', String(CENTRE));
      shape.setAttribute('r', String(CENTRE - width / 2));
    } else {
      shape.setAttribute('d', arcPath(arc, width));
    }

    shape.setAttribute('fill', 'none');
    shape.setAttribute('stroke', 'currentColor');
    shape.setAttribute('stroke-width', String(width));
    shape.setAttribute('stroke-linecap', 'round');

    return shape;
  });

  svg.replaceChildren(...shapes);
};
