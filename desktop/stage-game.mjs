import { cp, mkdir, readFile, writeFile } from "node:fs/promises";

const game = new URL("./dist/game/", import.meta.url);
const destination = new URL("desktop-fonts/", game);
const source = new URL(
  "./node_modules/@fontsource-variable/noto-sans-tc/",
  import.meta.url,
);

await mkdir(destination, { recursive: true });
await Promise.all(
  ["index.css", "files", "LICENSE"].map((entry) =>
    cp(new URL(entry, source), new URL(entry, destination), {
      recursive: true,
    }),
  ),
);
await writeFile(
  new URL("desktop.css", game),
  `@import "./desktop-fonts/index.css";

:root {
  font-family: "Noto Sans TC Variable", system-ui, sans-serif;
  scrollbar-width: none;
}
`,
);

const index = new URL("index.html", game);
const html = await readFile(index, "utf8");
await writeFile(
  index,
  html.replace(
    "</head>",
    '  <link rel="stylesheet" href="./desktop.css" />\n  </head>',
  ),
);
