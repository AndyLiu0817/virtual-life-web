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
    const viewport = world.parentElement!;
    const width = world.offsetWidth;
    const height = world.offsetHeight;
    if (!width || !height) return { x: 0, y: 0, zoom: 1 };

    // The scene is fitted and centered at rest. When following the pawn,
    // position the zoomed scene against the actual edges of the viewport.
    const horizontal = viewport.clientWidth / width;
    const vertical = viewport.clientHeight / height;
    const zoom = Math.max(followZoom, horizontal, vertical);
    const x = world.offsetLeft / width;
    const y = world.offsetTop / height;
    const clamp = (value: number, start: number, extent: number) =>
      Math.max(extent - start - zoom, Math.min(-start, value));
    return {
      x: clamp(horizontal / 2 - x - pawn.x * zoom, x, horizontal),
      y: clamp(0.57 * vertical - y - pawn.y * zoom, y, vertical),
      zoom,
    };
  }

  function render({ x, y, zoom }: NonNullable<typeof current>) {
    world.style.setProperty("--board-zoom", String(zoom));
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
    setOverview(active: boolean, immediate = false) {
      fullMap = active;
      update(immediate);
    },
    snap() {
      update(true);
    },
  };
}
