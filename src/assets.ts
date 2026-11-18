import titleLandscape from "../art/title_kv_landscape_final.jpg";
import titlePortrait from "../art/title_kv_portrait_final.jpg";
import juniorLandscape from "../art/map_junior_landscape_final.jpg";
import juniorPortrait from "../art/map_junior_portrait_final.jpg";
import logo from "../art/logo_final.jpg";
import button from "../art/button_states_final.jpg";
import boyElem from "../art/hero_boy_elem_final.jpg";
import girlElem from "../art/hero_girl_elem_final.jpg";
import boyJunior from "../art/hero_boy_junior_final.jpg";
import girlJunior from "../art/hero_girl_junior_final.jpg";

export const assets = {
  title: { landscape: titleLandscape, portrait: titlePortrait },
  junior: { landscape: juniorLandscape, portrait: juniorPortrait },
  logo,
  button,
  heroes: {
    elem: { boy: boyElem, girl: girlElem },
    junior: { boy: boyJunior, girl: girlJunior },
  },
};

export async function preloadOpening(
  orientation: "portrait" | "landscape",
  progress: (count: number, total: number) => void,
) {
  const urls = [
    assets.title[orientation],
    assets.junior[orientation],
    assets.logo,
    assets.button,
    ...Object.values(assets.heroes.elem),
    ...Object.values(assets.heroes.junior),
  ];
  let loaded = 0;
  progress(loaded, urls.length);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      progress(++loaded, urls.length);
    }),
  );
  if (results.some((result) => result.status === "rejected"))
    throw new Error("部分素材載入失敗。");
}
