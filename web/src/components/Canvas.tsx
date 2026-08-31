/**
 * BLURT — the drawing canvas.
 *
 * Deliberately not an editor. Eight colours, three brush sizes, undo, clear, submit.
 * Bad drawings are the joke, and every extra tool makes them less bad.
 *
 * Mechanics that matter on a phone:
 *   • Pointer events, so mouse, touch and stylus are one code path.
 *   • `touch-action: none` on the canvas so drawing never scrolls the page.
 *   • Backing store scaled by `devicePixelRatio`, so lines are not fuzzy.
 *   • Strokes are kept client-side *only* for undo. What goes over the wire is one
 *     rasterised PNG at a fixed logical size — the stroke list never leaves the device.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DRAWING_CANVAS_HEIGHT,
  DRAWING_CANVAS_WIDTH,
  DRAWING_PAYLOAD_MAX_BYTES,
  DRAWING_UNDO_LIMIT,
} from '@shared/constants.js';
import { ActionButton, Button, Card } from './kit.js';

const COLOURS = [
  { id: 'ink', value: '#241C14', name: 'Black' },
  { id: 'tomato', value: '#E4572E', name: 'Red' },
  { id: 'marigold', value: '#F0A202', name: 'Yellow' },
  { id: 'teal', value: '#17A398', name: 'Teal' },
  { id: 'grape', value: '#7D5BA6', name: 'Purple' },
  { id: 'mint', value: '#5CB85C', name: 'Green' },
  { id: 'sky', value: '#3E7CB1', name: 'Blue' },
  { id: 'pink', value: '#E9788E', name: 'Pink' },
] as const;

const BRUSHES = [
  { id: 'thin', width: 4, name: 'Thin' },
  { id: 'medium', width: 10, name: 'Medium' },
  { id: 'fat', width: 22, name: 'Fat' },
] as const;

interface Stroke {
  colour: string;
  width: number;
  points: { x: number; y: number }[];
}

export function DrawingCanvas({
  subject,
  context,
  submitted,
  timer,
  onSubmit,
}: {
  subject: string;
  context: string;
  submitted: boolean;
  timer: React.ReactNode;
  onSubmit(dataUrl: string): void;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [colour, setColour] = useState<string>(COLOURS[0].value);
  const [width, setWidth] = useState<number>(BRUSHES[1].width);
  const [strokeCount, setStrokeCount] = useState(0);
  const [sent, setSent] = useState(submitted);
  const [tooBig, setTooBig] = useState(false);

  /** Repaint everything from the stroke list. Cheap at this scale and always correct. */
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas === null || ctx === null || ctx === undefined) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) {
      ctx.strokeStyle = stroke.colour;
      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      const [first, ...rest] = stroke.points;
      if (first === undefined) continue;
      if (rest.length === 0) {
        // A single tap should leave a dot, not nothing.
        ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.colour;
        ctx.fill();
        continue;
      }
      ctx.moveTo(first.x, first.y);
      for (const point of rest) ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }, []);

  // Size the backing store to the logical drawing size, scaled for the display.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ratio = Math.min(globalThis.devicePixelRatio ?? 1, 2);
    canvas.width = DRAWING_CANVAS_WIDTH * ratio;
    canvas.height = DRAWING_CANVAS_HEIGHT * ratio;
    const ctx = canvas.getContext('2d');
    ctx?.scale(ratio, ratio);
    repaint();
  }, [repaint]);

  /** Pointer position in logical canvas units, independent of CSS size. */
  const toLogical = (event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * DRAWING_CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * DRAWING_CANVAS_HEIGHT,
    };
  };

  // Pointer capture keeps the stroke alive when a finger wanders off the canvas
  // mid-drag, which is why there is no `pointerleave` handler — ending the stroke
  // there would chop a line in half every time somebody drew past the edge.
  const start = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (sent) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = { colour, width, points: [toLogical(event)] };
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const stroke = drawingRef.current;
    if (stroke === null) return;
    stroke.points.push(toLogical(event));
    // Draw the live stroke without a full repaint, so dragging stays smooth.
    const ctx = canvasRef.current?.getContext('2d');
    const points = stroke.points;
    const from = points[points.length - 2];
    const to = points[points.length - 1];
    if (ctx === null || ctx === undefined || from === undefined || to === undefined) return;
    ctx.strokeStyle = stroke.colour;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const end = (): void => {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (stroke === null) return;
    strokesRef.current = [...strokesRef.current, stroke].slice(-DRAWING_UNDO_LIMIT);
    setStrokeCount(strokesRef.current.length);
    repaint();
  };

  const undo = (): void => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    repaint();
  };

  const clear = (): void => {
    strokesRef.current = [];
    setStrokeCount(0);
    repaint();
  };

  /**
   * Export at a fixed 800×600 regardless of the device.
   *
   * The on-screen buffer is scaled by `devicePixelRatio` so strokes look crisp while
   * drawing, but exporting that directly would send a 1600×1200 PNG from a retina
   * phone and a 800×600 one from a cheap tablet. Downscaling through an offscreen
   * canvas makes the payload the same size for everybody.
   */
  const submit = (): void => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const flat = document.createElement('canvas');
    flat.width = DRAWING_CANVAS_WIDTH;
    flat.height = DRAWING_CANVAS_HEIGHT;
    const flatCtx = flat.getContext('2d');
    if (flatCtx === null) return;
    flatCtx.drawImage(canvas, 0, 0, DRAWING_CANVAS_WIDTH, DRAWING_CANVAS_HEIGHT);
    const dataUrl = flat.toDataURL('image/png');
    if (dataUrl.length > DRAWING_PAYLOAD_MAX_BYTES) {
      setTooBig(true);
      return;
    }
    setTooBig(false);
    setSent(true);
    onSubmit(dataUrl);
  };

  return (
    <div className="stack">
      <div className="row row--between">
        <div className="stack stack--tight">
          <p className="eyebrow">Draw this</p>
          <p className="lead breakable" style={{ fontFamily: 'var(--font-display)' }}>
            {subject}
          </p>
        </div>
        {timer}
      </div>

      {context.length > 0 && (
        <Card sunken>
          <p className="faint breakable">…from: “{context}”</p>
        </Card>
      )}

      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label="Drawing canvas. Use the buttons below if you cannot draw with a pointer."
          role="img"
        />
      </div>

      <div className="tools tools--swatches" role="group" aria-label="Colours">
        {COLOURS.map((option) => (
          <button
            key={option.id}
            className="swatch"
            style={{ background: option.value }}
            aria-label={option.name}
            aria-pressed={colour === option.value}
            onClick={() => setColour(option.value)}
            disabled={sent}
          />
        ))}
      </div>

      <div className="tools" role="group" aria-label="Brush size and actions">
        {BRUSHES.map((brush) => (
          <button
            key={brush.id}
            className="brush"
            aria-label={`${brush.name} brush`}
            aria-pressed={width === brush.width}
            onClick={() => setWidth(brush.width)}
            disabled={sent}
          >
            <span
              className="brush__dot"
              style={{ width: brush.width, height: brush.width }}
              aria-hidden="true"
            />
          </button>
        ))}
        <Button small onClick={undo} disabled={sent || strokeCount === 0}>
          UNDO
        </Button>
        <Button small onClick={clear} disabled={sent || strokeCount === 0}>
          CLEAR
        </Button>
      </div>

      <ActionButton variant="primary" block onClick={submit} disabled={sent}>
        {sent ? 'SENT — NO TAKEBACKS' : 'THAT IS MY FINAL ANSWER'}
      </ActionButton>
      {tooBig && (
        <p role="alert" className="counter counter--warn">
          That is a lot of drawing. Clear a bit and try again.
        </p>
      )}
      {!sent && strokeCount === 0 && (
        <p className="faint center">You can submit a blank one. People have.</p>
      )}
    </div>
  );
}
