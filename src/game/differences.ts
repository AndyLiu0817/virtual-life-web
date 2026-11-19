// Source pictures are 4:3. These measurements use a 480 × 360 reference.
function spot(label: string, x: number, y: number, radius: number) {
  return { label, x: x / 480, y: y / 360, radius: radius / 480 };
}

export const differenceHotspots = [
  [
    spot("蘋果", 389, 293, 30),
    spot("書包圖案", 269, 202, 15),
    spot("貓的眼睛", 105, 162, 19),
    spot("兩本書", 108, 256, 60),
    spot("筆筒裡的筆", 363, 227, 18),
  ],
  [
    spot("金魚", 256, 228, 17),
    spot("花朵", 323, 172, 23),
    spot("左側氣球", 69, 129, 43),
    spot("狗的嘴巴", 389, 247, 20),
    spot("棉花糖", 136, 177, 32),
  ],
  [
    spot("貓頭鷹玩偶", 68, 136, 25),
    spot("月亮", 460, 49, 16),
    spot("馬克杯", 343, 235, 25),
    spot("眼鏡", 382, 259, 29),
    spot("坐墊", 63, 307, 58),
  ],
] as const;
