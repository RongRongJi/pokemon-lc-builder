const zhCN = {
  translation: {
    app: {
      title: '宝可梦 LC 组队工具',
      subtitle: 'Lv.5 未进化型宝可梦对战'
    },
    common: {
      apply: '应用配置',
      nature: '性格',
      ability: '特性',
      item: '道具',
      level: '等级',
      moves: '技能',
      search: '搜索宝可梦',
      searchPlaceholder: '输入中文/英文名称搜索...',
      myTeam: '我的队伍',
      copyPokePaste: '复制 PokePaste',
      copied: '已复制!',
      emptyTeam: '队伍为空，从左侧选择宝可梦添加',
      addToTeam: '添加到队伍',
      language: '语言',
      langZH: '中文',
      langEN: 'English',
      noEvs: '无',
      ivTotal: '总计',
      enterItem: '输入道具名称...',
      moveSlot: '技能{{index}}',
      currentSelected: '当前选中',
      hp: 'HP',
      atk: '攻击',
      def: '防御',
      spAtk: '特攻',
      spDef: '特防',
      spd: '速度',
      evSpread: 'EV分配',
      calculationResult: '计算结果',
      individualValues: '个体值 (IV)',
      effortValues: '努力值 (EV)',
      officialSets: 'Smogon 官方配置',
      close: '关闭',
      instructions: '使用说明',
      instructions_list: [
        '搜索并选择未进化型宝可梦',
        '选择 Smogon 官方配置自动填充',
        '系统自动计算最小IV（保持属性最大值）',
        '可手动调整性格、特性、道具、技能',
        '添加到队伍并导出 PokePaste 格式'
      ],
      noAbility: '无特性'
    }
  }
};

export default zhCN;
export type Translation = typeof zhCN.translation;
