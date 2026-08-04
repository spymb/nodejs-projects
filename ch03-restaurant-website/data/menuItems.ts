// 菜单数据模块 —— 只负责"数据"，不包含任何业务逻辑。
// 结构与书中图 3-5 保持一致：{ id, name, description, price }

/** 单个菜品的数据结构。 */
export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
}

/**
 * 餐厅菜品列表。
 * @type {MenuItem[]}
 */
export const menuItems: MenuItem[] = [
  {
    id: 1,
    name: "西兰花切达派",
    description:
      "用散养西兰花与熟成切达奶酪制作的扎实馅派，酥脆黄油酥皮烘烤而成。",
    price: 12.99,
  },
  {
    id: 2,
    name: "红薯鼠尾草派",
    description: "烤红薯裹上酥脆鼠尾草叶，带一缕肉豆蔻的清香。",
    price: 11.99,
  },
  {
    id: 3,
    name: "野生蘑菇烩饭",
    description: "慢火搅拌的意大利米，搭配采自山野的蘑菇、百里香与帕玛森芝士。",
    price: 14.99,
  },
  {
    id: 4,
    name: "田园拼盘",
    description: "用传家番茄、时令绿叶与烤籽做成的清新应季沙拉。",
    price: 9.99,
  },
  {
    id: 5,
    name: "烟熏扁豆汤",
    description: "绿扁豆慢炖至绵软，点缀烟熏红椒粉与一勺橄榄油。",
    price: 8.99,
  },
  {
    id: 6,
    name: "市集烤饼",
    description: "柴火烤制的薄饼，铺上当天清晨市集送来的新鲜食材。",
    price: 13.99,
  },
  {
    id: 7,
    name: "公平贸易热可可",
    description: "用公平贸易可可豆调制的浓郁热可可，顶上雪白奶油。",
    price: 5.49,
  },
  {
    id: 8,
    name: "大黄酥",
    description: "酸香大黄盖一层黄油燕麦酥，温热上桌，配香草奶油。",
    price: 7.99,
  },
];
