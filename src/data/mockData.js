export const setupSteps = [
  { key: 'companions', type: 'single', title: '同行對象', options: ['自己', '朋友', '情侶', '家人'] },
  { key: 'interests', type: 'multiple', title: '興趣喜好', options: ['美食', '拍照', '自然', '逛街', '文化', '活動', '咖啡', '運動', '放鬆'] },
  { key: 'exploration', type: 'single', title: '探索程度', options: ['經典派', '在地派', '探索派', '冒險派'] },
  { key: 'transport', type: 'multiple', title: '移動偏好', options: ['公車', '步行', '計程車', '租車', '接駁車', '觀光巴士'] },
  { key: 'walking', type: 'single', title: '步行程度', options: ['輕鬆走', '適中走', '耐走派', '隨緣就好'] },
  { key: 'budget', type: 'single', title: '預算', options: ['小資輕鬆', '經濟實用', '標準享受', '高品質旅遊', '奢華放鬆', '自訂預算'] },
  { key: 'pace', type: 'single', title: '行程節奏', options: ['充實探索', '悠閒放鬆', '早起出發', '晚起慢遊', '彈性隨性'] },
  { key: 'notes', type: 'custom', title: '其他需求', options: ['特定日期／時間', '寵物同行', '特殊飲食／無障礙', '其他想法'] },
]

export const initialProfiles = [
  { id: 'friends', preset: true, name: '朋友出遊', summary: '3 人・美食、拍照・步行適中・預算中等', answers: { companions: '朋友', interests: ['美食', '拍照'], walking: '適中走', budget: '標準享受' } },
  { id: 'couple', preset: true, name: '情侶約會', summary: '2 人・美食、拍照・行程悠閒', answers: { companions: '情侶', interests: ['美食', '拍照'], pace: '悠閒放鬆', budget: '標準享受' } },
  { id: 'solo', preset: true, name: '自己亂跑', summary: '1 人・咖啡、拍照・探索更多可能', answers: { companions: '自己', interests: ['咖啡', '拍照'], exploration: '探索派', budget: '經濟實用' } },
  { id: 'family', preset: true, name: '家庭出遊', summary: '4 人・美食、文化・步行少', answers: { companions: '家人', interests: ['美食', '文化'], walking: '輕鬆走', budget: '標準享受' } },
]

export const busRoutes = [
  {
    id: '20', name: '20', from: '永春高中', to: '青年公園', eta: '6 分',
    outbound: ['永春高中', '捷運永春站', '市政府', '信義行政中心', '青年公園'],
    inbound: ['青年公園', '信義行政中心', '市政府', '捷運永春站', '永春高中'],
  },
  {
    id: '307', name: '307', from: '台北車站', to: '示範終點', eta: '5 分',
    outbound: ['台北車站', '示範中途站', '示範終點'],
    inbound: ['示範終點', '示範中途站', '台北車站'],
  },
  {
    id: '666', name: '666', from: '台北車站', to: '石碇高中', eta: '3 分',
    outbound: ['台北車站', '捷運善導寺站', '華山文創園區', '捷運忠孝新生站', '捷運忠孝復興站', '捷運大安站', '捷運科技大樓站', '捷運六張犁站', '木柵市場', '深坑老街', '石碇老街', '石碇國小', '石碇高中'],
    inbound: ['石碇高中', '石碇國小', '石碇老街', '深坑老街', '木柵市場', '捷運六張犁站', '捷運科技大樓站', '捷運大安站', '捷運忠孝復興站', '捷運忠孝新生站', '華山文創園區', '捷運善導寺站', '台北車站'],
  },
  {
    id: '795', name: '795', from: '木柵', to: '石碇高中', eta: '8 分',
    outbound: ['木柵', '深坑', '石碇', '石碇老街', '石碇國小', '石碇高中'],
    inbound: ['石碇高中', '石碇國小', '石碇老街', '石碇', '深坑', '木柵'],
  },
  {
    id: '912', name: '912', from: '深坑', to: '捷運市政府站', eta: '12 分',
    outbound: ['深坑國小', '深坑老街', '信義快速道路', '捷運市政府站'],
    inbound: ['捷運市政府站', '信義快速道路', '深坑老街', '深坑國小'],
  },
]

export const busStops = [
  { id: 'shiding-high', name: '石碇高中', area: '新北市石碇區', routes: ['666', '795'], nearby: ['shiding-elementary', 'shiding-oldstreet'], arrivals: [{ route: '666', destination: '台北車站', minutes: 6 }, { route: '795', destination: '木柵', minutes: 12 }] },
  { id: 'shiding-elementary', name: '石碇國小', area: '新北市石碇區', routes: ['666', '795'], nearby: ['shiding-high', 'shiding-oldstreet'], arrivals: [{ route: '666', destination: '台北車站', minutes: 9 }, { route: '795', destination: '木柵', minutes: 15 }] },
  { id: 'shiding-oldstreet', name: '石碇老街', area: '新北市石碇區', routes: ['666', '795'], nearby: ['shiding-high', 'shiding-elementary'], arrivals: [{ route: '666', destination: '台北車站', minutes: 13 }, { route: '795', destination: '木柵', minutes: 19 }] },
  { id: 'taipei-main', name: '台北車站', area: '台北市中正區', routes: ['307', '666'], nearby: [], arrivals: [{ route: '307', destination: '示範終點', minutes: 5 }, { route: '666', destination: '石碇高中', minutes: 6 }] },
]

export const wanderCards = [
  { id: 'outdoor-1', category: '戶外', title: '去附近散步 20 分鐘', detail: '挑一條平常不會走的小路。' },
  { id: 'food-1', category: '美食', title: '點一杯從沒喝過的飲料', detail: '口味交給今天的直覺。' },
  { id: 'photo-1', category: '拍照', title: '拍下三個藍色的東西', detail: '不用完美，留下今天的顏色。' },
  { id: 'challenge-1', category: '挑戰', title: '對一位店員真心說謝謝', detail: '讓今天多一點好心情。' },
  { id: 'outdoor-2', category: '戶外', title: '找一張沒坐過的長椅', detail: '坐五分鐘，什麼都不用做。' },
  { id: 'food-2', category: '美食', title: '走進一家沒去過的小店', detail: '只選一樣最吸引你的。' },
  { id: 'photo-2', category: '拍照', title: '拍一張今天的影子', detail: '留住只有此刻才有的形狀。' },
  { id: 'challenge-2', category: '挑戰', title: '把手機收起來十分鐘', detail: '看看身邊原本會錯過的細節。' },
]

export const placeSuggestions = ['東京', '大阪', '首爾', '台北', '台南', '清邁']

export const clone = (value) => JSON.parse(JSON.stringify(value))
