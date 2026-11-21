const tiers = [
  ["輕鬆", 120, 2000, 800],
  ["普通", 200, 3000, 1500],
  ["亮眼", 350, 4000, 2500],
  ["頂尖", 500, 5000, 4000],
] as const;

function partner(
  name: string,
  gender: "boy" | "girl",
  tierIndex: number,
  lines: {
    intro: string;
    date: string;
    right: string;
    wrong: string;
    decline: string;
    success: string;
    failure: string;
  },
) {
  const [tier, charm, fee, salary] = tiers[tierIndex];
  return { name, gender, tier, charm, fee, salary, lines };
}

export const partners = {
  lin_xiaoqing: partner("林小晴", "girl", 0, {
    intro: "我多烤了一塊餅乾。分你一半，另一半留給散步回來的我。",
    date: "這裡剛好曬得到太陽。我們坐一下，看看你記得我哪些小習慣。",
    right: "你有記住耶！這題值得多一塊餅乾。",
    wrong: "差一點！就跟餅乾少烤一分鐘一樣。",
    decline: "我今天想自己走一小段路。改天有心情了，我們再一起散步。",
    success: "那以後的餅乾要多烤一份了。好啊，我想跟你交往。",
    failure: "這句話我想慢慢消化。今天先一起走到路口，好嗎？",
  }),
  chen_boyu: partner("陳柏宇", "boy", 0, {
    intro: "剛打完球，正要去吃拉麵。你也在找吃的嗎？",
    date: "坐這邊，吹得到風。來比比看你能投進幾題。",
    right: "空心球！你猜得真準。",
    wrong: "擦到籃框啦。下一球再來！",
    decline: "今天我想去海邊把腦袋放空，這場先改天約。",
    success: "我剛才比罰球還緊張。好，我想跟你在一起！",
    failure: "我有聽進去。這球能不能先留在我手上，讓我想一下？",
  }),
  xu_zhiyan: partner("許芷妍", "girl", 1, {
    intro: "早啊！我剛練完球，手上這杯果汁還冰著。",
    date: "我空出整個下午了。先喝一口，再來接我的發球。",
    right: "漂亮的回球！你果然有在聽。",
    wrong: "出界一點點。我晚點再跟你說原因。",
    decline: "我想把今天留給自己整理步調。我們再約一個兩個人都舒服的時間。",
    success: "我想好了。從明天開始，把早餐時間也留一點給我們吧。",
    failure: "我還需要一點時間確認自己的感覺。謝謝你直接告訴我。",
  }),
  wu_chengen: partner("吳承恩", "boy", 1, {
    intro: "這是我自己磨的木頭撥片。摸摸看，邊角都磨圓了。",
    date: "我剛調好弦。趁這裡還安靜，來聊幾件我最常做的事。",
    right: "對，就是那個。聽起來像終於把弦調準了。",
    wrong: "像木頭量少了一格。再量一次就好。",
    decline: "我今天想一個人把手上的木箱做完。下次再找個地方坐坐吧。",
    success: "好。我想讓你聽到每一首還沒寫完的歌。",
    failure: "我想先把自己的心情理順，再給你一個認真的回答。",
  }),
  su_yining: partner("蘇以寧", "girl", 2, {
    intro: "先別動，你身後那盞路燈剛好補上我畫裡缺的一筆。",
    date: "這個角度能看到窗上的倒影。我們邊看邊聊吧。",
    right: "你連那個小地方都看到了啊。",
    wrong: "也有那種看法。我自己通常會多看另一個角落。",
    decline: "我今天想獨自把這條街畫完。等草稿乾了，再讓你看。",
    success: "我想把今晚畫下來。畫面裡會有我們兩個。",
    failure: "我現在還畫不出我們的樣子。能不能讓我再多看看？",
  }),
  shen_shuheng: partner("沈書恆", "boy", 2, {
    intro: "這本舊書裡夾了一張車票。你覺得它原本是誰的書籤？",
    date: "我挑了光最柔的位子。咖啡慢慢喝，我有幾件事想問你。",
    right: "你記得比我的底片筆記還清楚。",
    wrong: "這格有點失焦。等一下，我把細節說給你聽。",
    decline: "今天我想獨自走一趟老街。等那卷拍完，再約你喝咖啡。",
    success: "好。下回拍合照，我會記得把腳架架好，再走到你旁邊。",
    failure: "謝謝你把這一頁翻給我看。我還想多讀一會兒。",
  }),
  bai_xingyu: partner("白星語", "girl", 3, {
    intro: "剛彩排完。你聞到了嗎？後台有人偷偷開了布丁。",
    date: "今天沒有觀眾。你坐近一點，我出題只給你聽。",
    right: "正中拍點！我要幫你拍手。",
    wrong: "這句進早了半拍。沒關係，下一段接得回來。",
    decline: "我今天需要安靜一點。等排練告一段落，我再跟你好好聊。",
    success: "這次我不用麥克風。靠近一點，我也喜歡你。",
    failure: "我聽見了。現在先讓我把這段心情留在後台，好嗎？",
  }),
  ling_haochen: partner("凌昊辰", "boy", 3, {
    intro: "袖口有點亂？剛才架望遠鏡時捲起來，差點忘了放下。",
    date: "雲散得很慢。等星星出來以前，陪我聊幾件小事吧。",
    right: "正好。像兩個音一起落在和弦裡。",
    wrong: "我懂你怎麼猜的。我的習慣稍微不一樣。",
    decline: "我今天想安靜練琴。改天我有心力，我們再找時間見面。",
    success: "我也想跟你在一起。今晚看到的第一顆星，就當作紀念吧。",
    failure: "我想鄭重回答你。今晚請先給我一點時間。",
  }),
};

export type PartnerId = keyof typeof partners;
export const partnerIds = Object.keys(partners) as PartnerId[];

export function currentPartner(id: string | null) {
  return id && Object.hasOwn(partners, id)
    ? { id: id as PartnerId, ...partners[id as PartnerId] }
    : null;
}
