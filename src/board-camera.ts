type Point = { x: number; y: number };

export function boardCamera(world: HTMLElement, reducedMotion: boolean) {
  const followZoom = 2.3;
  let fullMap = false;
  let pawn: Point = { x: 0.5, y: 0.5 };
  let current: { x: number; y: number; zoom: number } | undefined;
  let frame: number | undefined;
  let previousTime = 0;

  function target() {
    if (fullMap) return { x: 0, y: 0, zoom: 1 };
    const clamp = (value: number) =>
      Math.max(1 - followZoom, Math.min(0, value));
    return {
      x: clamp(0.5 - pawn.x * followZoom),
      // Keep a little more room above the feet for the upright sprite.
      y: clamp(0.57 - pawn.y * followZoom),
      zoom: followZoom,
    };
  }

  function render({ x, y, zoom }: NonNullable<typeof current>) {
    world.style.transform = `translate(${x * 100}%, ${y * 100}%) scale(${zoom})`;
  }

  function tick(time: number) {
    frame = undefined;
    if (!world.isConnected) return;
    const next = target();
    const from = current!;
    const blend = 1 - Math.exp(-Math.min(time - previousTime, 50) / 58);
    previousTime = time;
    const distance = Math.max(
      Math.abs(next.x - from.x),
      Math.abs(next.y - from.y),
      Math.abs(next.zoom - from.zoom),
    );
    if (distance < 0.001) {
      current = next;
    } else {
      current = {
        x: from.x + (next.x - from.x) * blend,
        y: from.y + (next.y - from.y) * blend,
        zoom: from.zoom + (next.zoom - from.zoom) * blend,
      };
      frame = requestAnimationFrame(tick);
    }
    render(current);
  }

  function update(immediate = false) {
    if (immediate || reducedMotion || !current) {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      current = target();
      render(current);
    } else if (frame === undefined) {
      previousTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  return {
    follow(point: Point) {
      pawn = point;
      if (!fullMap) update();
    },
    setOverview(active: boolean) {
      fullMap = active;
      update();
    },
    snap() {
      update(true);
    },
  };
}
