// 道具中英文对照表
// 格式：英文名称 -> 中文官方译名
export const ITEM_NAMES: Record<string, string> = {
  "Air Balloon": "气球",
  "Berry Juice": "树果汁",
  "Black Sludge": "黑色淤泥",
  "Bright Powder": "光之粉",
  "Choice Band": "讲究头带",
  "Choice Scarf": "讲究围巾",
  "Choice Specs": "讲究眼镜",
  "Damp Rock": "潮湿岩石",
  "Darkinium Z": "恶Z",
  "Deep Sea Tooth": "深海之牙",
  "Electrium Z": "电Z",
  "Eviolite": "进化奇石",
  "Fairium Z": "妖精Z",
  "Firium Z": "火Z",
  "Flame Orb": "火焰宝珠",
  "Flying Gem": "飞行宝石",
  "Flyinium Z": "飞行Z",
  "Focus Sash": "气势披带",
  "Grassium Z": "草Z",
  "Groundium Z": "地面Z",
  "Heat Rock": "炽热岩石",
  "Icium Z": "冰Z",
  "Leftovers": "吃剩的东西",
  "Life Orb": "生命宝珠",
  "Light Clay": "光之黏土",
  "Normal Gem": "一般宝石",
  "Normalium Z": "一般Z",
  "Oran Berry": "文柚果",
  "Poisonium Z": "毒Z",
  "Shed Shell": "美丽空壳",
  "Thick Club": "粗骨头",
  "Toxic Orb": "剧毒宝珠",
};

// 常见道具（扩展覆盖未来可能出现的名称）
export const EXTENDED_ITEM_NAMES: Record<string, string> = {
  ...ITEM_NAMES,
  "Assault Vest": "突击背心",
  "Big Root": "大根茎",
  "Binding Band": "紧绑束带",
  "Black Belt": "黑带",
  "Black Glasses": "墨镜",
  "Boost Energy": "加速器",
  "Charcoal": "木炭",
  "Dragon Fang": "龙之牙",
  "Expert Belt": "讲究腰带",
  "Hard Stone": "硬石头",
  "Iron Ball": "铁球",
  "Kings Rock": "王者之证",
  "Lagging Tail": "后攻之尾",
  "Magnet": "磁铁",
  "Mental Herb": "精神香草",
  "Metal Coat": "金属膜",
  "Metronome": "节拍器",
  "Miracle Seed": "奇迹种子",
  "Mystic Water": "神秘水滴",
  "Never-Melt Ice": "不融冰",
  "Odd Incense": "奇异熏香",
  "Poison Barb": "毒针",
  "Quick Claw": "先制之爪",
  "Rocky Helmet": "岩石头盔",
  "Scope Lens": "广角镜",
  "Sea Incense": "海潮熏香",
  "Sharp Beak": "尖锐之喙",
  "Silk Scarf": "丝绸围巾",
  "Silver Powder": "银粉",
  "Sitrus Berry": "文柚果",
  "Soft Sand": "柔软沙子",
  "Spell Tag": "诅咒符",
  "Stick": "葱",
  "Twisted Spoon": "弯匙",
  "Wacan Berry": "乐芭果",
  "White Herb": "白色香草",
  "Wide Lens": "广角镜",
  "Zoom Lens": "放大镜",
};

export function getItemNameCN(en: string): string {
  const direct = EXTENDED_ITEM_NAMES[en];
  if (direct) return direct;
  // 去掉大小写的模糊匹配
  const lower = en.toLowerCase();
  for (const key of Object.keys(EXTENDED_ITEM_NAMES)) {
    if (key.toLowerCase() === lower) return EXTENDED_ITEM_NAMES[key];
  }
  return en;
}
